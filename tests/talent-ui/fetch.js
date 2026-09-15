export function learnerFetch(url, options) {
  const token = new URLSearchParams(window.location.search).get('user') || '1';
  return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}` } });
}
