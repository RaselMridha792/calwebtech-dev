import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/login-form';
import { CARD } from '@/components/admin/ui/styles';
import { Logo } from '@/components/ui/logo';
import { currentAdmin } from '@/lib/admin/session';

/**
 * Sign in. Outside the shell, because there is nothing to put in a sidebar for someone who
 * is not signed in yet.
 *
 * The design handoff does not cover this screen; it is built from the same tokens as the
 * rest so it does not read as a different product.
 */
export default async function AdminLoginPage() {
  // Already signed in: the form would only be a way to end up back here.
  if (await currentAdmin()) redirect('/admin/leads/');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 sm:px-6">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-8">
        <Logo tone="dark" layout="stacked" height={84} priority />

        <section aria-labelledby="sign-in-title" className={`${CARD} w-full p-6 sm:p-8`}>
          <div className="mb-6 flex flex-col gap-1.5">
            <h1 id="sign-in-title" className="font-display text-[24px] leading-[1.2] font-extrabold tracking-[-0.025em] text-ink-invert">
              Sign in to your dashboard
            </h1>
            <p className="text-[14px] leading-[1.6] text-ink-invert-muted">
              This dashboard is for Calwebtech staff. Every sign-in is recorded.
            </p>
          </div>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
