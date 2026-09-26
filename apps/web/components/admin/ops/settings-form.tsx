'use client';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { CARD, CARD_PAD, ERROR, H2, HELP, INPUT, LABEL, PILL, TEXTAREA, button } from '../ui/styles';

/**
 * One setting, saved on its own (docs/12-admin-dashboard.md, module 11).
 *
 * Each key has a real form rather than a JSON box, because the shapes are small and a
 * person changing where leads are sent should not have to get punctuation right. The API
 * validates with the same schema it reads the value back with, so a mistake is refused
 * there too, not only here.
 *
 * Every save writes an audit entry — the thing `settings-cli` never did.
 */
export interface SettingRow {
  key: string;
  title: string;
  help: string;
  value: unknown;
  updatedAt: string | null;
}

export function SettingsForm({ settings }: { settings: SettingRow[] }) {
  return (
    <div className="flex flex-col gap-5">
      {settings.map((setting) => (
        <SettingCard key={setting.key} setting={setting} />
      ))}
    </div>
  );
}

function SettingCard({ setting }: { setting: SettingRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save(value: unknown): void {
    setBusy(true);
    setError(null);
    setSaved(false);
    void adminMutate(`/admin/settings/${encodeURIComponent(setting.key)}`, { method: 'PATCH', body: { value } })
      .then(() => {
        setSaved(true);
        router.refresh();
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof MutationError
            ? (cause.fieldErrors.value?.join(' ') ?? cause.message)
            : 'That could not be saved.',
        );
      })
      .finally(() => {
        setBusy(false);
      });
  }

  const headingId = `setting-${setting.key.replace(/\W+/g, '-')}`;
  const status = error ? (
    <p role="alert" className={`${ERROR} motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]`}>
      {error}
    </p>
  ) : saved ? (
    <p
      role="status"
      className="flex items-center gap-2 text-[13px] text-ink-invert-muted motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]"
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-result" />
      Saved and written to the audit log
    </p>
  ) : (
    <p className={HELP}>{setting.updatedAt ? `Last changed ${changed(setting.updatedAt)}` : 'Never set'}</p>
  );

  return (
    <section aria-labelledby={headingId} className={`${CARD} ${CARD_PAD}`}>
      <div className="mb-5 flex flex-col gap-1">
        <h2 id={headingId} className={H2}>
          {setting.title}
        </h2>
        <p className="text-[13.5px] leading-[1.55] text-ink-invert-muted">{setting.help}</p>
      </div>

      {setting.key === 'site.contact' ? <ContactFields value={setting.value} busy={busy} onSave={save} status={status} /> : null}
      {setting.key === 'site.proof' ? <ProofFields value={setting.value} busy={busy} onSave={save} status={status} /> : null}
      {setting.key === 'leads.notificationRecipients' ? (
        <RecipientsField value={setting.value} busy={busy} onSave={save} status={status} />
      ) : null}
      {setting.key === 'site.indexing' || setting.key === 'homepage.indexing' ? (
        <IndexingToggle
          value={setting.value}
          busy={busy}
          onSave={save}
          status={status}
          subject={setting.key === 'homepage.indexing' ? 'the homepage' : 'the site'}
        />
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- per key

function ContactFields({ value, busy, onSave, status }: FieldProps) {
  const current = (value ?? {}) as { phone?: string | null; phoneE164?: string | null; email?: string };
  const [phone, setPhone] = useState(current.phone ?? '');
  const [phoneE164, setPhoneE164] = useState(current.phoneE164 ?? '');
  const [email, setEmail] = useState(current.email ?? '');

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Phone number, as shown"
          help="Written the way visitors should read it. Leave both phone fields blank to take the number off the site."
          id="contact-phone"
          value={phone}
          onChange={setPhone}
          placeholder="+1 (800) 555-0188"
        />
        <Field
          label="Phone number, for tap-to-call"
          help="Digits only with the country code, so a phone can dial it."
          id="contact-e164"
          value={phoneE164}
          onChange={setPhoneE164}
          placeholder="+18005550188"
        />
        <div className="sm:col-span-2">
          <Field label="Mailbox" help="The address shown on the site and in its contact details." id="contact-email" value={email} onChange={setEmail} type="email" />
        </div>
      </div>
      <Footer
        busy={busy}
        status={status}
        onClick={() => {
          // Both phone fields empty takes the number off the site; the API refuses one without the other.
          onSave({ phone: phone.trim() || null, phoneE164: phoneE164.trim() || null, email });
        }}
      />
    </>
  );
}

function ProofFields({ value, busy, onSave, status }: FieldProps) {
  const current = (value ?? {}) as { npsScore?: number | null; npsProjectCount?: number | null };
  const [score, setScore] = useState(current.npsScore === null || current.npsScore === undefined ? '' : String(current.npsScore));
  const [count, setCount] = useState(
    current.npsProjectCount === null || current.npsProjectCount === undefined ? '' : String(current.npsProjectCount),
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="NPS score"
          help="Leave it blank if it has not been measured; blank means no claim is made."
          id="proof-nps"
          value={score}
          onChange={setScore}
          type="number"
          placeholder="Leave blank if unmeasured"
        />
        <Field label="Projects it is based on" help="How many projects the score comes from." id="proof-count" value={count} onChange={setCount} type="number" />
      </div>
      <Footer
        busy={busy}
        status={status}
        onClick={() => {
          // Blank means "no claim", which is a different thing from zero.
          onSave({
            npsScore: score.trim() === '' ? null : Number(score),
            npsProjectCount: count.trim() === '' ? null : Number(count),
          });
        }}
      />
    </>
  );
}

function RecipientsField({ value, busy, onSave, status }: FieldProps) {
  const current = (value ?? {}) as { emails?: string[] };
  const [text, setText] = useState((current.emails ?? []).join('\n'));
  const addresses = text
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return (
    <>
      <div className="flex max-w-[520px] flex-col gap-1.5">
        <label htmlFor="lead-recipients" className={LABEL}>
          Addresses, one per line
        </label>
        <textarea
          id="lead-recipients"
          rows={4}
          value={text}
          aria-describedby="lead-recipients-help"
          onChange={(event) => {
            setText(event.target.value);
          }}
          className={TEXTAREA}
        />
        {addresses.length === 0 ? (
          <p id="lead-recipients-help" className={ERROR}>
            With none set, a lead is stored and nobody is told.
          </p>
        ) : (
          <p id="lead-recipients-help" className={HELP}>
            {addresses.length === 1 ? 'One address' : `${String(addresses.length)} addresses`} will get an email for
            every new lead.
          </p>
        )}
      </div>
      <Footer
        busy={busy}
        status={status}
        onClick={() => {
          onSave({ emails: addresses });
        }}
      />
    </>
  );
}

function IndexingToggle({ value, busy, onSave, status, subject = 'the site' }: FieldProps & { subject?: string }) {
  const on = ((value ?? {}) as { index?: boolean }).index === true;
  const Subject = subject.charAt(0).toUpperCase() + subject.slice(1);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-lg border border-admin-line2 bg-admin-sunken px-4 py-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className={PILL}>
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${on ? 'bg-result' : 'bg-admin-muted'}`} />
            {on ? 'On' : 'Off'}
          </span>
          <span className="text-[14px] font-semibold text-ink-invert">
            {on ? `Search engines can see ${subject}` : `${Subject} is hidden from search engines`}
          </span>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            onSave({ index: !on });
          }}
          className={button('secondary')}
        >
          {on ? 'Hide it' : 'Show it'}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-admin-line2 pt-4">{status}</div>
    </>
  );
}

// ---------------------------------------------------------------- pieces

interface FieldProps {
  value: unknown;
  busy: boolean;
  onSave: (value: unknown) => void;
  /** What the card says about its last save, shown beside the button. */
  status: ReactNode;
}

function Field({
  label,
  help,
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  help?: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-describedby={help ? `${id}-help` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={INPUT}
      />
      {help ? (
        <p id={`${id}-help`} className={HELP}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

/** The card's last row: what happened on the last save, and the one button that saves. */
function Footer({ busy, onClick, status }: { busy: boolean; onClick: () => void; status: ReactNode }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-admin-line2 pt-4">
      <div className="min-w-0">{status}</div>
      <button type="button" disabled={busy} onClick={onClick} className={button('primary')}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

function changed(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}
