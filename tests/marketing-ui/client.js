export const learnerClient = {
  auth: { getSession: async () => ({ data: { session: { access_token: new URLSearchParams(window.location.search).get('user') || '1' } } }) },
  async rpc(name, args) {
    const response = await fetch('/__marketing_rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-User': new URLSearchParams(window.location.search).get('user') || '1' }, body: JSON.stringify({ name, args }) });
    return response.json();
  },
};
