export function useAuth() {
  const user = new URLSearchParams(window.location.search).get('user') || '1';
  return { session: { id: `00000000-0000-4000-8000-${user.padStart(12, '0')}`, name: 'Synthetic marketing user', role: 'manager' }, logout() {} };
}
