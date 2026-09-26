import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CredentialBox, decodeCredentialsKey, keyHint } from './credential-box';
import { assertPublicHttps, isPrivate } from './public-url';
import { AiCallError, complete, listModels, redact } from './providers';

const CREDENTIALS_KEY = randomBytes(32).toString('base64');
const AUTH_SECRET = 'a-signing-secret-long-enough';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Encrypting the providers' keys (docs/08-decisions.md, 64). */
describe('the credential box', () => {
  it('seals a key so the database cannot read it, and opens it again', () => {
    const box = new CredentialBox({ CREDENTIALS_KEY, AUTH_SECRET });
    const sealed = box.seal('sk-ant-secret-value', 'anthropic');
    expect(sealed.source).toBe('credentials-key');
    expect(sealed.cipher).not.toContain('secret');
    expect(box.open(sealed.cipher, sealed.source, 'anthropic')).toBe('sk-ant-secret-value');
  });

  it('uses a fresh nonce every time', () => {
    const box = new CredentialBox({ CREDENTIALS_KEY });
    expect(box.seal('same', 'openai').cipher).not.toBe(box.seal('same', 'openai').cipher);
  });

  it('refuses a key moved onto another provider’s row', () => {
    const box = new CredentialBox({ CREDENTIALS_KEY });
    const sealed = box.seal('sk-secret', 'openai');
    expect(box.open(sealed.cipher, sealed.source, 'custom')).toBeNull();
  });

  it('refuses a tampered key and one sealed by another server', () => {
    const box = new CredentialBox({ CREDENTIALS_KEY });
    const sealed = box.seal('sk-secret', 'openai');
    const parts = sealed.cipher.split('.');
    const tampered = [...parts.slice(0, 3), Buffer.from('forged').toString('base64url')].join('.');
    expect(box.open(tampered, sealed.source, 'openai')).toBeNull();
    const other = new CredentialBox({ CREDENTIALS_KEY: randomBytes(32).toString('base64') });
    expect(other.open(sealed.cipher, sealed.source, 'openai')).toBeNull();
  });

  it('falls back to a key derived from AUTH_SECRET, and still opens it once CREDENTIALS_KEY is added', () => {
    const before = new CredentialBox({ AUTH_SECRET });
    const sealed = before.seal('sk-secret', 'groq');
    expect(sealed.source).toBe('auth-secret');
    const after = new CredentialBox({ CREDENTIALS_KEY, AUTH_SECRET });
    expect(after.source()).toBe('credentials-key');
    expect(after.open(sealed.cipher, sealed.source, 'groq')).toBe('sk-secret');
  });

  it('has nothing to seal with when the server has neither secret', () => {
    const box = new CredentialBox({ AUTH_SECRET: 'short' });
    expect(box.source()).toBeNull();
    expect(() => box.seal('sk-secret', 'openai')).toThrow();
  });

  it('accepts only 32 bytes as CREDENTIALS_KEY, and shows four characters of a key', () => {
    expect(decodeCredentialsKey(randomBytes(16).toString('base64'))).toBeNull();
    expect(decodeCredentialsKey(CREDENTIALS_KEY)?.length).toBe(32);
    expect(keyHint('sk-abcdef1234')).toBe('1234');
  });
});

/** A custom provider's address cannot point the API at its own network. */
describe('the address check', () => {
  it('knows the private, loopback and link-local ranges', () => {
    for (const address of ['127.0.0.1', '10.0.0.5', '172.20.1.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
      expect(isPrivate(address), address).toBe(true);
    }
    for (const address of ['8.8.8.8', '104.18.1.1', '2606:4700::1111']) expect(isPrivate(address), address).toBe(false);
  });

  it('refuses http, credentials in the address, local names and private addresses', async () => {
    await expect(assertPublicHttps('http://api.example.com/v1')).rejects.toThrow(/https/);
    await expect(assertPublicHttps('https://user:pass@api.example.com')).rejects.toThrow(/key field/);
    await expect(assertPublicHttps('https://localhost:11434/v1')).rejects.toThrow(/public/);
    await expect(assertPublicHttps('https://db.internal/v1')).rejects.toThrow(/public/);
    await expect(assertPublicHttps('https://169.254.169.254/latest')).rejects.toThrow(/public/);
    await expect(assertPublicHttps('https://[::1]/v1')).rejects.toThrow(/public/);
    await expect(assertPublicHttps('not a url')).rejects.toThrow(/web address/);
  });

  it('accepts a public https address', async () => {
    await expect(assertPublicHttps('https://1.1.1.1/v1')).resolves.toBeInstanceOf(URL);
  });
});

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
}

function stubFetch(status: number, answer: unknown): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      sent.push({
        url,
        headers: init.headers as Record<string, string>,
        body: typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null,
      });
      return Promise.resolve(new Response(JSON.stringify(answer), { status }));
    }),
  );
  return sent;
}

