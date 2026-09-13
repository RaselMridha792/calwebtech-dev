import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import { tealUsage } from './teal-usage.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run('teal-usage', tealUsage, {
  valid: [
    // Status dot.
    '<span className="h-1.5 w-1.5 rounded-full bg-result" />',
    // Check icon mark.
    '<span className="grid h-6 w-6 place-items-center rounded-full bg-result/20 text-result" />',
    // Outcome figure, conditional class.
    "<dd className={`font-display text-[30px] font-extrabold ${outcome ? 'text-result' : ''}`} />",
    '<span className="font-bold text-result">1.6s</span>',
    // Ambient glow uses its own token.
    '<div className="glow-teal absolute inset-0" />',
    '<div className="absolute h-[560px] w-[560px] rounded-full bg-glow-teal-25 blur-3xl" />',
    "const label = 'result';",
  ],
  invalid: [
    { code: '<h2 className="font-display font-extrabold text-result" />', errors: [{ messageId: 'element' }] },
    { code: '<a className="font-bold text-result" href="#" />', errors: [{ messageId: 'element' }] },
    { code: '<button className="rounded-full bg-result" />', errors: [{ messageId: 'element' }] },
    { code: '<div className="rounded-2xl bg-result p-6" />', errors: [{ messageId: 'background' }] },
    { code: '<div className="absolute rounded-full bg-result/25 blur-3xl" />'.replace('rounded-full ', ''), errors: [{ messageId: 'background' }] },
    { code: '<p className="text-[15px] text-result" />', errors: [{ messageId: 'text' }] },
    { code: '<div className="border border-result" />', errors: [{ messageId: 'property' }] },
    { code: "const ring = 'hover:ring-result/40';", errors: [{ messageId: 'property' }] },
    { code: '<span className="bg-linear-to-r from-primary to-result" />', errors: [{ messageId: 'property' }] },
    { code: "const bar = 'h-px bg-result';", errors: [{ messageId: 'background' }] },
  ],
});
