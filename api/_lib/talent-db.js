/* global process */
import postgres from 'postgres';

let pool;
export async function withTalentDatabase(userId, read) {
  if (!process.env.CRM_DATABASE_URL) throw new Error('CRM database unavailable');
  pool ||= postgres(process.env.CRM_DATABASE_URL, {
    ssl: 'verify-full', prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10,
  });
  return pool.begin('isolation level repeatable read read only', async sql => {
    // The verified subject is transaction-local. Existing CRM RLS remains active,
    // even when the connection credential can assume a more privileged role.
    await sql.unsafe('set local role authenticated');
    await sql.unsafe("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await sql.unsafe("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: 'authenticated' })]);
    await sql.unsafe("set local statement_timeout = '10s'");
    return read((query, parameters = []) => sql.unsafe(query, parameters));
  });
}
