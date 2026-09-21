'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';

/**
 * Team and roles (docs/12-admin-dashboard.md, module 10).
 *
 * The rules that matter — nobody changes their own role, nobody disables themselves, and
 * the last active owner cannot be demoted or disabled — are enforced by the API. This
 * screen only declines to offer what the API would refuse, so a stale page cannot do harm.
 */
export interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  lastLoginAt: string | null;
  activeSessions: number;
  disabledAt: string | null;
  isSelf: boolean;
}

export function TeamPanel({ members, roles }: { members: Member[]; roles: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  function run(id: string, path: string, init: { method: 'POST' | 'PATCH'; body?: unknown }): void {
    setBusy(id);
    setError(null);
    void adminMutate(path, init)
      .then(() => {
        router.refresh();
      })
      .catch((cause: unknown) => {
        setError(cause instanceof MutationError ? cause.message : 'That could not be applied.');
      })
      .finally(() => {
        setBusy(null);
      });
  }

  return (
    <div className="flex flex-col gap-6">
      <InviteForm
        roles={roles}
        onCreated={(email, password) => {
          setCreated({ email, password });
          router.refresh();
        }}
        onError={setError}
      />

      {created ? (
        <div role="status" className="rounded-[4px] border border-admin-line bg-admin-sunken p-3">
          <p className="text-[12.5px] font-semibold text-admin-ink">
            Account created for {created.email}
          </p>
          <p className="mt-1 text-[12px] text-admin-body">
            There is no invitation email yet, so pass this first password on yourself. It is shown once and cannot be
            read again — if it is lost, reset it with <code>admin-cli set-password</code> on the server.
          </p>
          <p className="mt-2 rounded-[3px] bg-admin-surface px-2 py-1.5 font-mono text-[13px] break-all text-admin-ink">
            {created.password}
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex flex-wrap items-center gap-3 border-b border-admin-line py-3 first:border-t first:border-admin-line"
          >
            <div className="min-w-[200px] flex-1">
              <p className="text-[13px] font-semibold text-admin-ink">
                {member.name}
                {member.isSelf ? <span className="ml-2 text-[11px] font-normal text-admin-muted">you</span> : null}
                {member.disabledAt ? <span className="ml-2 text-[11px] font-normal text-danger">disabled</span> : null}
              </p>
              <p className="text-[11.5px] text-admin-muted">
                {member.email} · {member.activeSessions} open{' '}
                {member.activeSessions === 1 ? 'session' : 'sessions'} ·{' '}
                {member.lastLoginAt
                  ? `last signed in ${new Date(member.lastLoginAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}`
                  : 'never signed in'}
              </p>
            </div>

            <label className="sr-only" htmlFor={`role-${member.id}`}>
              Role for {member.name}
            </label>
            <select
              id={`role-${member.id}`}
              value={member.role}
              disabled={member.isSelf || busy === member.id || Boolean(member.disabledAt)}
              onChange={(event) => {
                run(member.id, `/admin/team/${encodeURIComponent(member.id)}/role`, {
                  method: 'PATCH',
                  body: { role: event.target.value },
                });
              }}
              className="h-[29px] rounded-[4px] border border-admin-line bg-admin-surface px-2 text-[12px] text-admin-ink disabled:opacity-40"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            {member.activeSessions > 0 ? (
              <Action
                busy={busy === member.id}
                onClick={() => {
                  run(member.id, `/admin/team/${encodeURIComponent(member.id)}/revoke-sessions`, { method: 'POST' });
                }}
              >
                Sign out everywhere
              </Action>
            ) : null}

            {member.isSelf ? null : member.disabledAt ? (
              <Action
                busy={busy === member.id}
                onClick={() => {
                  run(member.id, `/admin/team/${encodeURIComponent(member.id)}/enable`, { method: 'POST' });
                }}
              >
                Re-enable
              </Action>
            ) : (
              <Action
                busy={busy === member.id}
                onClick={() => {
                  run(member.id, `/admin/team/${encodeURIComponent(member.id)}/disable`, { method: 'POST' });
                }}
              >
                Disable
              </Action>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InviteForm({
  roles,
  onCreated,
  onError,
}: {
  roles: string[];
  onCreated: (email: string, password: string) => void;
  onError: (message: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(roles.at(-1) ?? 'VIEWER');
  const [busy, setBusy] = useState(false);

  function add(): void {
    setBusy(true);
    void adminMutate<{ temporaryPassword: string; member: { email: string } }>('/admin/team', {
      method: 'POST',
      body: { email, name, role },
    })
      .then((result) => {
        onCreated(result.member.email, result.temporaryPassword);
        setEmail('');
        setName('');
      })
      .catch((cause: unknown) => {
        onError(cause instanceof MutationError ? cause.message : 'That account could not be created.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-[4px] border border-admin-line bg-admin-sunken p-3">
      <div className="flex min-w-[180px] flex-1 flex-col gap-[3px]">
        <label htmlFor="invite-name" className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
          Name
        </label>
        <input
          id="invite-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          className={INPUT}
        />
      </div>
      <div className="flex min-w-[200px] flex-1 flex-col gap-[3px]">
        <label htmlFor="invite-email" className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
          Email address
        </label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          className={INPUT}
        />
      </div>
      <div className="flex flex-col gap-[3px]">
        <label htmlFor="invite-role" className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
          Role
        </label>
        <select
          id="invite-role"
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
          }}
          className={INPUT}
        >
          {roles.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={busy || name.trim().length < 2 || !email.includes('@')}
        onClick={add}
        className="h-[30px] rounded-[4px] bg-primary px-3 text-[12.5px] font-semibold text-white hover:bg-admin-primaryh disabled:opacity-40"
      >
        {busy ? 'Adding…' : 'Add person'}
      </button>
    </div>
  );
}

const INPUT =
  'h-[30px] rounded-[4px] border border-admin-line bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus';

function Action({ busy, onClick, children }: { busy: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="h-[29px] rounded-[4px] border border-admin-line px-2.5 text-[12px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}
