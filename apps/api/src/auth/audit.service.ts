import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { writeAudit, type AuditEntry } from './audit-writer';

export type { AuditEntry } from './audit-writer';

/**
 * The audit log CLAUDE.md requires on every admin login, content change, lead status
 * change, export and campaign send.
 *
 * The dashboard writes through `AuditService`; `settings-cli`, which runs without the API,
 * writes through `writeAudit`, the same function underneath (decision 68), so both land in
 * one log and read alike on the audit screen.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Throws if the entry cannot be written. A mutation that must be audited should fail
   * rather than happen unrecorded, so callers that mean that await this and let it throw.
   */
  async record(entry: AuditEntry): Promise<void> {
    await writeAudit(this.prisma.client, entry);
  }

  /**
   * For entries that must not be able to break the thing they describe: nobody should be
   * locked out because the audit table is unwritable. The failure is logged loudly instead.
   */
  async recordQuietly(entry: AuditEntry): Promise<void> {
    try {
      await this.record(entry);
    } catch (error) {
      this.logger.error(`Audit entry "${entry.action}" could not be written`, error);
    }
  }
}
