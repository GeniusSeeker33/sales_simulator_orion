export function postgresQuery(transaction) {
  return async (statement, parameters = []) => ({ rows: await transaction.unsafe(statement, parameters) });
}

const key = row => `${row.source_system}\u0000${row.source_entity}\u0000${row.source_id}`;

export function createPostgresImportTarget(sql) {
  return {
    async getWorkspace(workspaceId) {
      return (await sql`select id::text, slug, name from crm.workspaces where id = ${workspaceId}::uuid`)[0] ?? null;
    },
    async inspect(workspaceId, sourceSystem) {
      const [people, applications, activities, documents, consents] = await Promise.all([
        sql`select id::text, source_system, source_entity, source_id, email_normalized from crm.people where workspace_id = ${workspaceId}::uuid`,
        sql`select id::text, source_system, source_entity, source_id from crm.applications where workspace_id = ${workspaceId}::uuid`,
        sql`select id::text, source_system, source_entity, source_id from crm.activities where workspace_id = ${workspaceId}::uuid`,
        sql`select id::text, source_system, source_entity, source_id from crm.documents where workspace_id = ${workspaceId}::uuid`,
        sql`select id::text, source_system, source_entity, source_id from crm.consent_records where workspace_id = ${workspaceId}::uuid`,
      ]);
      const all = [...people, ...applications, ...activities, ...documents, ...consents];
      const peopleByEmail = {}, peopleByProvenance = {}, applicationIds = {};
      for (const person of people) {
        peopleByProvenance[key(person)] = person;
        if (person.email_normalized) (peopleByEmail[person.email_normalized] ??= []).push(person.id);
      }
      for (const application of applications) applicationIds[key(application)] = application.id;
      return { workspace_id: workspaceId, provenance: new Set(all.filter(r => r.source_system === sourceSystem).map(key)),
        people_by_email: peopleByEmail, people_by_provenance: peopleByProvenance, application_ids: applicationIds };
    },
    async apply({ workspaceId, sourceSystem, operator, runId, plan }) {
      return sql.begin(async transaction => {
        const query = postgresQuery(transaction), batches = [];
        await query("select pg_advisory_xact_lock(hashtext('crm:join-orion-candidate-import:' || $1))", [workspaceId]);
        await query("select set_config('application_name', $1, true)", [`join-orion-import:${operator}:${runId}`]);
        let writes = 0;
        const personIds = new Map();
        const sourceIdentities = new Set([...plan.people.map(p => p.source_id), ...plan.applications.map(a => a.source_identity_id),
          ...plan.activities.map(a => a.source_identity_id), ...plan.documents.map(d => d.source_identity_id), ...plan.consents.map(c => c.source_identity_id)]);
        for (const sourceId of sourceIdentities) {
          const person = plan.people.find(p => p.source_id === sourceId);
          if (person) {
            const result = await query(`insert into crm.people(workspace_id, first_name, last_name, preferred_name, email, phone,
              lifecycle_stage, attributes, source_system, source_entity, source_id)
              values ($1,$2,$3,$4,$5,$6,'applicant',$7,$8,'candidate_applications',$9)
              on conflict (workspace_id, source_system, source_entity, source_id) do nothing returning id::text`,
            [workspaceId, person.first_name, person.last_name, person.preferred_name, person.email, person.phone,
              { import_run_id: runId }, sourceSystem, sourceId]);
            writes += result.rows.length;
          }
          const resolved = await query(`select id::text from crm.people where workspace_id=$1 and source_system=$2
            and source_entity='candidate_applications' and source_id=$3`, [workspaceId, sourceSystem, sourceId]);
          if (!resolved.rows[0]) throw new Error(`Person provenance could not be resolved for source identity ${sourceId}`);
          personIds.set(sourceId, resolved.rows[0].id);
        }
        batches.push({ entity: 'people', attempted: plan.people.length, writes });

        let entityWrites = 0;
        for (const row of plan.applications) {
          const result = await query(`insert into crm.applications(workspace_id, application_type, status, person_id, job_ref,
            submitted_at, payload_snapshot, source_system, source_entity, source_id, created_at, updated_at)
            values ($1,'candidate',$2,$3,$4,$5,$6,$7,'candidate_applications',$8,coalesce($9,$5),coalesce($10,$9,$5))
            on conflict (workspace_id, source_system, source_entity, source_id) do nothing returning id::text`,
          [workspaceId, row.status, personIds.get(row.source_identity_id), row.job_ref, row.submitted_at,
            { ...row.payload, source_owner_ref: row.assigned_source_ref, source_created_at: row.source_created_at, source_updated_at: row.source_updated_at, import_run_id: runId },
            sourceSystem, row.source_id, row.source_created_at, row.source_updated_at]);
          entityWrites += result.rows.length;
        }
        writes += entityWrites; batches.push({ entity: 'applications', attempted: plan.applications.length, writes: entityWrites });
        const applicationId = async sourceId => sourceId ? (await query(`select id::text from crm.applications where workspace_id=$1
          and source_system=$2 and source_entity='candidate_applications' and source_id=$3`, [workspaceId, sourceSystem, sourceId])).rows[0]?.id ?? null : null;

        entityWrites = 0;
        for (const row of plan.activities) {
          const result = await query(`insert into crm.activities(workspace_id,person_id,application_id,activity_type,direction,summary,
            occurred_at,metadata,source_system,source_entity,source_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'candidate_activity',$10)
            on conflict (workspace_id,source_system,source_entity,source_id) do nothing returning id`,
          [workspaceId, personIds.get(row.source_identity_id), await applicationId(row.application_source_id), row.type, row.direction,
            row.summary, row.occurred_at, { ...row.metadata, import_run_id: runId }, sourceSystem, row.source_id]);
          entityWrites += result.rows.length;
        }
        writes += entityWrites; batches.push({ entity: 'activities', attempted: plan.activities.length, writes: entityWrites });

        entityWrites = 0;
        for (const row of plan.documents) {
          const result = await query(`insert into crm.documents(workspace_id,person_id,application_id,document_type,storage_path,
            original_filename,metadata,source_system,source_entity,source_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            on conflict (workspace_id,source_system,source_entity,source_id) do nothing returning id`,
          [workspaceId, personIds.get(row.source_identity_id), await applicationId(row.application_source_id), row.document_type,
            row.storage_path, row.original_filename, { ...row.metadata, import_run_id: runId }, sourceSystem, row.source_entity, row.source_id]);
          entityWrites += result.rows.length;
        }
        writes += entityWrites; batches.push({ entity: 'documents', attempted: plan.documents.length, writes: entityWrites });

        entityWrites = 0;
        for (const row of plan.consents) {
          const result = await query(`insert into crm.consent_records(workspace_id,person_id,channel,status,purpose,captured_at,evidence,
            source_system,source_entity,source_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            on conflict (workspace_id,source_system,source_entity,source_id) do nothing returning id`,
          [workspaceId, personIds.get(row.source_identity_id), row.channel, row.status, row.purpose, row.captured_at,
            { ...row.evidence, import_run_id: runId }, sourceSystem, row.source_entity, row.source_id]);
          entityWrites += result.rows.length;
        }
        writes += entityWrites; batches.push({ entity: 'consents', attempted: plan.consents.length, writes: entityWrites });
        return { writes, batches };
      });
    },
  };
}
