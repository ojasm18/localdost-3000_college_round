import { describe, it, expect } from 'vitest';
import { validateOperationSafety, scoreRisk, PatchOperationSchema } from './validation';
import type { PatchOperation } from './types';

describe('PatchOperationSchema', () => {
  it('validates a SET_STYLE operation', () => {
    const op: PatchOperation = {
      op: 'SET_STYLE',
      properties: { color: '#ff0000', fontSize: '16px' },
      important: true,
    };
    const parsed = PatchOperationSchema.safeParse(op);
    expect(parsed.success).toBe(true);
  });

  it('validates a SET_ATTRIBUTE operation', () => {
    const op: PatchOperation = {
      op: 'SET_ATTRIBUTE',
      name: 'aria-label',
      value: 'Close button',
    };
    const parsed = PatchOperationSchema.safeParse(op);
    expect(parsed.success).toBe(true);
  });
});

describe('validateOperationSafety', () => {
  it('allows safe styles', () => {
    const ops: PatchOperation[] = [
      {
        op: 'SET_STYLE',
        properties: { color: '#111827', 'background-color': '#ffffff' },
      },
    ];
    const result = validateOperationSafety(ops);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects dangerous style properties and values', () => {
    const ops: PatchOperation[] = [
      {
        op: 'SET_STYLE',
        properties: { background: 'url("javascript:alert(1)")' },
      },
    ];
    const result = validateOperationSafety(ops);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects retries exceeding 3 in RETRY_FETCH_ON_FAIL script template', () => {
    const ops: PatchOperation[] = [
      {
        op: 'RUN_SCRIPT_TEMPLATE',
        template: 'RETRY_FETCH_ON_FAIL',
        params: { retries: 5 },
      },
    ];
    const result = validateOperationSafety(ops);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Retries cannot exceed 3');
  });

  it('rejects inline event handlers and javascript: attributes', () => {
    const ops: PatchOperation[] = [
      {
        op: 'SET_ATTRIBUTE',
        name: 'onclick',
        value: 'alert(1)',
      },
    ];
    const result = validateOperationSafety(ops);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('starts with "on"');
  });
});

describe('scoreRisk', () => {
  it('scores low risk for simple style change', () => {
    const ops: PatchOperation[] = [
      {
        op: 'SET_STYLE',
        properties: { color: '#111' },
      },
    ];
    const result = scoreRisk(ops);
    expect(result.level).toBe('LOW');
    expect(result.score).toBe(3);
  });

  it('scores higher risk for interactive elements and dangerous attributes', () => {
    const ops: PatchOperation[] = [
      {
        op: 'SET_ATTRIBUTE',
        name: 'href',
        value: 'https://example.com',
      },
    ];
    const result = scoreRisk(ops, { targetTag: 'button', urlPattern: '*' });
    expect(result.score).toBe(10 + 10 + 8); // 28 -> MEDIUM
    expect(result.level).toBe('MEDIUM');
  });

  it('scores high risk for RUN_SCRIPT_TEMPLATE', () => {
    const ops: PatchOperation[] = [
      {
        op: 'RUN_SCRIPT_TEMPLATE',
        template: 'RETRY_FETCH_ON_FAIL',
        params: { retries: 2 },
      },
    ];
    const result = scoreRisk(ops, { targetTag: 'button', urlPattern: '*' });
    expect(result.score).toBeGreaterThan(55);
    expect(result.level).toBe('HIGH');
  });
});
