/**
 * Teal (the `result` token) is reserved for outcome figures and affirmative marks
 * such as check icons and status dots. It is banned from headings, body text,
 * buttons, links, borders and card backgrounds. Ambient glows use `--glow-teal`
 * through the `glow-teal` and `bg-glow-teal-*` utilities instead.
 *
 * The rule reads Tailwind class strings, so it enforces context by heuristics:
 * - only `text-result` and `bg-result` utilities are allowed at all;
 * - never on headings, links, buttons or form labels;
 * - a teal background must sit on a round mark (`rounded-full`);
 * - teal text must be a mark or a bold display figure.
 */

const TOKEN = /^(?<prefix>[a-z]+(?:-[a-z]+)*)-result(?:\/\S+)?$/;
const ALLOWED_PREFIXES = new Set(['text', 'bg']);
const BANNED_ELEMENTS = new Set([
  'a',
  'Link',
  'button',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'label',
  'legend',
  'input',
  'select',
  'option',
  'textarea',
  'summary',
  'th',
]);
const MARK = /(?:^|\s|:)rounded-full(?=\s|$)/;
const FIGURE = /(?:^|\s|:)(?:font-display|font-bold|font-extrabold)(?=\s|$)/;

function tealTokens(text) {
  return text
    .split(/\s+/)
    .map((cls) => cls.slice(cls.lastIndexOf(':') + 1).replace(/^!/, ''))
    .filter((cls) => TOKEN.test(cls));
}

function problems(text, element) {
  const found = [];
  for (const token of tealTokens(text)) {
    const prefix = TOKEN.exec(token)?.groups?.prefix ?? '';
    if (!ALLOWED_PREFIXES.has(prefix)) {
      found.push({ messageId: 'property', data: { token } });
    } else if (element && BANNED_ELEMENTS.has(element)) {
      found.push({ messageId: 'element', data: { token, element } });
    } else if (prefix === 'bg' && !MARK.test(text)) {
      found.push({ messageId: 'background', data: { token } });
    } else if (prefix === 'text' && !MARK.test(text) && !FIGURE.test(text)) {
      found.push({ messageId: 'text', data: { token } });
    }
  }
  return found;
}

/** Gathers every string that can end up in a className expression. */
function collect(node, parts, seen) {
  if (!node) return;
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') {
        parts.push(node.value);
        seen.add(node);
      }
      return;
    case 'TemplateLiteral':
      for (const quasi of node.quasis) {
        parts.push(quasi.value.cooked ?? quasi.value.raw);
        seen.add(quasi);
      }
      for (const expression of node.expressions) collect(expression, parts, seen);
      return;
    case 'JSXExpressionContainer':
      collect(node.expression, parts, seen);
      return;
    case 'ConditionalExpression':
      collect(node.consequent, parts, seen);
      collect(node.alternate, parts, seen);
      return;
    case 'LogicalExpression':
    case 'BinaryExpression':
      collect(node.left, parts, seen);
      collect(node.right, parts, seen);
      return;
    case 'CallExpression':
      for (const argument of node.arguments) collect(argument, parts, seen);
      return;
    case 'ArrayExpression':
      for (const element of node.elements) collect(element, parts, seen);
      return;
    default:
      return;
  }
}

/** @type {import('eslint').Rule.RuleModule} */
export const tealUsage = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Restrict the teal `result` token to outcome figures and affirmative marks',
    },
    schema: [],
    messages: {
      property:
        '`{{token}}`: teal is never used for borders, rings, outlines, gradients, shadows or fills. Ambient glows use `glow-teal` / `bg-glow-teal-*`.',
      element: '`{{token}}` on <{{element}}>: teal is banned from headings, links, buttons and form labels.',
      background:
        '`{{token}}`: a teal background is only for round affirmative marks (status dots, check icons), never cards or sections.',
      text: '`{{token}}`: teal text is only for outcome figures and affirmative marks, never body text.',
    },
  },
  create(context) {
    const seen = new WeakSet();
    const reportAll = (node, text, element) => {
      for (const problem of problems(text, element)) context.report({ node, ...problem });
    };

    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'className') return;
        const parts = [];
        collect(node.value, parts, seen);
        const opening = node.parent;
        const element = opening?.name?.type === 'JSXIdentifier' ? opening.name.name : null;
        reportAll(node, parts.join(' '), element);
      },
      Literal(node) {
        if (typeof node.value !== 'string' || seen.has(node)) return;
        reportAll(node, node.value, null);
      },
      TemplateElement(node) {
        if (seen.has(node)) return;
        reportAll(node, node.value.cooked ?? node.value.raw, null);
      },
    };
  },
};

export const calwebtechPlugin = {
  meta: { name: '@calwebtech/eslint-plugin' },
  rules: { 'teal-usage': tealUsage },
};
