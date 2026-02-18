import { DEFAULT_DATA, normalizeRecurrence, type BudgetData } from './types';
import { uuid } from './uuid';

const STORAGE_KEY = 'budget-tool:data:v2';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

export function normalizeImportedData(raw: unknown): BudgetData {
  if (!isRecord(raw)) return DEFAULT_DATA;

  const incomeRaw = isRecord(raw.income) ? raw.income : {};
  const incomeAmount = typeof incomeRaw.amount === 'number' && Number.isFinite(incomeRaw.amount) ? incomeRaw.amount : 0;
  const incomeAccount = typeof incomeRaw.account === 'string' && incomeRaw.account.trim() ? incomeRaw.account.trim() : DEFAULT_DATA.income.account;

  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  const items = itemsRaw
    .filter(isRecord)
    .map((it) => {
      const id = typeof it.id === 'string' && it.id ? it.id : uuid();
      const name = typeof it.name === 'string' ? it.name : '';
      const label = typeof it.label === 'string' ? it.label : name;
      const tags = Array.isArray(it.tags) ? it.tags.filter((t) => typeof t === 'string') as string[] : [];
      const account = typeof it.account === 'string' ? it.account : '';
      const amount = typeof it.amount === 'number' && Number.isFinite(it.amount) ? it.amount : undefined;
      const amountFormula = typeof it.amountFormula === 'string' ? it.amountFormula : undefined;
      const amountRecurrence = normalizeRecurrence(it.amountRecurrence);
      return { id, name, label, tags, account, amount, amountFormula, amountRecurrence };
    });

  return { income: { amount: incomeAmount, account: incomeAccount }, items };
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
}

export function exportBudgetData(data: BudgetData): string {
  return JSON.stringify(data, null, 2);
}
