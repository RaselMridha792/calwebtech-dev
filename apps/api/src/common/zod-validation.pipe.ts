import { toFieldErrors, type ValidationErrorResponse } from '@calwebtech/shared';
import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/** Validates a request value against a schema from packages/shared. */
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<TSchema>
> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const body: ValidationErrorResponse = {
        error: 'validation_failed',
        fieldErrors: toFieldErrors(result.error),
      };
      throw new BadRequestException(body);
    }
    return result.data;
  }
}
