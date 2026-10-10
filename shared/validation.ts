import { z } from 'zod';
import type { PatchOperation, RiskLevel } from './types';

export const ElementFingerprintSchema = z.object({
  cssSelector: z.string(),
  domPath: z.string(),
  tag: z.string(),
  id: z.string().optional(),
  classes: z.array(z.string()),
  attributes: z.record(z.string()),
  textContent: z.string().max(200),
  nearbyText: z.array(z.string()).max(3),
  ancestors: z.array(z.object({
    tag: z.string(),
    id: z.string().optional(),
    classes: z.array(z.string()),
  })).max(4),
  rect: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
});

const SAFE_STYLE_PROPS = new Set([
  'color', 'background-color', 'background', 'font-size', 'font-weight',
  'text-decoration', 'display', 'visibility', 'opacity', 'pointer-events',
  'z-index', 'position', 'top', 'right', 'bottom', 'left',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'overflow', 'overflow-wrap', 'overflow-x', 'overflow-y',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-width', 'border-color', 'border-style', 'border-radius',
  'cursor',
]);

const DANGEROUS_VALUE_PATTERNS = [/url\s*\(/i, /expression\s*\(/i, /javascript\s*:/i];

const DANGEROUS_ATTRS = new Set(['href', 'src', 'type', 'disabled']);
const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'form', 'select', 'textarea']);

export const PatchOperationSchema: z.ZodType<PatchOperation> = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('SET_STYLE'),
    properties: z.record(z.string()),
    important: z.boolean().optional(),
  }),
  z.object({
    op: z.literal('SET_ATTRIBUTE'),
    name: z.string(),
    value: z.string(),
  }),
  z.object({
    op: z.literal('REMOVE_ATTRIBUTE'),
    name: z.string(),
  }),
  z.object({
    op: z.literal('SET_TEXT'),
    value: z.string(),
  }),
  z.object({ op: z.literal('HIDE') }),
  z.object({
    op: z.literal('RUN_SCRIPT_TEMPLATE'),
    template: z.enum(['RETRY_FETCH_ON_FAIL', 'FALLBACK_MESSAGE_ON_FAIL']),
    params: z.record(z.union([z.string(), z.number()])),
  }),
]);

export function validateOperationSafety(ops: PatchOperation[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const op of ops) {
    if (op.op === 'SET_STYLE') {
      for (const [prop, value] of Object.entries(op.properties)) {
        if (!SAFE_STYLE_PROPS.has(prop)) {
          errors.push(`Style property "${prop}" is not in the allow-list`);
        }
        for (const pat of DANGEROUS_VALUE_PATTERNS) {
          if (pat.test(value)) {
            errors.push(`Style value for "${prop}" contains dangerous pattern`);
          }
        }
      }
    }

    if (op.op === 'SET_ATTRIBUTE') {
      if (op.name.startsWith('on')) {
        errors.push(`Attribute "${op.name}" starts with "on" (event handler)`);
      }
      if (op.value.trim().toLowerCase().startsWith('javascript:')) {
        errors.push(`Attribute value for "${op.name}" starts with javascript:`);
      }
    }

    if (op.op === 'RUN_SCRIPT_TEMPLATE') {
      for (const [key, val] of Object.entries(op.params)) {
        if (typeof val === 'string' && val.length > 200) {
          errors.push(`Template param "${key}" exceeds 200 characters`);
        }
        if (typeof val === 'number' && op.template === 'RETRY_FETCH_ON_FAIL' && key === 'retries' && val > 3) {
          errors.push(`Retries cannot exceed 3`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

interface RiskContext {
  targetTag?: string;
  urlPattern?: string;
}

export function scoreRisk(ops: PatchOperation[], ctx: RiskContext = {}): {
  score: number;
  level: RiskLevel;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  for (const op of ops) {
    switch (op.op) {
      case 'SET_STYLE':
        score += 3;
        reasons.push(`SET_STYLE (+3)`);
        if (op.important) {
          score += 5;
          reasons.push(`!important used (+5)`);
        }
        break;
      case 'SET_ATTRIBUTE':
      case 'REMOVE_ATTRIBUTE': {
        const attrName = op.op === 'SET_ATTRIBUTE' ? op.name : op.name;
        const points = DANGEROUS_ATTRS.has(attrName) ? 10 : 5;
        score += points;
        reasons.push(`${op.op} "${attrName}" (+${points})`);
        break;
      }
      case 'SET_TEXT':
        score += 6;
        reasons.push(`SET_TEXT (+6)`);
        break;
      case 'HIDE':
        score += 12;
        reasons.push(`HIDE (+12)`);
        break;
      case 'RUN_SCRIPT_TEMPLATE':
        score += 40;
        reasons.push(`RUN_SCRIPT_TEMPLATE (+40)`);
        break;
    }
  }

  if (ctx.urlPattern === '*') {
    score += 10;
    reasons.push(`URL pattern "*" applies everywhere (+10)`);
  }

  if (ctx.targetTag && INTERACTIVE_TAGS.has(ctx.targetTag.toLowerCase())) {
    score += 8;
    reasons.push(`Target is interactive element <${ctx.targetTag}> (+8)`);
  }

  if (ops.length > 3) {
    const extra = (ops.length - 3) * 5;
    score += extra;
    reasons.push(`${ops.length - 3} extra operations (+${extra})`);
  }

  score = Math.min(score, 100);

  const level: RiskLevel = score <= 25 ? 'LOW' : score <= 55 ? 'MEDIUM' : 'HIGH';

  return { score, level, reasons };
}
