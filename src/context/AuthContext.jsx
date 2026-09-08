import { createContext, useContext, useEffect, useState } from "react";
import { learnerClient } from "../lib/learnerClient";
import { buildAppSession, defaultAppRoute } from "../lib/appRoles";

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(!!learnerClient);
  useEffect(() => {
    let live = true;
    let revision = 0;
    async function refresh() {
      const current = ++revision;
      const { data, error } = await learnerClient.auth.getUser();
      if (!live || current !== revision) return;
      const user = !error && data.user;
      setSession(buildAppSession(user));
      setLoading(false);
    }
    localStorage.removeItem("orion-auth-session");
    if (!learnerClient) return;
    refresh();
    const { data } = learnerClient.auth.onAuthStateChange(() => {
      // Keep async Auth work outside the auth callback lock.
      setTimeout(() => { if (live) refresh(); }, 0);
    });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);
  async function login(email, password) {
    if (!learnerClient) return { success: false, error: "Learner access is not configured. Contact the pilot administrator." };
    const { data, error } = await learnerClient.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { success: false, error: "Sign-in failed. Use your individually provisioned pilot account." };
    const nextSession = buildAppSession(data.user);
    setSession(nextSession);
    return { success: true, redirect: defaultAppRoute(nextSession.role) };
  }
  async function logout() {
    setSession(null);
    await learnerClient?.auth.signOut({ scope: "local" });
  }
  return <AuthContext.Provider value={{ session, loading, login, logout, isLoggedIn: !!session }}>
    {children}
  </AuthContext.Provider>;
}
// Existing import contract shares the context hook with its provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() { return useContext(AuthContext); }
