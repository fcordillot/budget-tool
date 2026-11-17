export type Recurrence = 'monthly' | 'quarterly' | 'annually';

export type IncomeMode = 'amount' | 'days';

export type Income = {
  /** Montant TTC reçu (utilisé en mode 'amount') */
  amount: number;
  /** Compte qui reçoit le virement */
  account: string;
  mode: IncomeMode;
  /** Jours facturés (mode 'days') */
  days: number;
  /** TJM HT (mode 'days') */
  dailyRate: number;
  /** Taux de TVA, ex. 0.2 */
  vatRate: number;
};

export type BudgetItem = {
  id: string;
  name: string;
  label: string;
  tags: string[];
  account: string;
  /** Montant par échéance : négatif = sortie, positif = entrée */
  amount?: number;
  amountFormula?: string;
  amountRecurrence?: Recurrence;
  /** Mois d'échéance (1-12) pour les lignes trimestrielles / annuelles */
  dueMonths?: number[];
  /** Jour du mois de l'échéance */
  dueDay?: number;
  /** Ligne ignorée ce mois-ci (ex. PER suspendu) */
  paused?: boolean;
};

export type Reserve = {
  /** Compte qui sert de réserve (sous-compte charges) */
  account: string;
  /** Solde actuel saisi à la main, avant virement */
  balance: number | null;
};

export type BudgetData = {
  income: Income;
  accounts: string[];
  tags: string[];
  /** Compte qui reçoit ce qui reste (ex. revolut) */
  remainderAccount: string;
  reserve: Reserve;
  /** Jours facturés prévus pour les prochains virements (projection) */
  forecastDays: number[];
  items: BudgetItem[];
};

export const DEFAULT_INCOME: Income = {
  amount: 0,
  account: 'shine-personal',
  mode: 'amount',
  days: 0,
  dailyRate: 500,
  vatRate: 0.2,
};

export const DEFAULT_DATA: BudgetData = {
  income: DEFAULT_INCOME,
  accounts: ['shine-personal'],
  tags: [],
  remainderAccount: 'revolut',
  reserve: { account: '', balance: null },
  forecastDays: [19, 19, 19, 19],
  items: [],
};

export function normalizeRecurrence(r: unknown): Recurrence {
  if (r === 'annualy' || r === 'annually') return 'annually';
  if (r === 'quarterly') return 'quarterly';
  return 'monthly';
}

export function recurrenceDivisor(r?: Recurrence): number {
  if (r === 'annually') return 12;
  if (r === 'quarterly') return 3;
  return 1;
}

export function incomeTTC(income: Income): number {
  if (income.mode === 'days') {
    return Math.round(income.days * income.dailyRate * (1 + income.vatRate) * 100) / 100;
  }
  return income.amount;
}
