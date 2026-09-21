'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="h-[38px] rounded-[4px] border border-admin-line bg-admin-sunken px-3 text-[13px] text-admin-ink outline-none focus-visible:border-admin-focus"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={error ? 'sign-in-error' : undefined}
          className="h-[38px] rounded-[4px] border border-admin-line bg-admin-sunken px-3 text-[13px] text-admin-ink outline-none focus-visible:border-admin-focus"
        />
      </div>

      {error ? (
        <p id="sign-in-error" role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="h-[38px] rounded-[4px] bg-primary text-[12.5px] font-semibold text-white hover:bg-admin-primaryh disabled:opacity-40"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
