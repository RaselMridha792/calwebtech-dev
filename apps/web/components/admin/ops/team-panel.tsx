'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { CARD, CARD_PAD, ERROR, H2, HELP, INPUT, LABEL, PILL, SELECT, TAG, button } from '../ui/styles';

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
        <div
          role="status"
          className={`${CARD} ${CARD_PAD} motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]`}
        >
          <p className="flex items-center gap-2.5 text-[14.5px] font-semibold text-ink-invert">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-result" />
            Account created for {created.email}
          </p>
          <p className="mt-1.5 text-[14px] leading-[1.6] text-ink-invert-muted">
            There is no invitation email yet, so pass this first password on yourself. It is shown once and cannot be
            read again — if it is lost, a developer can reset it on the server with <code>admin-cli set-password</code>.
          </p>
          <p className="mt-3 rounded-lg border border-admin-line2 bg-admin-sunken px-3 py-2.5 font-mono text-[14px] break-all text-ink-invert select-all">
            {created.password}
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className={`${ERROR} motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]`}>
          {error}
        </p>
      ) : null}

      <section aria-labelledby="team-people" className={`${CARD} overflow-hidden`}>
        <div className="flex flex-col gap-1 px-4 pt-5 pb-4 sm:px-6">
          <h2 id="team-people" className={H2}>
            People
          </h2>
          <p className="text-[13.5px] leading-[1.55] text-ink-invert-muted">
            Change a role from the list and it applies straight away. Disabling someone keeps their history but stops
            them signing in.
          </p>
        </div>
        <ul className="divide-y divide-admin-line2 border-t border-admin-line2">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 sm:px-6">
              <div className="flex min-w-0 flex-1 basis-[240px] items-center gap-3.5">
                <span
                  aria-hidden
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold ${
                    member.disabledAt ? 'bg-admin-sunken text-admin-muted' : 'bg-admin-mist text-ink-invert'
                  }`}
                >
                  {initials(member.name)}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold text-ink-invert">
                    <span className="truncate">{member.name}</span>
                    {member.isSelf ? <span className={TAG}>You</span> : null}
                    {member.disabledAt ? (
                      <span className={PILL}>
                        <span aria-hidden className="size-2 shrink-0 rounded-full bg-danger" />
                        Disabled
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-[13.5px] text-ink-invert-muted">{member.email}</p>
                  <p className="text-[12.5px] text-admin-muted">
                    {member.lastLoginAt ? `Last signed in ${signedIn(member.lastLoginAt)}` : 'Never signed in'} ·{' '}
                    {member.activeSessions} open {member.activeSessions === 1 ? 'session' : 'sessions'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`role-${member.id}`}>
                  Role for {member.name}
                </label>
                <div className="w-[150px]">
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
                    className={SELECT}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {roleLabel(role)}
                      </option>
                    ))}
                  </select>
                </div>

                {member.activeSessions > 0 ? (
                  <button
                    type="button"
                    disabled={busy === member.id}
                    className={button('secondary')}
                    onClick={() => {
                      run(member.id, `/admin/team/${encodeURIComponent(member.id)}/revoke-sessions`, { method: 'POST' });
                    }}
                  >
                    Sign out everywhere
                  </button>
                ) : null}

                {member.isSelf ? null : member.disabledAt ? (
                  <button
                    type="button"
                    disabled={busy === member.id}
                    className={button('secondary')}
                    onClick={() => {
                      run(member.id, `/admin/team/${encodeURIComponent(member.id)}/enable`, { method: 'POST' });
                    }}
                  >
                    Re-enable
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy === member.id}
                    className={button('danger')}
                    onClick={() => {
                      run(member.id, `/admin/team/${encodeURIComponent(member.id)}/disable`, { method: 'POST' });
                    }}
                  >
                    Disable
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
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
    <section aria-labelledby="team-invite" className={`${CARD} ${CARD_PAD}`}>
      <div className="mb-5 flex flex-col gap-1">
        <h2 id="team-invite" className={H2}>
          Add a person
        </h2>
        <p className="text-[13.5px] leading-[1.55] text-ink-invert-muted">
          They get a first password to sign in with, shown to you once. Pick the role that gives them only what they
          need.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_170px]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-name" className={LABEL}>
            Name
          </label>
          <input
            id="invite-name"
            value={name}
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value);
            }}
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-email" className={LABEL}>
            Email address
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            autoComplete="off"
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-role" className={LABEL}>
            Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
            }}
            className={SELECT}
          >
            {roles.map((entry) => (
              <option key={entry} value={entry}>
                {roleLabel(entry)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-admin-line2 pt-4">
        <p className={HELP}>Owners can do everything, including this screen. Viewers can only look.</p>
        <button
          type="button"
          disabled={busy || name.trim().length < 2 || !email.includes('@')}
          onClick={add}
          className={button('primary')}
        >
          {busy ? 'Adding…' : 'Add person'}
        </button>
      </div>
    </section>
  );
}

/** "EDITOR" as a person would read it: "Editor". The value sent to the API is unchanged. */
function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

function signedIn(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
