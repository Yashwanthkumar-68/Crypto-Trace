import React from 'react';
import { User, UserRole } from '../../types';

export interface RequireRoleProps {
  allowedRoles: (UserRole | string)[];
  currentUser?: User | null;
  children: React.ReactNode;
}

/**
 * Reusable Role-Based Access Control (RBAC) Wrapper Component.
 * Evaluates whether currentUser has one of the allowed roles.
 * Supports explicit `currentUser` prop with graceful fallback to `localStorage.getItem('sih_user')`.
 * Renders `children` if authorized, or returns `null` to securely hide unauthorized UI.
 */
export const RequireRole: React.FC<RequireRoleProps> = ({
  allowedRoles,
  currentUser,
  children,
}) => {
  let user = currentUser;

  // Graceful fallback to persistent auth storage if prop is omitted
  if (user === undefined && typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('sih_user');
      user = saved ? JSON.parse(saved) : null;
    } catch {
      user = null;
    }
  }

  if (!user || !user.role) {
    return null;
  }

  const hasAccess = allowedRoles.includes(user.role);

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
};

export default RequireRole;
