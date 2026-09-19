import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Prisma, PrismaClient } from '../generated/prisma/client';

/**
 * What an importer (index.ts) works with: the database, and the snapshots in
 * apps/web/static-content read and validated with the same view schemas the web app
 * renders them with. An importer never embeds copy; it reads the JSON at run time.
 */

export interface Parser<T> {
  parse(input: unknown): T;
}

export interface ImportContext {
  readonly db: PrismaClient;
  /** The snapshot directory (apps/web/static-content, or its copy in the API image). */
  readonly dir: string;
  log(line: string): void;
  /** A snapshot file, parsed and validated with its view schema. */
  read<T>(relPath: string, schema: Parser<T>): T;
  /** Anything JSON-serialisable as a Prisma JSON input, with `undefined` stripped. */
  json(value: unknown): Prisma.InputJsonValue;
  /** Creates or replaces a setting. */
  setSetting(key: string, value: unknown): Promise<void>;
  /** Creates a setting only when none exists, so a value a person set since survives. */
  setSettingOnce(key: string, value: unknown): Promise<void>;
}

export function createImportContext(db: PrismaClient, dir: string, log: (line: string) => void): ImportContext {
  const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  return {
    db,
    dir,
    log,
    read(relPath, schema) {
      const file = path.join(dir, relPath);
      if (!existsSync(file)) throw new Error(`import: snapshot ${relPath} is missing under ${dir}`);
      try {
        return schema.parse(JSON.parse(readFileSync(file, 'utf8')));
      } catch (error) {
        throw new Error(`import: snapshot ${relPath} does not match its view schema: ${String(error)}`);
      }
    },
    json,
    async setSetting(key, value) {
      const stored = json(value);
      await db.setting.upsert({ where: { key }, create: { key, value: stored }, update: { value: stored } });
    },
    async setSettingOnce(key, value) {
      const row = await db.setting.findUnique({ where: { key }, select: { id: true } });
      if (!row) await db.setting.create({ data: { key, value: json(value) } });
    },
  };
}
