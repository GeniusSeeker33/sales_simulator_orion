// Never pass an Error, request, configuration object, or database row to logging.
const categories = new Set([
  'auth_not_configured', 'auth_verification_failed', 'crm_not_configured',
  'crm_configuration_invalid', 'crm_connection_failed', 'crm_role_assumption_failed',
  'crm_auth_context_failed', 'crm_workspace_missing', 'crm_membership_missing', 'crm_query_failed',
]);
const stages = new Set([
  'auth_configuration', 'auth_verification', 'configuration', 'transaction_begin',
  'role_assumption', 'auth_context', 'workspace_lookup', 'candidate_read', 'transaction_commit',
]);
const connectionCodes = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT',
  'CONNECT_TIMEOUT', 'CONNECTION_CLOSED', 'CONNECTION_ENDED', 'CONNECTION_DESTROYED',
  'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID',
  'ERR_SSL_WRONG_VERSION_NUMBER', '28000', '28P01', '53300', '53400', '57P01', '57P03',
  '08000', '08001', '08003', '08004', '08006', '08007', '08P01',
]);
const codes = new Set([...connectionCodes, '42501', '42P01', '3F000', '42883', '42703',
  '22023', '22P02', '25006', '0P000', '57014', '40001', '40P01']);

export class TalentFailure extends Error {
  constructor(category, stage, error) {
    super(categories.has(category) ? category : 'crm_query_failed');
    this.category = this.message;
    this.stage = stages.has(stage) ? stage : 'candidate_read';
    this.code = codes.has(error?.code) ? error.code : undefined;
    // Deliberately no cause: driver messages/stacks may embed credentials or SQL.
  }
}
export function databaseFailure(error, category, stage) {
  if (error instanceof TalentFailure) return error;
  return new TalentFailure(connectionCodes.has(error?.code) ? 'crm_connection_failed' : category, stage, error);
}
export function logTalentDiagnostic(log, error) {
  const failure = error instanceof TalentFailure ? error : new TalentFailure('crm_query_failed', 'candidate_read', error);
  const event = {
    event: 'talent_availability',
    category: categories.has(failure.category) ? failure.category : 'crm_query_failed',
    stage: stages.has(failure.stage) ? failure.stage : 'candidate_read',
  };
  if (codes.has(failure.code)) event.code = failure.code;
  // Logging failure must not alter authorization or the HTTP response.
  try { log(event); } catch { /* no unsafe fallback serialization */ }
}
