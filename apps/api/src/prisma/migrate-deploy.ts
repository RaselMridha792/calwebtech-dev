import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Applies the committed migrations to `databaseUrl` with the Prisma CLI shipped with the
 * API, and returns the CLI's exit status. `node dist/migrate.js` (migrate.ts) is the
 * release step; the content import test uses it on a database of its own.
 *
 * Prisma 7 reads the database URL only from a config file, and the image has neither
 * dotenv nor TypeScript, so this writes a plain JavaScript config that reads the URL from
 * the environment at load time. The URL itself is never written to disk.
 */
export function migrateDeploy(databaseUrl: string): number {
  const prisma = prismaDirectory();
  const workDirectory = mkdtempSync(path.join(tmpdir(), 'calwebtech-migrate-'));
  const config = path.join(workDirectory, 'prisma.config.mjs');
  writeFileSync(
    config,
    [
      'export default {',
      `  schema: ${JSON.stringify(path.join(prisma, 'schema.prisma'))},`,
      `  migrations: { path: ${JSON.stringify(path.join(prisma, 'migrations'))} },`,
      '  datasource: { url: process.env.DATABASE_URL },',
      '};',
      '',
    ].join('\n'),
  );

  // The CLI's own entry point, run with this Node: no shell, the same on Linux and Windows.
  const cli = prismaCli();
  try {
    const result = spawnSync(process.execPath, [cli, 'migrate', 'deploy', '--config', config], {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    });
    if (result.error) throw result.error;
    return result.status ?? 1;
  } finally {
    rmSync(workDirectory, { recursive: true, force: true });
  }
}

/** The image carries prisma/ next to dist/; a checkout has it in packages/db. */
function prismaDirectory(): string {
  const candidates = [
    path.resolve(__dirname, '../../prisma'),
    path.resolve(__dirname, '../prisma'),
    path.resolve(__dirname, '../../../../packages/db/prisma'),
    path.resolve(__dirname, '../../../packages/db/prisma'),
  ];
  const found = candidates.find((directory) => existsSync(path.join(directory, 'schema.prisma')));
  if (!found) throw new Error(`migrate: no schema.prisma in ${candidates.join(' or ')}`);
  return found;
}

function prismaCli(): string {
  const candidates = [
    path.resolve(__dirname, '../../node_modules/prisma/build/index.js'),
    path.resolve(__dirname, '../node_modules/prisma/build/index.js'),
    path.resolve(__dirname, '../../../node_modules/prisma/build/index.js'),
  ];
  const found = candidates.find((file) => existsSync(file));
  if (!found) throw new Error(`migrate: Prisma CLI not found at ${candidates.join(' or ')}`);
  return found;
}
