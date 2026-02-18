import type { Income } from './types';

export type FormulaResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

// Supported examples:
//  - Math.ceil({income} - ({income} / 1.20))
//  - ({income} * 0.22)
//
// Allowlist:
//  - arithmetic: + - * / ( ) .
//  - placeholder: {income} (replaced by income.amount)
//  - Math functions: ceil/floor/round/abs/min/max
//
// This is intended for your own formulas (not untrusted public input).
const MATH_ALLOW = new Set(['ceil', 'floor', 'round', 'abs', 'min', 'max']);

export function evalAmountFormula(formula: string, ctx: { income: Income }): FormulaResult {
  const raw = (formula ?? '').trim();
  if (!raw) return { ok: false, error: 'Empty formula' };

  const replaced = raw.replaceAll('{income}', String(ctx.income.amount));

  // Forbid obviously dangerous characters.
  if (/[`\[\]{};,'"\\]/.test(replaced)) {
    return { ok: false, error: 'Formula contains forbidden characters.' };
  }

  // Validate identifiers.
  const ids = replaced.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  for (const id of ids) {
    if (id === 'Math') continue;
    if (MATH_ALLOW.has(id)) continue;
    return { ok: false, error: `Unknown identifier: ${id}` };
  }

  // Validate Math.<fn>
  const mathCalls = replaced.match(/Math\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/g) ?? [];
  for (const call of mathCalls) {
    const m = /Math\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(call);
    const fn = m?.[1] ?? '';
    if (!MATH_ALLOW.has(fn)) {
      return { ok: false, error: `Math.${fn} is not allowed.` };
    }
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('Math', `"use strict"; return (${replaced});`) as (Math: Math) => unknown;
    const out = fn(Math);
    const num = typeof out === 'number' ? out : Number(out);
    if (!Number.isFinite(num)) return { ok: false, error: 'Formula did not evaluate to a finite number.' };
    return { ok: true, value: num };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to evaluate formula.' };
  }
}
