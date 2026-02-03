import type { UserRole } from './roles';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  createdAt: Date;
  lastLoginAt: Date;
  isActive: boolean;
}

export interface UserProfileCreate {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: UserRole;
}

export interface UserProfileUpdate {
  displayName?: string | null;
  photoURL?: string | null;
  role?: UserRole;
  isActive?: boolean;
}

