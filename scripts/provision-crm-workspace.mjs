/* global process */
import postgres from 'postgres';
import { pathToFileURL } from 'node:url';
import { parseCrmCa, validateCrmUrl } from '../api/_lib/talent-db.js';

const ORION_WORKSPACE = Object.freeze({ name: 'Orion', slug: 'orion' });
const CRM_ROLES = Object.freeze(['viewer', 'contributor', 'manager', 'admin']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireValue(value, label) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

export async function provisionOrionWorkspace(query, options) {
  const identifier = requireValue(options?.userIdentifier, 'CRM_PROVISION_USER');
  const performedBy = requireValue(options?.performedBy, 'CRM_PROVISIONED_BY');
  const requestedRole = options?.role ?? 'admin';
  if (!CRM_ROLES.includes(requestedRole)) {
    throw new Error(`CRM_PROVISION_ROLE must be one of: ${CRM_ROLES.join(', ')}`);
  }

  await query("select pg_advisory_xact_lock(hashtext('crm:workspace:orion'))");
  await query("select set_config('application_name', $1, true)", [`orion-crm-provision:${performedBy}`]);

  const users = UUID_PATTERN.test(identifier)
    ? await query('select id, email from auth.users where id = $1::uuid', [identifier])
    : await query('select id, email from auth.users where lower(email) = lower($1)', [identifier]);
  if (users.rows.length === 0) throw new Error('No Supabase Auth user matches CRM_PROVISION_USER');
  if (users.rows.length > 1) throw new Error('CRM_PROVISION_USER is ambiguous; use the Auth user UUID');
  const user = users.rows[0];

  let workspace = (await query('select id, name, slug, created_at from crm.workspaces where slug = $1', [ORION_WORKSPACE.slug])).rows[0];
  let workspaceCreated = false;
  if (workspace && workspace.name !== ORION_WORKSPACE.name) {
    throw new Error(`Workspace slug "${ORION_WORKSPACE.slug}" already has a different name`);
  }
  if (!workspace) {
    const conflictingNames = await query('select id, slug from crm.workspaces where lower(trim(name)) = lower($1)', [ORION_WORKSPACE.name]);
    if (conflictingNames.rows.length) {
      throw new Error(`Workspace name "${ORION_WORKSPACE.name}" already uses a different slug`);
    }
    workspace = (await query(
      'insert into crm.workspaces(name, slug) values ($1, $2) returning id, name, slug, created_at',
      [ORION_WORKSPACE.name, ORION_WORKSPACE.slug],
    )).rows[0];
    workspaceCreated = true;
  }

  const inserted = await query(
    `insert into crm.workspace_members(workspace_id, user_id, role)
     values ($1, $2, $3) on conflict (workspace_id, user_id) do nothing
     returning role, created_at`,
    [workspace.id, user.id, requestedRole],
  );
  const membershipCreated = inserted.rows.length === 1;
  const membership = membershipCreated
    ? inserted.rows[0]
    : (await query(
      'select role, created_at from crm.workspace_members where workspace_id = $1 and user_id = $2',
      [workspace.id, user.id],
    )).rows[0];

  return {
    operation: 'orion_crm_workspace_provision',
    performedBy,
    performedAt: new Date().toISOString(),
    workspace: { ...workspace, created: workspaceCreated },
    user: { id: user.id, email: user.email },
    membership: {
      role: membership.role,
      requestedRole,
      createdAt: membership.created_at,
      created: membershipCreated,
      existingRolePreserved: !membershipCreated && membership.role !== requestedRole,
    },
  };
}

async function main() {
  const databaseUrl = validateCrmUrl(process.env.CRM_DATABASE_URL);
  const ca = parseCrmCa(process.env.CRM_DATABASE_CA_CERT);
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  });
  try {
    const result = await sql.begin((transaction) => provisionOrionWorkspace(
      (statement, parameters = []) => transaction.unsafe(statement, parameters),
      {
        userIdentifier: process.env.CRM_PROVISION_USER,
        performedBy: process.env.CRM_PROVISIONED_BY,
        role: process.env.CRM_PROVISION_ROLE || 'admin',
      },
    ));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.membership.existingRolePreserved) {
      process.stderr.write('Existing membership role was preserved; use the governed role-change process to change it.\n');
    }
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`CRM provisioning failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
