import { z } from 'zod';
import { AI_PROVIDER_IDS } from './ai-providers';

/**
 * The AI connections screen (docs/08-decisions.md, 64): which provider, which model, and a
 * key entered in the dashboard rather than in the server's environment, so it can change
 * without a deploy.
 *
 * A key goes in and never comes back out. Every view carries only its last four characters,
 * so a screenshot, a log line or a compromised browser session cannot recover it.
 */

export const aiProviderIdSchema = z.enum(AI_PROVIDER_IDS);

/** An address for a provider that has none of its own. Checked again, harder, by the API. */
const baseUrlSchema = z
  .url({ protocol: /^https$/, message: 'Use the https:// address the provider gives.' })
  .max(300)
  .transform((value) => value.replace(/\/+$/, ''));

const label = z.string().trim().min(1, 'Give it a name.').max(60);
const model = z.string().trim().min(1, 'Choose or type a model.').max(160);
const apiKey = z
  .string()
  .trim()
  .min(8, 'That is too short to be an API key.')
  .max(500)
  .refine((value) => !/\s/.test(value), 'An API key has no spaces in it.');

export const aiConnectionCreateSchema = z.object({
  provider: aiProviderIdSchema,
  label,
  model,
  baseUrl: baseUrlSchema.optional(),
  apiKey,
  /** Make it the one the site uses. The first connection always is. */
  makeDefault: z.boolean().default(false),
});
export type AiConnectionCreate = z.infer<typeof aiConnectionCreateSchema>;

/** Every field is optional; a key sent here replaces the stored one. */
export const aiConnectionUpdateSchema = z.object({
  label: label.optional(),
  model: model.optional(),
  baseUrl: baseUrlSchema.optional(),
  apiKey: apiKey.optional(),
});
export type AiConnectionUpdate = z.infer<typeof aiConnectionUpdateSchema>;

export const aiTestResultSchema = z.object({
  ok: z.boolean(),
  /** What the model answered, when it answered. */
  text: z.string().nullable(),
  /** The model the provider says it used, which can differ from the one asked for. */
  model: z.string().nullable(),
  latencyMs: z.number().int().min(0),
  usage: z.object({ input: z.number().int().nullable(), output: z.number().int().nullable() }).nullable(),
  /** Why it failed, in words for the screen, with the key never in them. */
  error: z.string().nullable(),
});
export type AiTestResult = z.infer<typeof aiTestResultSchema>;

export const aiConnectionSchema = z.object({
  id: z.string(),
  provider: aiProviderIdSchema,
  label: z.string(),
  model: z.string(),
  baseUrl: z.string().nullable(),
  /** The last four characters, to recognise the key by. */
  keyHint: z.string(),
  /** False when the server can no longer decrypt it, e.g. its secret changed: enter it again. */
  keyReadable: z.boolean(),
  isDefault: z.boolean(),
  lastTest: z
    .object({
      at: z.iso.datetime(),
      ok: z.boolean(),
      latencyMs: z.number().int().nullable(),
      error: z.string().nullable(),
    })
    .nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AiConnection = z.infer<typeof aiConnectionSchema>;

export const adminAiViewSchema = z.object({
  connections: z.array(aiConnectionSchema),
  /**
   * Whether this server can store a key at all: it needs a secret of its own to encrypt with.
   * `source` names which one it uses, so the screen can say so plainly.
   */
  storage: z.object({
    available: z.boolean(),
    source: z.enum(['credentials-key', 'auth-secret']).nullable(),
  }),
});
export type AdminAiView = z.infer<typeof adminAiViewSchema>;

export const aiTestRequestSchema = z.object({
  prompt: z.string().trim().min(1, 'Write something to send.').max(4000),
  system: z.string().trim().max(4000).optional(),
  maxTokens: z.number().int().min(16).max(2048).default(400),
});
export type AiTestRequest = z.infer<typeof aiTestRequestSchema>;

export const aiModelListSchema = z.object({ models: z.array(z.string()) });
export type AiModelList = z.infer<typeof aiModelListSchema>;
