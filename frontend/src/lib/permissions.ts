/**
 * Role-Based Access Control (RBAC) System
 * Defines what each role can access in the application
 */

export type Role = "admin" | "auditor" | "analyst";

export type Permission =
  | "view_dashboard"
  | "view_graph"
  | "view_leaderboard"
  | "view_rings"
  | "view_entity_detail"
  | "upload_data"
  | "run_analysis"
  | "manage_data"
  | "clear_data"
  | "create_snapshot"
  | "restore_snapshot"
  | "use_rag_explain"
  | "manage_users"
  | "export_reports";

// Define permissions for each role
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "view_dashboard",
    "view_graph",
    "view_leaderboard",
    "view_rings",
    "view_entity_detail",
    "upload_data",
    "run_analysis",
    "manage_data",
    "clear_data",
    "create_snapshot",
    "restore_snapshot",
    "use_rag_explain",
    "manage_users",
    "export_reports",
  ],
  auditor: [
    "view_dashboard",
    "view_graph",
    "view_leaderboard",
    "view_rings",
    "view_entity_detail",
    "run_analysis",
    "use_rag_explain",
    "export_reports",
  ],
  analyst: [
    "view_dashboard",
    "view_graph",
    "view_leaderboard",
    "view_rings",
    "view_entity_detail",
    "export_reports",
  ],
};

// Role display names and colors
export const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string }> = {
  admin: {
    label: "Administrator",
    color: "#f5a623",
    bg: "rgba(245, 166, 35, 0.15)",
  },
  auditor: {
    label: "Tax Auditor",
    color: "#00d4ff",
    bg: "rgba(0, 212, 255, 0.15)",
  },
  analyst: {
    label: "Analyst",
    color: "#a78bfa",
    bg: "rgba(167, 139, 250, 0.15)",
  },
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has ALL of the specified permissions
 */
export function hasAllPermissions(role: Role | undefined, permissions: Permission[]): boolean {
  if (!role) return false;
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Check if a role has ANY of the specified permissions
 */
export function hasAnyPermission(role: Role | undefined, permissions: Permission[]): boolean {
  if (!role) return false;
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: Role | undefined): Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
}
