import { aiProvider, type AiProviderInfo } from '@calwebtech/shared';

/**
 * How the API talks to each AI provider (docs/08-decisions.md, 64). Three wire protocols
 * cover all of them: Anthropic's Messages API, Google's Gemini API, and the OpenAI
 * chat-completions shape that most other labs and routers speak too.
 *
 * Plain `fetch`, no SDKs: three small request shapes are not worth three dependencies, and
 * one code path is easier to keep honest about timeouts and about never logging a key.
 */

export interface AiTarget {
  provider: string;
  model: string;
  baseUrl: string | null;
  apiKey: string;
}

export interface AiPrompt {
  system?: string | undefined;
  prompt: string;
  maxTokens: number;
}

export interface AiCompletion {
  text: string;
  model: string | null;
  usage: { input: number | null; output: number | null } | null;
}

/** A failure with a sentence fit for the screen. The key is never in it. */
export class AiCallError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 45_000;
const MAX_BODY = 2_000_000;

export async function complete(target: AiTarget, prompt: AiPrompt): Promise<AiCompletion> {
  const info = providerInfo(target.provider);
  const base = baseUrl(info, target);
  switch (info.protocol) {
    case 'anthropic': {
      const body = await call(target, info, `${base}/messages`, {
        model: target.model,
        max_tokens: prompt.maxTokens,
        ...(prompt.system ? { system: prompt.system } : {}),
        messages: [{ role: 'user', content: prompt.prompt }],
      });
      const content = array(field(body, 'content'));
      const text = content
        .map((part) => (field(part, 'type') === 'text' ? string(field(part, 'text')) : ''))
        .join('')
        .trim();
      const usage = field(body, 'usage');
      return {
        text,
        model: string(field(body, 'model')) || null,
        usage: { input: int(field(usage, 'input_tokens')), output: int(field(usage, 'output_tokens')) },
      };
    }
    case 'gemini': {
      const body = await call(target, info, `${base}/models/${encodeURIComponent(stripModelsPrefix(target.model))}:generateContent`, {
        contents: [{ role: 'user', parts: [{ text: prompt.prompt }] }],
        ...(prompt.system ? { systemInstruction: { parts: [{ text: prompt.system }] } } : {}),
        generationConfig: { maxOutputTokens: prompt.maxTokens },
      });
      const candidate = array(field(body, 'candidates'))[0];
      const parts = array(field(field(candidate, 'content'), 'parts'));
      const text = parts.map((part) => string(field(part, 'text'))).join('').trim();
      const usage = field(body, 'usageMetadata');
      return {
        text,
        model: string(field(body, 'modelVersion')) || null,
        usage: { input: int(field(usage, 'promptTokenCount')), output: int(field(usage, 'candidatesTokenCount')) },
      };
    }
    case 'openai': {
      // OpenAI's own API wants `max_completion_tokens` (its reasoning models refuse the older
      // name); every other service in this shape still reads `max_tokens`.
      const limit = info.id === 'openai' ? { max_completion_tokens: prompt.maxTokens } : { max_tokens: prompt.maxTokens };
      const body = await call(target, info, `${base}/chat/completions`, {
        model: target.model,
        ...limit,
        messages: [
          ...(prompt.system ? [{ role: 'system', content: prompt.system }] : []),
          { role: 'user', content: prompt.prompt },
        ],
      });
      const choice = array(field(body, 'choices'))[0];
      const content = field(field(choice, 'message'), 'content');
      const text = (typeof content === 'string' ? content : array(content).map((part) => string(field(part, 'text'))).join('')).trim();
      const usage = field(body, 'usage');
      return {
        text,
        model: string(field(body, 'model')) || null,
        usage: { input: int(field(usage, 'prompt_tokens')), output: int(field(usage, 'completion_tokens')) },
      };
    }
  }
}

