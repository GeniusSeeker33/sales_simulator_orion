import { createContext, useContext, useState } from "react";
import { employees, getEmployeeFullName } from "../data/employees";

const AUTH_SESSION_KEY = "orion-auth-session";

export const ADMIN_EMAILS = [
  "desireethayer1@gmail.com",
  "cfo@orionwholesaleonline.com",
  "controller@orionwholesaleonline.com",
  "ceo@orionwholesaleonline.com",
];

export const MANAGER_EMAILS = [
  "desireethayer1@gmail.com",
  "chase@orionwholesaleonline.com",
  "don@orionwholesaleonline.com",
];

const ADMIN_ACCOUNTS = [
  { email: "desireethayer1@gmail.com", password: "Orion2026!", name: "Desiree Thayer", repCode: null },
  { email: "cfo@orionwholesaleonline.com", password: "OrionCFO2026!", name: "Chief Financial Officer", repCode: null },
  { email: "controller@orionwholesaleonline.com", password: "OrionCtrl2026!", name: "Controller", repCode: null },
  { email: "ceo@orionwholesaleonline.com", password: "OrionCEO2026!", name: "Chief Executive Officer", repCode: null },
];

function resolveRole(email) {
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return "admin";
  if (MANAGER_EMAILS.includes(email.toLowerCase())) return "manager";
  return "rep";
}

function defaultRedirect(role) {
  if (role === "admin") return "/admin-view";
  if (role === "manager") return "/manager-view";
  return "/dashboard";
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(AUTH_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  function login(email, password) {
    const normalized = email.toLowerCase().trim();

    const adminAccount = ADMIN_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === normalized && a.password === password
    );

    if (adminAccount) {
      const role = resolveRole(normalized);
      const s = {
        email: normalized,
        name: adminAccount.name,
        role,
        repCode: adminAccount.repCode,
        hireDate: null,
        loginTime: new Date().toISOString(),
      };
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(s));
      setSession(s);
      return { success: true, role, redirect: defaultRedirect(role) };
    }

    const emp = employees.find((e) => e.email.toLowerCase() === normalized);
    if (emp) {
      const expectedPassword = `${emp.code}@Orion`;
      if (password !== expectedPassword) {
        return { success: false, error: "Invalid email or password." };
      }
      const role = resolveRole(normalized);
      const s = {
        email: normalized,
        name: getEmployeeFullName(emp),
        role,
        repCode: emp.code,
        hireDate: emp.hireDate,
        loginTime: new Date().toISOString(),
      };
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(s));
      setSession(s);
      return { success: true, role, redirect: defaultRedirect(role) };
    }

    return { success: false, error: "Invalid email or password." };
  }

  function logout() {
    localStorage.removeItem(AUTH_SESSION_KEY);
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, login, logout, isLoggedIn: !!session }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
