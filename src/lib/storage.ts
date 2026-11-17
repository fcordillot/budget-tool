import { DEFAULT_DATA, DEFAULT_INCOME, DEFAULT_SALARY, normalizeRecurrence, type BudgetData, type BudgetItem } from './types';
import { uuid } from './uuid';

const STORAGE_KEY = 'budget-tool:data:v2';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function num(x: unknown, fallback: number): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : fallback;
}

function str(x: unknown, fallback = ''): string {
  return typeof x === 'string' ? x : fallback;
}

function strList(x: unknown): string[] {
  return Array.isArray(x) ? [...new Set(x.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean))] : [];
}

export function normalizeImportedData(raw: unknown): BudgetData {
  if (!isRecord(raw)) return DEFAULT_DATA;

  const inc = isRecord(raw.income) ? raw.income : {};
  const income = {
    amount: num(inc.amount, 0),
    account: str(inc.account).trim() || DEFAULT_INCOME.account,
    mode: inc.mode === 'days' ? ('days' as const) : ('amount' as const),
    days: num(inc.days, 0),
    dailyRate: num(inc.dailyRate, DEFAULT_INCOME.dailyRate),
    vatRate: num(inc.vatRate, DEFAULT_INCOME.vatRate),
  };

  const accounts = strList(raw.accounts);
  const tags = strList(raw.tags);

  const items: BudgetItem[] = [];
  for (const it of Array.isArray(raw.items) ? raw.items.filter(isRecord) : []) {
    const name = str(it.name);
    const amount = typeof it.amount === 'number' && Number.isFinite(it.amount) ? it.amount : undefined;
    const amountFormula = typeof it.amountFormula === 'string' && it.amountFormula.trim() ? it.amountFormula : undefined;
    const itemTags = strList(it.tags);
    const account = str(it.account).trim();

    // Ancien format : fausses lignes "account:x" / "tag:x" pour mémoriser comptes et tags
    if ((name.startsWith('account:') || name.startsWith('tag:')) && amount === undefined && !amountFormula) {
      if (account) accounts.push(account);
      tags.push(...itemTags);
      continue;
    }

    const dueMonths = Array.isArray(it.dueMonths)
      ? [...new Set(it.dueMonths.filter((m): m is number => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b)
      : undefined;
    const dueDay = Number.isInteger(it.dueDay) && (it.dueDay as number) >= 1 && (it.dueDay as number) <= 31 ? (it.dueDay as number) : undefined;

    items.push({
      id: str(it.id) || uuid(),
      name,
      label: str(it.label, name),
      tags: itemTags,
      account,
      amount,
      amountFormula,
      amountRecurrence: normalizeRecurrence(it.amountRecurrence),
      dueMonths: dueMonths?.length ? dueMonths : undefined,
      dueDay,
      paused: it.paused === true ? true : undefined,
      pausedUntil: typeof it.pausedUntil === 'string' && /^\d{4}-\d{2}$/.test(it.pausedUntil) ? it.pausedUntil : undefined,
    });
  }

  const remainderAccount = str(raw.remainderAccount).trim() || DEFAULT_DATA.remainderAccount;
  const res = isRecord(raw.reserve) ? raw.reserve : {};
  const reserveAccount = str(res.account).trim() || (items.some((i) => i.account === 'shine-taxes') ? 'shine-taxes' : '');
  const forecastDays = Array.isArray(raw.forecastDays)
    ? raw.forecastDays.filter((d): d is number => typeof d === 'number' && Number.isFinite(d) && d >= 0).slice(0, 12)
    : DEFAULT_DATA.forecastDays;
  const sal = isRecord(raw.salary) ? raw.salary : {};
  const salary = {
    enabled: sal.enabled === true,
    amount: num(sal.amount, DEFAULT_SALARY.amount),
    savingsAccount: str(sal.savingsAccount).trim() || DEFAULT_SALARY.savingsAccount,
    savingsBalance: typeof sal.savingsBalance === 'number' && Number.isFinite(sal.savingsBalance) ? sal.savingsBalance : null,
    targetMonths: num(sal.targetMonths, DEFAULT_SALARY.targetMonths),
  };

  return {
    income,
    accounts: uniqSorted([income.account, ...accounts, ...items.map((i) => i.account)]),
    tags: uniqSorted([...tags, ...items.flatMap((i) => i.tags)]),
    remainderAccount,
    reserve: { account: reserveAccount, balance: typeof res.balance === 'number' && Number.isFinite(res.balance) ? res.balance : null },
    forecastDays,
    salary,
    items,
  };
}

export function uniqSorted(arr: string[]): string[] {
  return [...new Set(arr.map((x) => x.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function loadBudgetData(): BudgetData {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return DEFAULT_DATA;
    return normalizeImportedData(JSON.parse(s));
  } catch {
    return DEFAULT_DATA;
  }
}

export function saveBudgetData(data: BudgetData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // stockage plein ou indisponible : on ignore, l'export JSON reste possible
  }
}

export function exportBudgetData(data: BudgetData): string {
  return JSON.stringify(data, null, 2);
}

export const STORAGE_KEY_LABEL = STORAGE_KEY;
