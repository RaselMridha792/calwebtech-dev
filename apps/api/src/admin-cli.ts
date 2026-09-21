import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { createPrismaClient } from '@calwebtech/db';
import { ADMIN_ROLES, adminPasswordSchema, adminRoleSchema, loginSchema } from '@calwebtech/shared';
import { hashPassword } from './auth/password';

/**
 * Admin accounts, until the team screen exists (docs/12-admin-dashboard.md, M2).
 *
 *   node dist/admin-cli.js create-owner <email> "<name>"
 *   node dist/admin-cli.js set-password <email>
 *   node dist/admin-cli.js list
 *
 * On the server:
 *   docker compose -p calwebtech-production --env-file /srv/calwebtech/env/production.env \
 *     -f /srv/calwebtech/infra/docker-compose.yml exec api node dist/admin-cli.js create-owner ...
 *
 * The password is asked for, never passed as an argument: an argument is visible in
 * `ps`, in the shell history and in the audit of whoever typed it. Piping one in still
 * works for a script, and is the same trade-off made knowingly.
 */

for (const candidate of ['.env', '../../.env']) {
  const file = path.resolve(process.cwd(), candidate);
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

const USAGE = 'usage: admin-cli create-owner <email> "<name>" | set-password <email> | list';

/**
 * Reads a password without echoing it. When stdin is not a terminal — a pipe, a CI step —
 * there is nothing to echo to, so a single line is read instead.
 */
async function askPassword(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin });
    for await (const line of rl) {
      rl.close();
      return line.trim();
    }
    return '';
  }
  process.stdout.write(prompt);
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return await new Promise<string>((resolve) => {
    let value = '';
    const onData = (chunk: string): void => {
      for (const char of chunk) {
        // Enter ends the entry; Ctrl-C abandons it; backspace edits it.
        if (char === '\n' || char === '\r') {
          stdin.removeListener('data', onData);
          stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on('data', onData);
  });
}

async function readNewPassword(): Promise<string> {
  const password = await askPassword('New password: ');
  const parsed = adminPasswordSchema.safeParse(password);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'That password is not acceptable');
  if (process.stdin.isTTY) {
    const again = await askPassword('Repeat it: ');
    if (again !== password) throw new Error('The two entries do not match');
  }
  return password;
}

function normaliseEmail(raw: string | undefined): string {
  const parsed = loginSchema.shape.email.safeParse(raw ?? '');
  if (!parsed.success) throw new Error(`"${raw ?? ''}" is not an email address`);
  return parsed.data;
}

async function main(): Promise<void> {
  const [command, emailArg, nameArg] = process.argv.slice(2);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const db = createPrismaClient(databaseUrl);
  try {
    if (command === 'list') {
      const users = await db.user.findMany({
        orderBy: { createdAt: 'asc' },
        select: { email: true, name: true, role: true, lastLoginAt: true, deletedAt: true },
      });
      if (users.length === 0) {
        console.log('No admin accounts yet. Create the first with: admin-cli create-owner <email> "<name>"');
        return;
      }
      for (const user of users) {
        const last = user.lastLoginAt?.toISOString() ?? 'never';
        console.log(`${user.email}\t${user.role}\t${user.deletedAt ? 'DELETED' : 'active'}\tlast sign-in ${last}\t${user.name}`);
      }
      return;
    }

    if (command === 'create-owner') {
      const email = normaliseEmail(emailArg);
      const name = (nameArg ?? '').trim();
      if (name.length < 2) throw new Error('A name is required: admin-cli create-owner <email> "<name>"');

      // Refused once anyone exists, so this cannot be used to add a second owner quietly
      // on a live system. From then on accounts are made in the team screen, where the
      // change is audited and attributed.
      const existing = await db.user.count();
      if (existing > 0) {
        throw new Error(
          `This database already has ${String(existing)} account(s). Use the team screen, or set-password to recover one.`,
        );
      }

      const password = await readNewPassword();
      const user = await db.user.create({
        data: { email, name, role: adminRoleSchema.parse('OWNER'), passwordHash: await hashPassword(password) },
        select: { id: true, email: true, role: true },
      });
      await db.auditLog.create({
        data: { userId: user.id, action: 'user.created', entityType: 'User', entityId: user.id, after: { email, role: user.role, via: 'admin-cli' } },
      });
      console.log(`Created ${user.email} as ${user.role}. Sign in at /admin.`);
      return;
    }

    if (command === 'set-password') {
      const email = normaliseEmail(emailArg);
      const user = await db.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } });
      if (!user || user.deletedAt) throw new Error(`No active account for ${email}`);
      const password = await readNewPassword();
      await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
      // Every existing session is dropped: a password is reset because the old one may be
      // known, and a session opened with it would outlive the reset.
      const { count } = await db.session.deleteMany({ where: { userId: user.id } });
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: 'user.password_reset',
          entityType: 'User',
          entityId: user.id,
          after: { via: 'admin-cli', sessionsRevoked: count },
        },
      });
      console.log(`Password changed for ${email}. ${String(count)} session(s) signed out.`);
      return;
    }

    throw new Error(`${USAGE}\nroles: ${ADMIN_ROLES.join(', ')}`);
  } finally {
    await db.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
