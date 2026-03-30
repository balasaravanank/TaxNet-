import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { hasPermission, type Role, type Permission } from "./permissions";

interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = "/api";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem("auth_token");
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setToken(storedToken);
        } else {
          // Token invalid, clear it
          localStorage.removeItem("auth_token");
          setToken(null);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        localStorage.removeItem("auth_token");
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return null;
      }

      localStorage.setItem("auth_token", data.token);
      setToken(data.token);
      setUser(data.user);
      setLoading(false);
      return data.user;
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error("Logout request failed:", err);
      }
    }
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
  }, [token]);

  const can = useCallback(
    (permission: Permission) => {
      return hasPermission(user?.role, permission);
    },
    [user]
  );

  const value: AuthContextType = {
    user,
    token,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
    can,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Higher-order component for protected routes
export function RequireAuth({
  children,
  roles,
  fallback,
}: {
  children: React.ReactNode;
  roles?: string[];
  fallback?: React.ReactNode;
}) {
  const { isAuthenticated, hasRole, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#05080f",
          color: "#00d4ff",
          fontFamily: "'DM Mono', monospace",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback ? <>{fallback}</> : null;
  }

  if (roles && !hasRole(roles)) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#05080f",
          color: "#ff4757",
          fontFamily: "'DM Mono', monospace",
          textAlign: "center",
          padding: "20px",
        }}
      >
        <h2 style={{ fontSize: "24px", marginBottom: "12px" }}>Access Denied</h2>
        <p style={{ color: "#8fa3c0" }}>You don't have permission to access this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
