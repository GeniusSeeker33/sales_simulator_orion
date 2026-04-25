export function getClientId(req) {
  return req.headers['x-client-id'] || 'orion-demo';
}