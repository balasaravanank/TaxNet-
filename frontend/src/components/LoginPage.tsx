import React, { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { ShieldIcon } from "./Icons";

export function LoginPage() {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    
    if (!email || !password) {
      setLocalError("Please enter email and password");
      return;
    }
    
    await login(email, password);
  };

  const fillDemo = (role: "admin" | "auditor" | "analyst") => {
    const creds = {
      admin: { email: "admin@cbic.gov.in", password: "Admin@2026" },
      auditor: { email: "auditor@cbic.gov.in", password: "Audit@2026" },
      analyst: { email: "analyst@gst.gov.in", password: "Analyst@2026" },
    };
    setEmail(creds[role].email);
    setPassword(creds[role].password);
  };

  const displayError = error || localError;

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <ShieldIcon size={32} color="var(--primary)" />
        </div>

        <h1 className="login-title">TaxNet</h1>
        <p className="login-subtitle">AI-Powered GST Fraud Detection</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {displayError && (
            <div className="login-error">{displayError}</div>
          )}

          <button type="submit" className="btn btn--primary login-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Demo Credentials */}
        <div className="demo-box">
          <p className="demo-title">Demo Accounts</p>
          <div className="demo-buttons">
            <button type="button" onClick={() => fillDemo("admin")} className="demo-btn">
              Admin
            </button>
            <button type="button" onClick={() => fillDemo("auditor")} className="demo-btn">
              Auditor
            </button>
            <button type="button" onClick={() => fillDemo("analyst")} className="demo-btn">
              Analyst
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-base);
          padding: 20px;
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 40px 32px;
          text-align: center;
        }

        .login-logo {
          width: 64px;
          height: 64px;
          background: var(--primary-light);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
        }

        .login-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .login-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
          margin-bottom: 32px;
        }

        .login-form {
          text-align: left;
        }

        .login-form .form-group {
          margin-bottom: 20px;
        }

        .login-form label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .login-form input {
          width: 100%;
          padding: 12px 16px;
          background: var(--bg-base);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .login-form input:focus {
          border-color: var(--primary);
        }

        .login-form input::placeholder {
          color: var(--text-muted);
        }

        .login-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--error);
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 20px;
        }

        .login-btn {
          width: 100%;
          padding: 14px;
          font-size: 15px;
          font-weight: 600;
        }

        .demo-box {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid var(--border);
        }

        .demo-title {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .demo-buttons {
          display: flex;
          gap: 8px;
          justify-content: center;
        }

        .demo-btn {
          padding: 8px 16px;
          background: var(--bg-base);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .demo-btn:hover {
          border-color: var(--primary);
          color: var(--primary);
        }
      `}</style>
    </div>
  );
}
