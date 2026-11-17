import type { BudgetData, BudgetItem } from './types';
import { incomeTTC, isPausedAt, recurrenceDivisor } from './types';
import { evalAmountFormula } from './formula';

export type ComputedItem = {
  item: BudgetItem;
  /** Montant d'une échéance */
  baseAmount: number;
  /** Provision mensuelle (base / 1, 3 ou 12) */
  monthlyAmount: number;
  source: 'amount' | 'formula';
};

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeBaseAmount(
  item: BudgetItem,
  incomeAmount: number,
): { ok: true; value: number; source: 'amount' | 'formula' } | { ok: false; error: string } {
  if (typeof item.amount === 'number' && Number.isFinite(item.amount)) {
    return { ok: true, value: item.amount, source: 'amount' };
  }
  const f = (item.amountFormula ?? '').trim();
  if (f) {
    const r = evalAmountFormula(f, { income: { amount: incomeAmount } });
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, value: r.value, source: 'formula' };
  }
  return { ok: false, error: 'Ni montant ni formule' };
}

export function computeItems(
  data: BudgetData,
  opts: { income?: number; ignorePause?: boolean; at?: Date } = {},
): { computed: ComputedItem[]; skipped: { item: BudgetItem; reason: string }[]; paused: BudgetItem[] } {
  const income = opts.income ?? incomeTTC(data.income);
  const computed: ComputedItem[] = [];
  const skipped: { item: BudgetItem; reason: string }[] = [];
  const paused: BudgetItem[] = [];

  for (const item of data.items) {
    if ((item.paused && !opts.ignorePause) || isPausedAt(item, opts.at ?? new Date())) {
      paused.push(item);
      continue;
    }
    const base = computeBaseAmount(item, income);
    if (!base.ok) {
      skipped.push({ item, reason: base.error });
      continue;
    }
    const monthlyAmount = base.value / recurrenceDivisor(item.amountRecurrence);
    computed.push({ item, baseAmount: base.value, monthlyAmount, source: base.source });
  }

  return { computed, skipped, paused };
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

export type Transfer = { from: string; to: string; amount: number };

export type Plan = {
  income: number;
  toFund: Transfer[];
  toRepatriate: Transfer[];
  /** Ce qui reste pour le compte "reste" (négatif = il manque) */
  remainder: number;
  /** Ce qui reste sur le compte de revenu pour ses propres lignes */
  keepOnIncome: number;
};

export function computePlan(data: BudgetData, computed: ComputedItem[], income: number): Plan {
  const byAcc = sumByAccount(computed);
  const incomeAcc = data.income.account;
  const toFund: Transfer[] = [];
  const toRepatriate: Transfer[] = [];

  for (const [acc, net] of byAcc.entries()) {
    if (!acc || acc === incomeAcc) continue;
    if (net < 0) toFund.push({ from: incomeAcc, to: acc, amount: round2(-net) });
    else if (net > 0) toRepatriate.push({ from: acc, to: incomeAcc, amount: round2(net) });
  }
  toFund.sort((a, b) => b.amount - a.amount);
  toRepatriate.sort((a, b) => b.amount - a.amount);

  const total = computed.reduce((s, c) => s + c.monthlyAmount, 0);
  return {
    income,
    toFund,
    toRepatriate,
    remainder: round2(income + total),
    keepOnIncome: round2(-(byAcc.get(incomeAcc) ?? 0)),
  };
}

// ---------- Salaire fixe ----------

export type SalarySplit = {
  /** Versé sur le compte "reste" */
  salary: number;
  /** Part du virement envoyée vers l'épargne (surplus) */
  toSavings: number;
  /** Montant à prendre dans l'épargne pour compléter le salaire */
  fromSavings: number;
  /** Part du virement qui va au compte "reste" */
  fromIncome: number;
};

export function splitSalary(remainder: number, salary: number): SalarySplit {
  if (remainder >= salary) {
    return { salary, toSavings: round2(remainder - salary), fromSavings: 0, fromIncome: salary };
  }
  const fromIncome = Math.max(remainder, 0);
  return { salary, toSavings: 0, fromSavings: round2(salary - remainder), fromIncome: round2(fromIncome) };
}

// ---------- Échéances ----------

export type Due = { date: Date; item: BudgetItem; amount: number };

function isPonctual(item: BudgetItem): boolean {
  return (item.amountRecurrence === 'quarterly' || item.amountRecurrence === 'annually') && (item.dueMonths?.length ?? 0) > 0;
}

/** Échéances ponctuelles (trimestrielles / annuelles) dans [from, to[ */
export function dueBetween(data: BudgetData, from: Date, to: Date, income: number, ignorePause = false): Due[] {
  const out: Due[] = [];
  for (const item of data.items) {
    if (!isPonctual(item)) continue;
    if (item.paused && !ignorePause) continue;
    const base = computeBaseAmount(item, income);
    if (!base.ok) continue;
    const day = item.dueDay ?? 15;
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
      for (const m of item.dueMonths ?? []) {
        const d = new Date(y, m - 1, day);
        if (d >= from && d < to && !isPausedAt(item, d)) out.push({ date: d, item, amount: base.value });
      }
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
  return r;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ---------- Réserve et projection ----------

/** Flux de la réserve sur un cycle (d'un virement au suivant, ~1 mois) */
export function reserveCycle(
  data: BudgetData,
  computed: ComputedItem[],
  income: number,
  from: Date,
  ignorePause: boolean,
): { transferIn: number; outflows: number; dues: Due[] } {
  const acc = data.reserve.account;
  if (!acc) return { transferIn: 0, outflows: 0, dues: [] };
  const onReserve = computed.filter((c) => c.item.account === acc);
  const net = onReserve.reduce((s, c) => s + c.monthlyAmount, 0);
  const transferIn = net < 0 ? -net : 0;
  // Sorties réelles : lignes mensuelles + échéances ponctuelles qui tombent dans le cycle
  const monthlyOut = onReserve
    .filter((c) => !isPonctual(c.item))
    .reduce((s, c) => s + c.monthlyAmount, 0);
  const dues = dueBetween(data, from, addMonths(from, 1), income, ignorePause).filter((d) => d.item.account === acc);
  const dueOut = dues.reduce((s, d) => s + d.amount, 0);
  return { transferIn: round2(transferIn), outflows: round2(-(monthlyOut + dueOut)), dues };
}

export type ForecastRow = {
  date: Date;
  days: number;
  income: number;
  remainder: number;
  reserveAfter: number | null;
  dues: Due[];
};

export function computeForecast(data: BudgetData, today: Date): { current: ForecastRow; rows: ForecastRow[] } {
  const start = startOfDay(today);
  const income0 = incomeTTC(data.income);
  const { computed: c0 } = computeItems(data, { income: income0, at: start });
  const plan0 = computePlan(data, c0, income0);
  const cyc0 = reserveCycle(data, c0, income0, start, false);
  let reserve: number | null = data.reserve.balance;
  if (reserve !== null) reserve = round2(reserve + cyc0.transferIn - cyc0.outflows);

  const current: ForecastRow = {
    date: start,
    days: data.income.mode === 'days' ? data.income.days : round2(income0 / (1 + data.income.vatRate) / (data.income.dailyRate || 1)),
    income: income0,
    remainder: plan0.remainder,
    reserveAfter: reserve,
    dues: cyc0.dues,
  };

  const rows: ForecastRow[] = [];
  (data.forecastDays ?? []).forEach((days, i) => {
    const from = addMonths(start, i + 1);
    const inc = round2(days * data.income.dailyRate * (1 + data.income.vatRate));
    const { computed } = computeItems(data, { income: inc, ignorePause: true, at: from });
    const plan = computePlan(data, computed, inc);
    const cyc = reserveCycle(data, computed, inc, from, true);
    if (reserve !== null) reserve = round2(reserve + cyc.transferIn - cyc.outflows);
    rows.push({ date: from, days, income: inc, remainder: plan.remainder, reserveAfter: reserve, dues: cyc.dues });
  });

  return { current, rows };
}
