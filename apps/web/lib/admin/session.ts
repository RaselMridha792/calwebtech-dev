import 'server-only';
import { adminUserSchema, canRead, canWrite, type AdminModule, type AdminUser } from '@calwebtech/shared';
import { redirect } from 'next/navigation';
import { forbidden } from 'next/navigation';
import { AdminApiError, adminGet } from './api';

/**
 * Who is signed in, or null. The API decides: the cookie is opaque here, and `/auth/me`
 * is the only thing that can say whether it still stands for a live session.
 */
export async function currentAdmin(): Promise<AdminUser | null> {
  try {
    return await adminGet('/auth/me', adminUserSchema);
  } catch (error) {
    if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

/** Every admin screen starts here. Sends an unauthenticated visitor to sign in. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await currentAdmin();
  if (!user) redirect('/admin/login/');
  return user;
}

/**
 * The screen's own check, so a module a role does not reach is not even rendered. It is
 * the second lock, never the only one: the API applies the same matrix to every route, and
 * that is what actually keeps the data in.
 */
export async function requireModule(module: AdminModule, access: 'read' | 'full' = 'read'): Promise<AdminUser> {
  const user = await requireAdmin();
  const allowed = access === 'full' ? canWrite(user.role, module) : canRead(user.role, module);
  if (!allowed) forbidden();
  return user;
}
