'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ERROR, INPUT, LABEL, button } from './ui/styles';

/**
 * Signs in against the API on this origin, so the session cookie it sets is first-party.
 * There is no CSRF token to echo yet — this is the request that mints one.
 *
 * Every failure shows the one message the API sends, which is deliberately the same for an
 * unknown address and a wrong password: the form must not become a way to find out who has
 * an account.
 */
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(form: FormData): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      if (response.ok) {
        // The cookie is set by now, so the next server render sees the session. `refresh`
        // is what makes that render happen rather than replaying a cached one.
        router.replace('/admin/leads/');
        router.refresh();
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(
        body.error === 'too_many_attempts'
          ? 'Too many attempts. Wait fifteen minutes and try again.'
          : 'That email address and password do not match an account.',
      );
    } catch {
      setError('The server could not be reached. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void signIn(new FormData(event.currentTarget));
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={LABEL}>
          Email address
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className={INPUT} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={LABEL}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={error ? 'sign-in-error' : undefined}
          className={INPUT}
        />
      </div>

      {error ? (
        <p id="sign-in-error" role="alert" className={`${ERROR} motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]`}>
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={busy} className={`${button('primary')} w-full`}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
