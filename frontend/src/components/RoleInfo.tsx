import React from "react";
import { useAuth } from "../lib/AuthContext";
import { ROLE_CONFIG, getPermissions } from "../lib/permissions";
import { ShieldIcon, UserIcon, CheckCircleIcon } from "./Icons";

export function RoleInfo() {
  const { user, can } = useAuth();
  
  if (!user) return null;

  const config = ROLE_CONFIG[user.role];
  const permissions = getPermissions(user.role);

  const featureGroups = [
    {
      name: "Dashboard Access",
      features: [
        { name: "View Dashboard", permission: "view_dashboard" as const },
        { name: "View Network Graph", permission: "view_graph" as const },
        { name: "View Leaderboard", permission: "view_leaderboard" as const },
        { name: "View Fraud Rings", permission: "view_rings" as const },
      ]
    },
    {
      name: "Data Operations", 
      features: [
        { name: "Upload CSV Data", permission: "upload_data" as const },
        { name: "Run Analysis", permission: "run_analysis" as const },
        { name: "Clear Database", permission: "clear_data" as const },
        { name: "Manage Snapshots", permission: "create_snapshot" as const },
      ]
    },
    {
      name: "Advanced Features",
      features: [
        { name: "AI Explanations", permission: "use_rag_explain" as const },
        { name: "User Management", permission: "manage_users" as const },
        { name: "Export Reports", permission: "export_reports" as const },
      ]
    }
  ];

  return (
    <div className="role-info">
      {/* Header */}
      <div className="role-header">
        <div className="role-avatar" style={{ background: config.bg }}>
          <UserIcon size={24} color={config.color} />
        </div>
        <div className="role-details">
          <h3 className="role-name">{config.label}</h3>
          <p className="role-email">{user.email}</p>
          <div className="role-badge" style={{ background: config.bg, color: config.color }}>
            {user.role.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <div className="capabilities">
        <h4 className="capabilities-title">Your Access Level</h4>
        {featureGroups.map(group => (
          <div key={group.name} className="feature-group">
            <h5 className="feature-group-title">{group.name}</h5>
            <div className="features">
              {group.features.map(feature => {
                const hasAccess = can(feature.permission);
                return (
                  <div key={feature.name} className={`feature ${hasAccess ? 'enabled' : 'disabled'}`}>
                    <CheckCircleIcon 
                      size={16} 
                      color={hasAccess ? "var(--green)" : "var(--text-muted)"} 
                    />
                    <span>{feature.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .role-info {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          max-width: 400px;
        }

        .role-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }

        .role-avatar {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .role-details {
          flex: 1;
        }

        .role-name {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 4px 0;
        }

        .role-email {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0 0 8px 0;
        }

        .role-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.05em;
        }

        .capabilities-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 16px 0;
        }

        .feature-group {
          margin-bottom: 20px;
        }

        .feature-group:last-child {
          margin-bottom: 0;
        }

        .feature-group-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          margin: 0 0 8px 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .features {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .feature {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          padding: 6px 0;
        }

        .feature.enabled {
          color: var(--text-primary);
        }

        .feature.disabled {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}