/** The provider's own list of models this key can use, newest names as the provider gives them. */
export async function listModels(target: AiTarget): Promise<string[]> {
  const info = providerInfo(target.provider);
  const base = baseUrl(info, target);
  const body =
    info.protocol === 'gemini'
      ? await call(target, info, `${base}/models?pageSize=200`, null)
      : await call(target, info, `${base}/models${info.protocol === 'anthropic' ? '?limit=200' : ''}`, null);
  const entries = info.protocol === 'gemini' ? array(field(body, 'models')) : array(field(body, 'data'));
  const names = entries
    .filter((entry) => {
      if (info.protocol !== 'gemini') return true;
      // Only the models that write text, not the embedding and image ones.
      return array(field(entry, 'supportedGenerationMethods')).includes('generateContent');
    })
    .map((entry) => (info.protocol === 'gemini' ? stripModelsPrefix(string(field(entry, 'name'))) : string(field(entry, 'id'))))
    .filter(Boolean);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

function providerInfo(id: string): AiProviderInfo {
  const info = aiProvider(id);
  if (!info) throw new AiCallError('That provider is not one this dashboard knows.');
  return info;
}

function baseUrl(info: AiProviderInfo, target: AiTarget): string {
  const base = info.baseUrl ?? target.baseUrl;
  if (!base) throw new AiCallError('This connection needs the provider’s address.');
  return base.replace(/\/+$/, '');
}

function stripModelsPrefix(model: string): string {
  return model.replace(/^models\//, '');
}

async function call(target: AiTarget, info: AiProviderInfo, url: string, body: unknown): Promise<unknown> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== null) headers['content-type'] = 'application/json';
  if (info.protocol === 'anthropic') {
    headers['x-api-key'] = target.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (info.protocol === 'gemini') {
    headers['x-goog-api-key'] = target.apiKey;
  } else if (info.auth === 'api-key') {
    headers['api-key'] = target.apiKey;
  } else {
    headers.authorization = `Bearer ${target.apiKey}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: body === null ? 'GET' : 'POST',
      headers,
      ...(body === null ? {} : { body: JSON.stringify(body) }),
      // A provider is never allowed to bounce the request, and the key, somewhere else.
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new AiCallError(
      timedOut ? 'The provider took too long to answer.' : 'Could not reach the provider. Check the address and the server’s connection.',
    );
  }

  const raw = await response.text();
  if (raw.length > MAX_BODY) throw new AiCallError('The provider sent back far more than expected.', response.status);
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const detail = redact(providerMessage(parsed) ?? raw.slice(0, 200), target.apiKey);
    throw new AiCallError(`${plainStatus(response.status)}${detail ? ` The provider said: “${detail}”` : ''}`, response.status);
  }
  if (parsed === null) throw new AiCallError('The provider answered with something that is not JSON.', response.status);
  return parsed;
}

function plainStatus(status: number): string {
  if (status === 401 || status === 403) return 'The provider refused the key. Check that it is right and still active.';
  if (status === 404) return 'The provider does not know that model or address.';
  if (status === 400 || status === 422) return 'The provider did not accept the request.';
  if (status === 402 || status === 429) return 'The provider is limiting requests, or the account is out of credit.';
  if (status >= 500) return 'The provider had a problem on its side. Try again in a minute.';
  return `The provider answered with an error (${String(status)}).`;
}

/** The human part of an error body, in whichever shape this provider uses. */
function providerMessage(body: unknown): string | null {
  const error = field(body, 'error');
  const message = string(field(error, 'message')) || string(error) || string(field(body, 'message'));
  return message ? message.slice(0, 300) : null;
}

/** Takes the key, and anything shaped like a secret token, out of text that will be shown. */
export function redact(text: string, key: string): string {
  let out = text;
  if (key) out = out.split(key).join('[key]');
  return out.replace(/\b(sk|pk|rk|gsk|xai|pplx)[-_][A-Za-z0-9_-]{8,}/g, '[key]').replace(/AIza[0-9A-Za-z_-]{20,}/g, '[key]');
}

// ---------------------------------------------------------------- reading unknown JSON

function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[name] : undefined;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function int(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}
