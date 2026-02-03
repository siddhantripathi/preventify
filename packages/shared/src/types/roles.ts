export const USER_ROLES = ['doctor', 'nurse', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && USER_ROLES.includes(role as UserRole);
}

