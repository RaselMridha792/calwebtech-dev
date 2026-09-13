'use client';

import { useCallback, useEffect, useRef } from 'react';
import { loadTurnstile, type TurnstileApi } from '@/lib/turnstile-client';

/** The hidden input Turnstile writes its token into; the server action reads it. */
export const TURNSTILE_FIELD = 'cf-turnstile-response';

/** An interactive challenge needs a person, so give them time. */
const TOKEN_TIMEOUT_MS = 60_000;

interface Waiter {
  resolve: () => void;
  reject: (error: Error) => void;
}

/**
 * One Turnstile widget per form, started on first interaction. `interaction-only` keeps
 * it invisible unless Cloudflare wants the visitor to click.
 */
export function useTurnstile(siteKey: string | undefined, action: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const waitersRef = useRef<Waiter[]>([]);

  const prepare = useCallback(async () => {
    // Read through a function: another call can create the widget while this one awaits.
    const existing = () => widgetRef.current;
    if (!siteKey || existing()) return existing();
    const api = await loadTurnstile();
    const container = containerRef.current;
    if (!container || existing()) return existing();

    const settle = (error?: Error) => {
      const waiters = waitersRef.current;
      waitersRef.current = [];
      for (const waiter of waiters) {
        if (error) waiter.reject(error);
        else waiter.resolve();
      }
    };
    const id = api.render(container, {
      sitekey: siteKey,
      action,
      appearance: 'interaction-only',
      'response-field-name': TURNSTILE_FIELD,
      callback: () => {
        settle();
      },
      'error-callback': () => {
        settle(new Error('The security check failed'));
      },
      'expired-callback': () => {
        const widget = widgetRef.current;
        if (widget) widget.api.reset(widget.id);
      },
    });
    widgetRef.current = { api, id };
    return widgetRef.current;
  }, [siteKey, action]);

  /** Resolves once the form holds a token. Without a site key it resolves at once. */
  const waitForToken = useCallback(
    async (form: HTMLFormElement) => {
      const widget = await prepare();
      if (!widget) return;
      if (form.querySelector<HTMLInputElement>(`input[name="${TURNSTILE_FIELD}"]`)?.value) return;
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          reject(new Error('The security check timed out'));
        }, TOKEN_TIMEOUT_MS);
        waitersRef.current.push({
          resolve: () => {
            window.clearTimeout(timer);
            resolve();
          },
          reject: (error) => {
            window.clearTimeout(timer);
            reject(error);
          },
        });
      });
    },
    [prepare],
  );

  /** Tokens are single use: every attempt the server has seen needs a fresh one. */
  const reset = useCallback(() => {
    const widget = widgetRef.current;
    if (widget) widget.api.reset(widget.id);
  }, []);

  const remove = useCallback(() => {
    const widget = widgetRef.current;
    if (!widget) return;
    widget.api.remove(widget.id);
    widgetRef.current = null;
  }, []);

  useEffect(() => remove, [remove]);

  return { containerRef, prepare, waitForToken, reset, remove };
}
