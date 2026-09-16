/* global process */
import postgres from 'postgres';
import { parseCrmCa, validateCrmUrl } from './talent-db.js';
import { createJoinOrionSourceAdapter } from '../../scripts/lib/join-orion-source-adapter.mjs';
import { createPostgresQuery } from '../../scripts/lib/join-orion-source-inspection.mjs';
import { TalentFailure } from './talent-diagnostics.js';

export function createHostedJoinOrionSource({ connect = postgres, environment = () => process.env } = {}) {
  let pool;
  return {
    async read() {
      try {
        const env = environment();
        if (!env.JOIN_ORION_DATABASE_URL) throw new TalentFailure('join_orion_not_configured', 'source_configuration');
        if (!pool) pool = connect(validateCrmUrl(env.JOIN_ORION_DATABASE_URL), {
          max: 2, prepare: false, connect_timeout: 10, idle_timeout: 20,
          ssl: { rejectUnauthorized: true, ...(env.JOIN_ORION_DATABASE_CA_CERT ? { ca: parseCrmCa(env.JOIN_ORION_DATABASE_CA_CERT) } : {}) },
        });
        return await createJoinOrionSourceAdapter(createPostgresQuery(pool)).read();
      } catch (error) {
        if (error?.category === 'join_orion_not_configured') throw error;
        throw new TalentFailure('join_orion_source_unavailable', 'source_read', error);
      }
    },
  };
}
