import type { BudgetData, BudgetItem } from './types';
import { evalAmountFormula } from './formula';

export type ComputedItem = {
  item: BudgetItem;
  baseAmount: number;
  monthlyAmount: number;
  source: 'amount' | 'formula';
};

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeBaseAmount(item: BudgetItem, incomeAmount: number): { ok: true; value: number; source: 'amount' | 'formula' } | { ok: false; error: string } {
  if (typeof item.amount === 'number' && Number.isFinite(item.amount)) {
    return { ok: true, value: item.amount, source: 'amount' };
  }
  const f = (item.amountFormula ?? '').trim();
  if (f) {
    const r = evalAmountFormula(f, { income: { amount: incomeAmount, account: '' } });
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, value: r.value, source: 'formula' };
  }

  return { ok: false, error: 'No amount / formula' };
}

export function applyRecurrence(value: number, recurrence?: string): number {
  if (recurrence === 'annually') return value / 12;
  return value;
}

export function computeItems(data: BudgetData): { computed: ComputedItem[]; skipped: { item: BudgetItem; reason: string }[] } {
  const computed: ComputedItem[] = [];
  const skipped: { item: BudgetItem; reason: string }[] = [];

  for (const item of data.items) {
    const base = computeBaseAmount(item, data.income.amount);
    if (!base.ok) {
      skipped.push({ item, reason: base.error });
      continue;
    }
    const monthlyAmount = applyRecurrence(base.value, item.amountRecurrence);
    computed.push({ item, baseAmount: base.value, monthlyAmount, source: base.source });
  }

  return { computed, skipped };
}

export function sumByTag(computed: ComputedItem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const ci of computed) {
    for (const tag of ci.item.tags ?? []) {
      map.set(tag, (map.get(tag) ?? 0) + ci.monthlyAmount);
    }
  }
  return map;
}

export function sumByAccount(computed: ComputedItem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const ci of computed) {
    const acc = (ci.item.account ?? '').trim();
    if (!acc) continue;
    map.set(acc, (map.get(acc) ?? 0) + ci.monthlyAmount);
  }
  return map;
}

export type Transfer = {
  from: string;
  to: string;
  amount: number;
  note: string;
};

export function computeTransfers(data: BudgetData, computed: ComputedItem[]): { toFund: Transfer[]; toRepatriate: Transfer[] } {
  const byAcc = sumByAccount(computed);
  const incomeAcc = data.income.account;

  const toFund: Transfer[] = [];
  const toRepatriate: Transfer[] = [];

  for (const [acc, net] of byAcc.entries()) {
    if (!acc || acc === incomeAcc) continue;
    if (net < 0) {
      toFund.push({ from: incomeAcc, to: acc, amount: round2(-net), note: 'Financer dépenses nettes' });
    } else if (net > 0) {
      toRepatriate.push({ from: acc, to: incomeAcc, amount: round2(net), note: 'Rapatrier excédent net' });
    }
  }

  toFund.sort((a, b) => b.amount - a.amount);
  toRepatriate.sort((a, b) => b.amount - a.amount);

  return { toFund, toRepatriate };
}
