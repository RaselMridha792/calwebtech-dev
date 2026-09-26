import { z } from 'zod';

/**
 * Identity, sessions and RBAC for the admin (docs/12-admin-dashboard.md).
 *
 * The API owns all of this: Argon2id hashes, first-party httpOnly session cookies, and a
 * permission matrix enforced server-side on every route. The admin UI imports the same
 * matrix only to decide what to render; it is never the thing that grants access.
 */

// ---------------------------------------------------------------- roles

/** Mirrors the `Role` enum in prisma/schema.prisma. */
export const ADMIN_ROLES = ['OWNER', 'EDITOR', 'SALES', 'VIEWER'] as const;
export const adminRoleSchema = z.enum(ADMIN_ROLES);
export type AdminRole = z.infer<typeof adminRoleSchema>;

/** The dashboard's modules, as listed in docs/12-admin-dashboard.md. */
export const ADMIN_MODULES = [
  'overview',
  'leads',
  'bookings',
  'subscribers',
  'campaigns',
  'content',
  'media',
  'pageSections',
  'formsRouting',
  'team',
  'settings',
  'auditLog',
  'export',
  'ai',
] as const;
export const adminModuleSchema = z.enum(ADMIN_MODULES);
export type AdminModule = z.infer<typeof adminModuleSchema>;

/**
 * `read` reaches the listing and the detail with every write refused; `full` also writes.
 * A module a role is not listed for is unreachable, so a new module is closed to everyone
 * but the owner until it is added here deliberately.
 */
export type AdminAccess = 'full' | 'read';

const PERMISSIONS: Record<AdminModule, Partial<Record<AdminRole, AdminAccess>>> = {
  overview: { OWNER: 'full', EDITOR: 'full', SALES: 'full', VIEWER: 'read' },
  leads: { OWNER: 'full', SALES: 'full', VIEWER: 'read' },
  bookings: { OWNER: 'full', SALES: 'full', VIEWER: 'read' },
  subscribers: { OWNER: 'full', SALES: 'full', VIEWER: 'read' },
  campaigns: { OWNER: 'full', SALES: 'full', VIEWER: 'read' },
  content: { OWNER: 'full', EDITOR: 'full', VIEWER: 'read' },
  media: { OWNER: 'full', EDITOR: 'full', VIEWER: 'read' },
  pageSections: { OWNER: 'full', EDITOR: 'full', VIEWER: 'read' },
  formsRouting: { OWNER: 'full', EDITOR: 'full', VIEWER: 'read' },
  team: { OWNER: 'full' },
  settings: { OWNER: 'full' },
  auditLog: { OWNER: 'full' },
  // A VIEWER cannot export: it would hand them the lead addresses the listing redacts.
  export: { OWNER: 'full', EDITOR: 'full', SALES: 'full' },
  // The AI providers' keys: whoever holds them spends the business's money (decision 64).
  ai: { OWNER: 'full' },
};

/** What this role may do in this module, or null when the module is closed to it. */
export function accessTo(role: AdminRole, module: AdminModule): AdminAccess | null {
  return PERMISSIONS[module][role] ?? null;
}

export function canRead(role: AdminRole, module: AdminModule): boolean {
  return accessTo(role, module) !== null;
}

export function canWrite(role: AdminRole, module: AdminModule): boolean {
  return accessTo(role, module) === 'full';
}

/** Every module this role reaches, for the sidebar and for the RBAC test. */
export function modulesFor(role: AdminRole): AdminModule[] {
  return ADMIN_MODULES.filter((module) => canRead(role, module));
}

// ---------------------------------------------------------------- sign in

/**
 * The password rule applies when a password is *set*, not when one is checked: a rule on
 * sign-in would tell an attacker which guesses are worth making, and would lock out an
 * account whose password predates the rule.
 */
export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_PASSWORD_MAX_LENGTH = 200;

export const adminPasswordSchema = z
  .string()
  .min(ADMIN_PASSWORD_MIN_LENGTH, `Use at least ${String(ADMIN_PASSWORD_MIN_LENGTH)} characters`)
  .max(ADMIN_PASSWORD_MAX_LENGTH, 'That password is too long');

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email({ error: 'Enter a valid email address' })),
  // Checked against the stored hash, never against a shape.
  password: z.string().min(1, 'Enter your password').max(ADMIN_PASSWORD_MAX_LENGTH),
});
export type LoginRequest = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------- views

/** The signed-in user, as `GET /auth/me` answers it. No hash, ever. */
export const adminUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  role: adminRoleSchema,
  avatar: z.string().nullable(),
  lastLoginAt: z.iso.datetime().nullable(),
  /** Derived from the matrix above so the UI never has its own copy of the rules. */
  modules: z.array(adminModuleSchema),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

/** One of the sessions the account can see and revoke. */
export const adminSessionSchema = z.object({
  id: z.string(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  /** The session making the request, which the UI labels and refuses to revoke silently. */
  current: z.boolean(),
});
export type AdminSession = z.infer<typeof adminSessionSchema>;

// ---------------------------------------------------------------- errors

/**
 * Sign-in answers one message whatever went wrong — unknown address, wrong password,
 * disabled account — so the endpoint cannot be used to discover who has an account.
 */
export const AUTH_ERRORS = {
  invalidCredentials: 'invalid_credentials',
  rateLimited: 'too_many_attempts',
  unauthenticated: 'unauthenticated',
  forbidden: 'forbidden',
  csrfFailed: 'csrf_failed',
} as const;

export type AuthErrorCode = (typeof AUTH_ERRORS)[keyof typeof AUTH_ERRORS];

export const authErrorSchema = z.object({
  error: z.enum([
    AUTH_ERRORS.invalidCredentials,
    AUTH_ERRORS.rateLimited,
    AUTH_ERRORS.unauthenticated,
    AUTH_ERRORS.forbidden,
    AUTH_ERRORS.csrfFailed,
  ]),
  message: z.string().optional(),
});
export type AuthError = z.infer<typeof authErrorSchema>;

// ---------------------------------------------------------------- cookies

/**
 * Re-exported so server code can keep taking everything from one import. The definitions
 * live in their own zod-free module because client components need them; see the note
 * there before moving them back.
 */
export {
  CSRF_COOKIE,
  CSRF_COOKIE_INSECURE,
  CSRF_HEADER,
  SESSION_COOKIE,
  SESSION_COOKIE_INSECURE,
} from './auth-cookies';
