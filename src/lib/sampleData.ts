import type { BudgetData } from './types';

// Exemple fictif (montants arrondis), pour découvrir l'outil.
export const SAMPLE_DATA: BudgetData = {
  income: { amount: 0, account: 'pro-principal', mode: 'days', days: 19, dailyRate: 500, vatRate: 0.2 },
  accounts: ['banque-immo', 'epargne', 'perso', 'pro-charges', 'pro-principal'],
  tags: ['immo', 'perso', 'pro'],
  remainderAccount: 'perso',
  reserve: { account: 'pro-charges', balance: 6000 },
  forecastDays: [19, 20, 10, 12],
  salary: { enabled: true, amount: 2000, savingsAccount: 'epargne', savingsBalance: 3000, targetMonths: 3 },
  items: [
    { id: 'tva', name: 'tva', label: 'TVA', tags: ['pro'], account: 'pro-charges', amountFormula: '-Math.ceil({income} - ({income} / 1.20))', amountRecurrence: 'monthly' },
    { id: 'impot', name: 'impot', label: 'Impôt (acompte)', tags: ['pro'], account: 'pro-charges', amount: -1200, amountRecurrence: 'monthly' },
    { id: 'urssaf', name: 'urssaf', label: 'URSSAF', tags: ['pro'], account: 'pro-charges', amount: -4000, amountRecurrence: 'quarterly', dueMonths: [1, 4, 7, 10], dueDay: 15 },
    { id: 'retraite', name: 'retraite', label: 'Retraite complémentaire', tags: ['pro'], account: 'pro-charges', amount: -700, amountRecurrence: 'monthly' },
    { id: 'epargne', name: 'epargne', label: 'Épargne retraite', tags: ['pro'], account: 'pro-charges', amount: -500, amountRecurrence: 'monthly' },
    { id: 'loyer', name: 'loyer', label: 'Loyer', tags: ['perso'], account: 'pro-charges', amount: -1500, amountRecurrence: 'monthly' },
    { id: 'immo-loyer', name: 'immo-loyer', label: 'Loyer reçu', tags: ['immo'], account: 'banque-immo', amount: 850, amountRecurrence: 'monthly' },
    { id: 'immo-credit', name: 'immo-credit', label: 'Crédit', tags: ['immo'], account: 'banque-immo', amount: -950, amountRecurrence: 'monthly' },
    { id: 'immo-copro', name: 'immo-copro', label: 'Charges copro', tags: ['immo'], account: 'banque-immo', amount: -120, amountRecurrence: 'monthly' },
    { id: 'immo-foncier', name: 'immo-foncier', label: 'Taxe foncière', tags: ['immo'], account: 'banque-immo', amount: -900, amountRecurrence: 'annually', dueMonths: [10], dueDay: 15 },
    { id: 'compta', name: 'compta', label: 'Comptable', tags: ['pro'], account: 'pro-principal', amount: -100, amountRecurrence: 'monthly' },
    { id: 'abos', name: 'abos', label: 'Abonnements', tags: ['perso'], account: 'pro-principal', amount: -150, amountRecurrence: 'monthly' },
  ],
};
