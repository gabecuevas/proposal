export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

const roleRank: Record<WorkspaceRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

export function hasRole(required: WorkspaceRole, actual: WorkspaceRole): boolean {
  return roleRank[actual] >= roleRank[required];
}
