export type Recurrence = '' | 'monthly' | 'annually';

export type Income = {
  amount: number;
  account: string;
};

export type BudgetItem = {
  id: string;
  name: string;
  label: string;
  tags: string[];
  account: string;
  amount?: number;
  amountFormula?: string;
  amountRecurrence?: Recurrence;
};

export type BudgetData = {
  income: Income;
  items: BudgetItem[];
};

export const DEFAULT_DATA: BudgetData = {
  income: { amount: 0, account: 'shine-personal' },
  items: [],
};

export function normalizeRecurrence(r: unknown): Recurrence {
  if (r === 'annualy') return 'annually';
  if (r === 'annually') return 'annually';
  if (r === 'monthly') return 'monthly';
  return '';
}
