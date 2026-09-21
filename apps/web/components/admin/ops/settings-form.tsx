'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';

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
    <div className="flex flex-col">
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

  return (
    <section className="border-b border-admin-line py-5">
      <h2 className="font-display text-[15px] font-bold text-admin-ink">{setting.title}</h2>
      <p className="mt-1 mb-3 max-w-[560px] text-[12.5px] leading-[20px] text-admin-body">{setting.help}</p>

      {setting.key === 'site.contact' ? <ContactFields value={setting.value} busy={busy} onSave={save} /> : null}
      {setting.key === 'site.proof' ? <ProofFields value={setting.value} busy={busy} onSave={save} /> : null}
      {setting.key === 'leads.notificationRecipients' ? (
        <RecipientsField value={setting.value} busy={busy} onSave={save} />
      ) : null}
      {setting.key === 'site.indexing' || setting.key === 'homepage.indexing' ? (
        <IndexingToggle value={setting.value} busy={busy} onSave={save} />
      ) : null}

      <p className="mt-2.5 flex items-center gap-2 text-[11px] text-admin-muted">
        {error ? (
          <span role="alert" className="text-danger">
            {error}
          </span>
        ) : saved ? (
          <>
            <span aria-hidden className="size-[7px] rounded-full bg-result" />
            Saved and audited
          </>
        ) : setting.updatedAt ? (
          `Last changed ${new Date(setting.updatedAt).toLocaleString('en-GB', { timeZone: 'UTC' })}`
        ) : (
          'Never set'
        )}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- per key

function ContactFields({ value, busy, onSave }: FieldProps) {
  const current = (value ?? {}) as { phone?: string; phoneE164?: string; email?: string };
  const [phone, setPhone] = useState(current.phone ?? '');
  const [phoneE164, setPhoneE164] = useState(current.phoneE164 ?? '');
  const [email, setEmail] = useState(current.email ?? '');

  return (
    <Row>
      <Field label="Phone, as shown" id="contact-phone" value={phone} onChange={setPhone} placeholder="+1 (800) 555-0188" />
      <Field
        label="Phone, for tel: links"
        id="contact-e164"
        value={phoneE164}
        onChange={setPhoneE164}
        placeholder="+18005550188"
      />
      <Field label="Mailbox" id="contact-email" value={email} onChange={setEmail} type="email" />
      <Save
        busy={busy}
        onClick={() => {
          onSave({ phone, phoneE164, email });
        }}
      />
    </Row>
  );
}

function ProofFields({ value, busy, onSave }: FieldProps) {
  const current = (value ?? {}) as { npsScore?: number | null; npsProjectCount?: number | null };
  const [score, setScore] = useState(current.npsScore === null || current.npsScore === undefined ? '' : String(current.npsScore));
  const [count, setCount] = useState(
    current.npsProjectCount === null || current.npsProjectCount === undefined ? '' : String(current.npsProjectCount),
  );

  return (
    <Row>
      <Field label="NPS score" id="proof-nps" value={score} onChange={setScore} type="number" placeholder="Leave blank if unmeasured" />
      <Field label="Projects it is based on" id="proof-count" value={count} onChange={setCount} type="number" />
      <Save
        busy={busy}
        onClick={() => {
          // Blank means "no claim", which is a different thing from zero.
          onSave({
            npsScore: score.trim() === '' ? null : Number(score),
            npsProjectCount: count.trim() === '' ? null : Number(count),
          });
        }}
      />
    </Row>
  );
}

function RecipientsField({ value, busy, onSave }: FieldProps) {
  const current = (value ?? {}) as { emails?: string[] };
  const [text, setText] = useState((current.emails ?? []).join('\n'));
  const addresses = text
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return (
    <div className="flex max-w-[420px] flex-col gap-2">
      <label htmlFor="lead-recipients" className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
        Addresses, one per line
      </label>
      <textarea
        id="lead-recipients"
        rows={3}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
        className="rounded-[4px] border border-admin-line bg-admin-surface px-2 py-1.5 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus"
      />
      {addresses.length === 0 ? (
        <p className="text-[11px] text-danger">
          With none set, a lead is stored and nobody is told.
        </p>
      ) : null}
      <Save
        busy={busy}
        onClick={() => {
          onSave({ emails: addresses });
        }}
      />
    </div>
  );
}

function IndexingToggle({ value, busy, onSave }: FieldProps) {
  const on = ((value ?? {}) as { index?: boolean }).index === true;
  return (
    <div className="flex items-center gap-3">
      <span className={`text-[12.5px] font-semibold ${on ? 'text-admin-ink' : 'text-admin-body'}`}>
        {on ? 'Search engines may index this' : 'Hidden from search engines'}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          onSave({ index: !on });
        }}
        className="h-[30px] rounded-[4px] border border-admin-line px-3 text-[12px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink disabled:opacity-40"
      >
        {on ? 'Hide it' : 'Show it'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- pieces

interface FieldProps {
  value: unknown;
  busy: boolean;
  onSave: (value: unknown) => void;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex max-w-[620px] flex-wrap items-end gap-3">{children}</div>;
}

function Field({
  label,
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex min-w-[170px] flex-1 flex-col gap-[3px]">
      <label htmlFor={id} className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-[30px] rounded-[4px] border border-admin-line bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus"
      />
    </div>
  );
}

function Save({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="h-[30px] shrink-0 rounded-[4px] bg-primary px-3 text-[12.5px] font-semibold text-white hover:bg-admin-primaryh disabled:opacity-40"
    >
      {busy ? 'Saving…' : 'Save'}
    </button>
  );
}
