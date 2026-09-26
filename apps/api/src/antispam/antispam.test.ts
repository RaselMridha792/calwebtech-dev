import { EMAIL_LIMITS } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { DnsDomainChecker, type MailResolver } from './email-domains';
import { SubmissionGuard, type EmailCounter } from './submission-guard';

/** A resolver answering from a table, and failing with a code for anything else. */
function resolver(table: {
  mx?: Record<string, { exchange: string; priority: number }[]>;
  a?: Record<string, string[]>;
  fail?: Record<string, string>;
}): MailResolver & { calls: number } {
  const answer = <T>(records: Record<string, T[]> | undefined, domain: string): Promise<T[]> => {
    fake.calls += 1;
    const failure = table.fail?.[domain];
    if (failure) return Promise.reject(Object.assign(new Error(failure), { code: failure }));
    const found = records?.[domain];
    return found ? Promise.resolve(found) : Promise.reject(Object.assign(new Error('ENODATA'), { code: 'ENODATA' }));
  };
  const fake = {
    calls: 0,
    resolveMx: (domain: string) => answer(table.mx, domain),
    resolve4: (domain: string) => answer(table.a, domain),
    resolve6: (domain: string) => answer<string>(undefined, domain),
  };
  return fake;
}

describe('the email domain check', () => {
  it('passes a domain with mail servers, or with an address when it names none', async () => {
    const checker = new DnsDomainChecker(
      resolver({ mx: { 'company.com': [{ exchange: 'mx.company.com', priority: 10 }] }, a: { 'small.org': ['192.0.2.1'] } }),
    );
    expect(await checker.check('company.com')).toBe('yes');
    expect(await checker.check('small.org')).toBe('yes');
  });

  it('refuses a domain that does not exist or has nothing to receive mail on', async () => {
    const checker = new DnsDomainChecker(resolver({ fail: { 'gmial.con': 'ENOTFOUND' } }));
    expect(await checker.check('gmial.con')).toBe('no');
    expect(await checker.check('empty.example')).toBe('no');
  });

  it('lets an address through when DNS fails or is slow, and does not remember that', async () => {
    const failing = resolver({ fail: { 'company.com': 'ESERVFAIL' } });
    const checker = new DnsDomainChecker(failing);
    expect(await checker.check('company.com')).toBe('unknown');
    expect(await checker.check('company.com')).toBe('unknown');
    expect(failing.calls).toBe(2);

    const slow: MailResolver = {
      resolveMx: () => new Promise(() => undefined),
      resolve4: () => new Promise(() => undefined),
      resolve6: () => new Promise(() => undefined),
    };
    expect(await new DnsDomainChecker(slow, 20).check('company.com')).toBe('unknown');
  });

  it('remembers an answer for its time, not longer', async () => {
    let now = 0;
    const counted = resolver({ mx: { 'company.com': [{ exchange: 'mx.company.com', priority: 10 }] } });
    const checker = new DnsDomainChecker(counted, 1000, 60_000, () => now);
    await checker.check('company.com');
    await checker.check('COMPANY.com');
    expect(counted.calls).toBe(1);
    now = 61_000;
    await checker.check('company.com');
    expect(counted.calls).toBe(2);
  });
});

describe('the submission guard', () => {
  const deliverable = { check: () => Promise.resolve('yes' as const) };

  it('refuses a form sent faster than a person could, and lets through one with no figure', async () => {
    const guard = new SubmissionGuard(null, deliverable);
    expect(await guard.precheck('lead', 'dana@company.com', 300)).toBe('too_fast');
    expect(await guard.precheck('lead', 'dana@company.com', 8_000)).toBe('pass');
    expect(await guard.precheck('lead', 'dana@company.com', undefined)).toBe('pass');
  });

  it('refuses a throwaway inbox without asking DNS, and an address that cannot receive mail', async () => {
    let asked = 0;
    const guard = new SubmissionGuard(null, {
      check: (domain: string) => {
        asked += 1;
        return Promise.resolve(domain === 'gmial.con' ? ('no' as const) : ('yes' as const));
      },
    });
    expect(await guard.precheck('subscribe', 'x@mailinator.com', 5_000)).toBe('disposable');
    expect(asked).toBe(0);
    expect(await guard.precheck('subscribe', 'dana@gmial.con', 5_000)).toBe('no_mail');
  });

  it('allows each address its limit per form, and everything when it cannot count', async () => {
    const counts = new Map<string, number>();
    const counter: EmailCounter = {
      increment: (key) => {
        counts.set(key, (counts.get(key) ?? 0) + 1);
        return Promise.resolve(counts.get(key) ?? 0);
      },
    };
    const guard = new SubmissionGuard(counter, null);
    const results: boolean[] = [];
    for (let attempt = 0; attempt <= EMAIL_LIMITS.booking.max; attempt += 1) {
      results.push(await guard.withinLimit('booking', 'Dana@Company.com'));
    }
    expect(results.filter(Boolean)).toHaveLength(EMAIL_LIMITS.booking.max);
    expect(results.at(-1)).toBe(false);
    // Another form, another allowance; the key holds no address.
    expect(await guard.withinLimit('lead', 'dana@company.com')).toBe(true);
    expect([...counts.keys()].some((key) => key.includes('company'))).toBe(false);

    const broken = new SubmissionGuard({ increment: () => Promise.resolve(null) }, null);
    expect(await broken.withinLimit('booking', 'dana@company.com')).toBe(true);
  });
});
