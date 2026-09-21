import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/login-form';
import { Wordmark } from '@/components/admin/wordmark';
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
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-[340px]">
        <div className="mb-7 flex flex-col gap-2">
          <Wordmark />
          <h1 className="font-display text-[19px] font-bold tracking-[-0.015em] text-admin-ink">Sign in</h1>
          <p className="text-[12.5px] text-admin-body">
            This dashboard is for Calwebtech staff. Every sign-in is recorded.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
