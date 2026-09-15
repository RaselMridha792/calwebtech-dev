import type { PrismaClient } from '@calwebtech/db';
import {
  CALCULATOR_SETTING_KEYS,
  calculatorLeadAnswers,
  calculatorResultEmail,
  estimateProject,
  presentCalculatorResult,
  type CalculatorAnswers,
  type CalculatorEstimate,
  type CalculatorLeadAnswers,
  type CalculatorResultEmail,
  type LeadSubmission,
  type ValidationErrorResponse,
} from '@calwebtech/shared';
import { BadRequestException, Logger } from '@nestjs/common';
import { calculatorContent } from './calculator.mapper';

const logger = new Logger('CalculatorLead');

export interface CalculatorLeadOutcome {
  answers: CalculatorAnswers;
  /** Recomputed here from the answers. Nothing the browser sends is used as a figure. */
  estimate: CalculatorEstimate;
  /** What `Lead.answers` stores: the eight answers as fields, plus the estimate. */
  stored: CalculatorLeadAnswers;
  /** The emailed copy, or null when the page's copy is missing or no longer valid. */
  email: CalculatorResultEmail | null;
}

/**
 * Turns a calculator submission into the lead's stored answers, the estimate the API
 * stands behind, and the words of the emailed copy.
 *
 * The estimate is computed from the answers every time, so an edited or replayed request
 * cannot claim a price we did not calculate. The email's words come from the page's copy
 * setting, so it repeats what the visitor read; if that copy is missing the estimate is
 * still stored and the visitor still sees the range, and the email falls back to the
 * standard confirmation.
 */
export async function calculatorLeadOutcome(db: PrismaClient, input: LeadSubmission): Promise<CalculatorLeadOutcome> {
  if (!input.answers) {
    const body: ValidationErrorResponse = {
      error: 'validation_failed',
      fieldErrors: { answers: ['Answer all eight questions before asking for an estimate'] },
    };
    throw new BadRequestException(body);
  }

  const answers = input.answers;
  const estimate = estimateProject(answers);
  const outcome: CalculatorLeadOutcome = {
    answers,
    estimate,
    stored: calculatorLeadAnswers(answers, estimate),
    email: null,
  };

  const setting = await db.setting.findUnique({
    where: { key: CALCULATOR_SETTING_KEYS.page },
    select: { value: true },
  });
  try {
    const content = calculatorContent(setting?.value ?? null);
    outcome.email = calculatorResultEmail(presentCalculatorResult(estimate, answers, content), content);
  } catch (error) {
    logger.error(
      `No emailed copy of the estimate: the "${CALCULATOR_SETTING_KEYS.page}" setting is missing or invalid.`,
      error,
    );
  }
  return outcome;
}
