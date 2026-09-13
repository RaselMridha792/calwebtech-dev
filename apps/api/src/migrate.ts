import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Applies committed migrations: `node dist/migrate.js`.
 *
 * The release workflow runs it as a one-off container from the new API image before the
 * rollout (docs/01-architecture.md, Deployment). Prisma 7 reads the database URL only from
 * a config file, and the image has neither dotenv nor TypeScript, so this writes a plain
 * JavaScript config that reads DATABASE_URL at load time and runs the Prisma CLI shipped
 * with the image. The URL itself is never written to disk.
 */

for (const candidate of ['.env', '../../.env']) {
  const file = path.resolve(process.cwd(), candidate);
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

/** The image carries prisma/ next to dist/; a checkout has it in packages/db. */
function prismaDirectory(): string {
  const candidates = [path.resolve(__dirname, '../prisma'), path.resolve(__dirname, '../../../packages/db/prisma')];
  const found = candidates.find((directory) => existsSync(path.join(directory, 'schema.prisma')));
  if (!found) throw new Error(`migrate: no schema.prisma in ${candidates.join(' or ')}`);
  return found;
}

function main(): number {
  if (!process.env.DATABASE_URL) throw new Error('migrate: DATABASE_URL is required');

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
  const cli = path.resolve(__dirname, '../node_modules/prisma/build/index.js');
  if (!existsSync(cli)) throw new Error(`migrate: Prisma CLI not found at ${cli}`);
  try {
    const result = spawnSync(process.execPath, [cli, 'migrate', 'deploy', '--config', config], {
      stdio: 'inherit',
      env: { ...process.env, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    });
    if (result.error) throw result.error;
    return result.status ?? 1;
  } finally {
    rmSync(workDirectory, { recursive: true, force: true });
  }
}

process.exitCode = main();
