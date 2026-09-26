/**
 * The AI providers the dashboard can connect to (docs/08-decisions.md, 64), and how each one
 * is spoken to.
 *
 * On its own, with no Zod import, because the connection form is a client component: through
 * the package's barrel it would carry the whole of Zod into the browser (decision 47). The
 * contract in `admin-ai.ts` builds its enum from this list, so there is one source of truth,
 * and the client imports `@calwebtech/shared/ai-providers`.
 *
 * Three wire protocols cover every provider: Anthropic's Messages API, Google's Gemini API,
 * and the OpenAI chat-completions shape, which most other labs and routers also speak. A
 * provider whose `baseUrl` is null asks for its own address (Azure, or anything else that
 * speaks the OpenAI shape).
 *
 * The model names are suggestions to start from. They age, so the dashboard can also ask a
 * saved connection for the provider's own current list.
 */

export type AiProtocol = 'anthropic' | 'gemini' | 'openai';

/** How the key is sent: a bearer token, or the `api-key` header Azure uses. */
export type AiAuthStyle = 'bearer' | 'api-key';

export interface AiProviderInfo {
  id: string;
  name: string;
  /** One line on what it is, for someone choosing. */
  blurb: string;
  protocol: AiProtocol;
  /** Fixed for a known service; null when the owner supplies the address. */
  baseUrl: string | null;
  /** What the address looks like, when the owner supplies it. */
  baseUrlExample?: string;
  auth: AiAuthStyle;
  /** Where the owner makes a key. */
  keysUrl: string | null;
  /** What a key starts with, to catch a key pasted into the wrong provider. */
  keyPrefix?: string;
  /** What the model field means here, when it is not simply a model name. */
  modelHelp?: string;
  models: readonly string[];
}

export const AI_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    blurb: 'Claude models, strong at careful writing and following instructions.',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    auth: 'bearer',
    keysUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-',
    models: ['claude-sonnet-5', 'claude-opus-5-5', 'claude-haiku-4-5-20251001', 'claude-fable-5-1'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    blurb: 'GPT models from OpenAI.',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    auth: 'bearer',
    keysUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
    models: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini'],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    blurb: 'Gemini models from Google AI Studio.',
    protocol: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    auth: 'bearer',
    keysUrl: 'https://aistudio.google.com/apikey',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    blurb: 'One key for models from many labs, switched by name.',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    auth: 'bearer',
    keysUrl: 'https://openrouter.ai/keys',
    keyPrefix: 'sk-or-',
    models: ['anthropic/claude-sonnet-5', 'openai/gpt-5', 'google/gemini-2.5-flash'],
  },
  {
    id: 'groq',
    name: 'Groq',
    blurb: 'Open models served very fast.',
    protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    auth: 'bearer',
    keysUrl: 'https://console.groq.com/keys',
    keyPrefix: 'gsk_',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    blurb: 'DeepSeek chat and reasoning models.',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    auth: 'bearer',
    keysUrl: 'https://platform.deepseek.com/api_keys',
    keyPrefix: 'sk-',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    blurb: 'Mistral models, hosted in Europe.',
    protocol: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    auth: 'bearer',
    keysUrl: 'https://console.mistral.ai/api-keys',
    models: ['mistral-large-latest', 'mistral-small-latest'],
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    blurb: 'Grok models from xAI.',
    protocol: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    auth: 'bearer',
    keysUrl: 'https://console.x.ai',
    keyPrefix: 'xai-',
    models: ['grok-4', 'grok-3-mini'],
  },
  {
    id: 'together',
    name: 'Together AI',
    blurb: 'Open models such as Llama, Qwen and DeepSeek.',
    protocol: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    auth: 'bearer',
    keysUrl: 'https://api.together.ai/settings/api-keys',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo'],
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    blurb: 'Models that search the web before they answer.',
    protocol: 'openai',
    baseUrl: 'https://api.perplexity.ai',
    auth: 'bearer',
    keysUrl: 'https://www.perplexity.ai/settings/api',
    keyPrefix: 'pplx-',
    models: ['sonar', 'sonar-pro'],
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    blurb: 'Open models on fast inference.',
    protocol: 'openai',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    auth: 'bearer',
    keysUrl: 'https://fireworks.ai/account/api-keys',
    models: ['accounts/fireworks/models/llama-v3p3-70b-instruct'],
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    blurb: 'OpenAI models in your own Azure resource.',
    protocol: 'openai',
    baseUrl: null,
    baseUrlExample: 'https://your-resource.openai.azure.com/openai/v1',
    auth: 'api-key',
    keysUrl: 'https://portal.azure.com',
    modelHelp: 'The name of the deployment in your Azure resource.',
    models: [],
  },
  {
    id: 'custom',
    name: 'Any other service',
    blurb: 'Anything that speaks the OpenAI chat format: give its address and key.',
    protocol: 'openai',
    baseUrl: null,
    baseUrlExample: 'https://api.example.com/v1',
    auth: 'bearer',
    keysUrl: null,
    models: [],
  },
] as const satisfies readonly AiProviderInfo[];

export type AiProviderId = (typeof AI_PROVIDERS)[number]['id'];
export const AI_PROVIDER_IDS = AI_PROVIDERS.map((provider) => provider.id) as [AiProviderId, ...AiProviderId[]];

export function aiProvider(id: string): AiProviderInfo | undefined {
  return AI_PROVIDERS.find((provider) => provider.id === id);
}
