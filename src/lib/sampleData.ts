import type { BudgetData } from './types';

export const SAMPLE_DATA: BudgetData = {
  income: { amount: 0, account: 'shine-personal' },
  items: [
    { id: 'tva', name: 'tva', label: 'TVA', tags: ['professional'], account: 'shine-taxes', amountFormula: '-Math.ceil({income} - ({income} / 1.20))', amountRecurrence: 'monthly' },
    { id: 'impot', name: 'impot', label: 'Impôt', tags: ['professional'], account: 'shine-taxes', amount: -941 },
    { id: 'ircec', name: 'ircec', label: 'IRCEC', tags: ['professional'], account: 'shine-taxes', amount: -500, amountRecurrence: 'monthly' },
    { id: 'urssaf', name: 'urssaf', label: 'URSSAF', tags: ['professional'], account: 'shine-taxes', amount: -10000, amountRecurrence: 'annually' },
    { id: 'swisslife', name: 'swisslife', label: 'Prévoyance (SwissLife)', tags: ['professional'], account: 'shine-taxes', amount: -50, amountRecurrence: 'monthly' },
    { id: 'per', name: 'per', label: 'PER (Abeille Assurances)', tags: ['professional'], account: 'shine-taxes', amount: -350, amountRecurrence: 'monthly' },
    { id: 'trappes-rent', name: 'trappes-rent', label: 'Loyer reçu', tags: ['lmnp', 'trappes'], account: 'bp', amount: 890, amountRecurrence: 'monthly' },
    { id: 'trappes-credit', name: 'trappes-credit', label: 'Crédit habitation', tags: ['lmnp', 'trappes'], account: 'bp', amount: -1050, amountRecurrence: 'monthly' },
    { id: 'trappes-charges', name: 'trappes-charges', label: 'Charges (LAMY)', tags: ['lmnp', 'trappes'], account: 'bp', amount: -90, amountRecurrence: 'monthly' },
    { id: 'trappes-imodirect', name: 'trappes-imodirect', label: 'Imodirect', tags: ['lmnp', 'trappes'], account: 'bp', amount: -80, amountRecurrence: 'monthly' },
    { id: 'pottier-rent', name: 'pottier-rent', label: 'Loyer', tags: ['couple', 'cité pottier'], account: 'shine-taxes', amount: -1780, amountRecurrence: 'monthly' },
    { id: 'pottier-electricity', name: 'pottier-electricity', label: 'Electricité', tags: ['couple', 'cité pottier'], account: 'shine-personal', amount: -79, amountRecurrence: 'monthly' },
    { id: 'pottier-internet', name: 'pottier-internet', label: 'Internet', tags: ['couple', 'cité pottier'], account: 'shine-personal', amount: -25, amountRecurrence: 'monthly' },
    { id: 'mobile', name: 'mobile', label: 'Mobile', tags: ['personal'], account: 'shine-personal', amount: -10, amountRecurrence: 'monthly' },
    { id: 'spotify', name: 'spotify', label: 'Spotify', tags: ['personal'], account: 'shine-personal', amount: -13, amountRecurrence: 'monthly' },
    { id: 'netflix', name: 'netflix', label: 'Netflix', tags: ['personal'], account: 'shine-personal', amount: -8, amountRecurrence: 'monthly' },
    { id: 'amazon-prime', name: 'amazon-prime', label: 'Amazon Prime', tags: ['personal'], account: 'shine-personal', amount: -70, amountRecurrence: 'annually' },
    { id: 'chatgpt', name: 'chatgpt', label: 'ChatGPT', tags: ['professional'], account: 'shine-personal', amount: -25, amountRecurrence: 'monthly' },
    { id: 'cursor', name: 'cursor', label: 'Cursor', tags: ['professional'], account: 'shine-personal', amount: -25, amountRecurrence: 'monthly' },
    { id: 'pottier-assurance', name: 'pottier-assurance', label: 'Assurance habitation', tags: ['couple', 'cité pottier'], account: 'shine-personal', amount: -20, amountRecurrence: 'monthly' },
    { id: 'bank-charges', name: 'bank-charges', label: 'Frais bancaires', tags: ['personal'], account: 'bp', amount: -30, amountRecurrence: 'monthly' }
  ]
};