const prompt = { system: 'Be brief.', prompt: 'Say hello.', maxTokens: 64 };

/** Each wire protocol, as the provider documents it, with no network. */
describe('the providers', () => {
  it('speaks the Messages API to Anthropic', async () => {
    const sent = stubFetch(200, {
      model: 'claude-sonnet-5',
      content: [{ type: 'text', text: 'Hello.' }],
      usage: { input_tokens: 9, output_tokens: 3 },
    });
    const reply = await complete({ provider: 'anthropic', model: 'claude-sonnet-5', baseUrl: null, apiKey: 'sk-ant-x' }, prompt);
    expect(reply).toEqual({ text: 'Hello.', model: 'claude-sonnet-5', usage: { input: 9, output: 3 } });
    expect(sent[0]?.url).toBe('https://api.anthropic.com/v1/messages');
    expect(sent[0]?.headers).toMatchObject({ 'x-api-key': 'sk-ant-x', 'anthropic-version': '2023-06-01' });
    expect(sent[0]?.body).toMatchObject({ model: 'claude-sonnet-5', max_tokens: 64, system: 'Be brief.' });
  });

  it('speaks generateContent to Gemini, with the key in its header, not the address', async () => {
    const sent = stubFetch(200, {
      candidates: [{ content: { parts: [{ text: 'Hello' }, { text: ' there.' }] } }],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 },
      modelVersion: 'gemini-2.5-flash',
    });
    const reply = await complete({ provider: 'gemini', model: 'models/gemini-2.5-flash', baseUrl: null, apiKey: 'AIzaKEY' }, prompt);
    expect(reply.text).toBe('Hello there.');
    expect(sent[0]?.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(sent[0]?.url).not.toContain('AIzaKEY');
    expect(sent[0]?.headers['x-goog-api-key']).toBe('AIzaKEY');
    expect(sent[0]?.body).toMatchObject({ systemInstruction: { parts: [{ text: 'Be brief.' }] }, generationConfig: { maxOutputTokens: 64 } });
  });

  it('speaks chat completions to OpenAI and to every service in its shape', async () => {
    const answer = { model: 'gpt-5', choices: [{ message: { content: 'Hi.' } }], usage: { prompt_tokens: 7, completion_tokens: 2 } };
    let sent = stubFetch(200, answer);
    await complete({ provider: 'openai', model: 'gpt-5', baseUrl: null, apiKey: 'sk-x' }, prompt);
    expect(sent[0]?.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(sent[0]?.headers.authorization).toBe('Bearer sk-x');
    expect(sent[0]?.body).toMatchObject({ max_completion_tokens: 64, messages: [{ role: 'system' }, { role: 'user', content: 'Say hello.' }] });

    sent = stubFetch(200, answer);
    await complete({ provider: 'groq', model: 'llama', baseUrl: null, apiKey: 'gsk_x' }, prompt);
    expect(sent[0]?.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(sent[0]?.body).toMatchObject({ max_tokens: 64 });

    sent = stubFetch(200, answer);
    await complete({ provider: 'azure', model: 'my-deployment', baseUrl: 'https://res.openai.azure.com/openai/v1/', apiKey: 'az' }, prompt);
    expect(sent[0]?.url).toBe('https://res.openai.azure.com/openai/v1/chat/completions');
    expect(sent[0]?.headers['api-key']).toBe('az');
    expect(sent[0]?.headers.authorization).toBeUndefined();
  });

  it('turns a refusal into a sentence with the key taken out of it', async () => {
    stubFetch(401, { error: { message: 'Incorrect API key provided: sk-live-abcdef123456.' } });
    const failure = await complete({ provider: 'openai', model: 'gpt-5', baseUrl: null, apiKey: 'sk-live-abcdef123456' }, prompt).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(AiCallError);
    expect((failure as AiCallError).message).toMatch(/refused the key/);
    expect((failure as AiCallError).message).not.toContain('abcdef123456');
  });

  it('lists a provider’s models, text models only for Gemini', async () => {
    stubFetch(200, { data: [{ id: 'gpt-5' }, { id: 'gpt-4.1' }, { id: 'gpt-5' }] });
    expect(await listModels({ provider: 'openai', model: '', baseUrl: null, apiKey: 'k' })).toEqual(['gpt-4.1', 'gpt-5']);
    stubFetch(200, {
      models: [
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
      ],
    });
    expect(await listModels({ provider: 'gemini', model: '', baseUrl: null, apiKey: 'k' })).toEqual(['gemini-2.5-flash']);
  });

  it('takes secret-shaped tokens out of any text it shows', () => {
    expect(redact('bad key sk-proj-ABCDEFGH12345 and AIzaSyA1234567890abcdefghijk', 'nothing')).toBe('bad key [key] and [key]');
  });
});
