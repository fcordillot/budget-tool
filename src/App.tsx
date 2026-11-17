import { useEffect, useMemo, useState } from 'react';
import './App.css';
import type { BudgetData, BudgetItem, Recurrence } from './lib/types';
import { DEFAULT_DATA, incomeTTC } from './lib/types';
import { exportBudgetData, loadBudgetData, normalizeImportedData, saveBudgetData, STORAGE_KEY_LABEL, uniqSorted } from './lib/storage';
import { addMonths, computeForecast, computeItems, computePlan, dueBetween, round2, startOfDay, sumByAccount, sumByTag } from './lib/compute';
import { SAMPLE_DATA } from './lib/sampleData';
import { uuid } from './lib/uuid';

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' });
const monthYear = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' });

const money = (n: number) => eur.format(n);
const money0 = (n: number) => eur0.format(n);
const pctFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

const RECURRENCE_LABEL: Record<Recurrence, string> = { monthly: 'mensuel', quarterly: 'trimestriel', annually: 'annuel' };

function badgeColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 75% 90%)`;
}

function Badge({ children, tone }: { children: string; tone?: string }) {
  return (
    <span className="badge" style={{ background: tone ?? badgeColor(children) }}>
      {children}
    </span>
  );
}

function parseNum(s: string): number | undefined {
  const t = s.replace(/\s/g, '').replace(',', '.');
  if (t === '' || t === '-' || t === '.') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Champ numérique tolérant (virgule, saisie partielle), clavier décimal sur iPhone */
function NumberField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number | null | undefined;
  onChange: (n: number | undefined) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    if (parseNum(text) !== value) setText(value == null ? '' : String(value));
  }
  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNum(e.target.value));
      }}
    />
  );
}

function MonthsField({ value, onChange }: { value?: number[]; onChange: (m: number[] | undefined) => void }) {
  const fmt = (v?: number[]) => (v ?? []).join(', ');
  const [text, setText] = useState(fmt(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setText(fmt(value));
  }
  function commit() {
    const months = [...new Set(text.split(/[^0-9]+/).map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b);
    onChange(months.length ? months : undefined);
    setText(fmt(months));
  }
  return <input type="text" inputMode="numeric" value={text} placeholder="ex. 1, 4, 7, 10" onChange={(e) => setText(e.target.value)} onBlur={commit} />;
}

export default function App() {
  const [data, setData] = useState<BudgetData>(() => loadBudgetData());
  const [importError, setImportError] = useState('');
  const today = useMemo(() => startOfDay(new Date()), []);

  useEffect(() => {
    saveBudgetData(data);
  }, [data]);

  const income = incomeTTC(data.income);
  const { computed, skipped, paused } = useMemo(() => computeItems(data), [data]);
  const plan = useMemo(() => computePlan(data, computed, income), [data, computed, income]);
  const byTag = useMemo(() => sumByTag(computed), [computed]);
  const byAccount = useMemo(() => sumByAccount(computed), [computed]);
  const forecast = useMemo(() => computeForecast(data, today), [data, today]);
  const upcoming = useMemo(() => dueBetween(data, today, addMonths(today, 6), income, true), [data, today, income]);
  const forecastAll = [forecast.current, ...forecast.rows];
  const cumul = forecastAll.map((_, i) => round2(forecastAll.slice(0, i + 1).reduce((s, r) => s + r.remainder, 0)));
  const computedById = useMemo(() => new Map(computed.map((c) => [c.item.id, c])), [computed]);

  const accountOptions = data.accounts;
  const ht = round2(income / (1 + data.income.vatRate));

  // ---------- mutations ----------
  const patch = (p: Partial<BudgetData>) => setData((d) => ({ ...d, ...p }));
  const patchIncome = (p: Partial<BudgetData['income']>) => setData((d) => ({ ...d, income: { ...d.income, ...p } }));
  const updateItem = (id: string, p: Partial<BudgetItem>) =>
    setData((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, ...p } : it)) }));
  const deleteItem = (id: string, label: string) => {
    if (!window.confirm(`Supprimer « ${label} » ?`)) return;
    setData((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }));
  };
  const addItem = (account: string) => {
    const it: BudgetItem = { id: uuid(), name: '', label: 'Nouvelle ligne', tags: [], account, amount: 0, amountRecurrence: 'monthly' };
    setData((d) => ({ ...d, items: [...d.items, it] }));
  };

  function promptAdd(kind: 'accounts' | 'tags') {
    const name = window.prompt(kind === 'accounts' ? 'Nom du compte ? (ex. revolut)' : 'Nom du tag ?')?.trim();
    if (!name) return;
    setData((d) => ({ ...d, [kind]: uniqSorted([...d[kind], name]) }));
  }

  function removeFromList(kind: 'accounts' | 'tags', name: string) {
    setData((d) => ({ ...d, [kind]: d[kind].filter((x) => x !== name) }));
  }

  const accountInUse = (a: string) =>
    a === data.income.account || a === data.remainderAccount || a === data.reserve.account || data.items.some((i) => i.account === a);
  const tagInUse = (t: string) => data.items.some((i) => i.tags.includes(t));

  // ---------- import / export ----------
  async function exportJson() {
    const name = `budget-data-${new Date().toISOString().slice(0, 10)}.json`;
    const json = exportBudgetData(data);
    const file = new File([json], name, { type: 'application/json' });
    // iPhone : feuille de partage (Enregistrer dans Fichiers / iCloud Drive)
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Budget' });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    setImportError('');
    try {
      const parsed = JSON.parse(await file.text());
      if (data.items.length && !window.confirm('Remplacer les données actuelles par ce fichier ?')) return;
      setData(normalizeImportedData(parsed));
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import impossible');
    }
  }

  const pct = (n: number) => (income ? ` · ${pctFmt.format((Math.abs(n) / income) * 100)} %` : '');

  // Lignes groupées par compte
  const groups = useMemo(() => {
    const accs = uniqSorted([...data.accounts, ...data.items.map((i) => i.account)]);
    const order = (a: string) => (a === data.income.account ? 0 : a === data.reserve.account ? 1 : 2);
    return accs
      .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
      .map((acc) => ({ acc, items: data.items.filter((i) => i.account === acc) }))
      .filter((g) => g.items.length || g.acc === data.income.account);
  }, [data.accounts, data.items, data.income.account, data.reserve.account]);

  const reserveDues = upcoming.filter((d) => d.item.account === data.reserve.account).slice(0, 1);
  // Provisions pour échéances ponctuelles versées ce mois-ci sur la réserve
  const ponctualProvision = round2(
    -computed
      .filter((c) => c.item.account === data.reserve.account && c.item.amountRecurrence !== 'monthly')
      .reduce((s, c) => s + c.monthlyAmount, 0),
  );
  const reserveAfter = forecast.current.reserveAfter;
  const canSkipProvision =
    reserveAfter !== null && ponctualProvision > 0 && reserveDues.length > 0 && reserveAfter - ponctualProvision >= -reserveDues[0].amount;
  const reserveDueRows = reserveDues.map((d, i) => ({
    due: d,
    left: round2((reserveAfter ?? 0) + reserveDues.slice(0, i + 1).reduce((s, x) => s + x.amount, 0)),
  }));

  return (
    <div className="container">
      <header className="header">
        <h1>Budget</h1>
        <div className="actions">
          <button onClick={exportJson}>Exporter</button>
          <label className="fileBtn">
            Importer
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJson(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
          <details className="menu">
            <summary>⋯</summary>
            <div className="menuBody">
              <button onClick={() => window.confirm('Charger l\'exemple ? Tes données actuelles seront remplacées.') && setData(SAMPLE_DATA)}>
                Charger l'exemple
              </button>
              <button className="danger" onClick={() => window.confirm('Tout effacer ? Pense à exporter avant.') && setData(DEFAULT_DATA)}>
                Réinitialiser
              </button>
            </div>
          </details>
        </div>
      </header>

      {importError ? <div className="error">Erreur d'import : {importError}</div> : null}

      {/* ---------- Virement reçu ---------- */}
      <section className="card">
        <h2>Virement reçu</h2>
        <div className="segmented">
          <button className={data.income.mode === 'days' ? 'on' : ''} onClick={() => patchIncome({ mode: 'days' })}>
            Jours facturés
          </button>
          <button className={data.income.mode === 'amount' ? 'on' : ''} onClick={() => patchIncome({ mode: 'amount' })}>
            Montant TTC
          </button>
        </div>
        <div className="grid3">
          {data.income.mode === 'days' ? (
            <>
              <label>
                Jours
                <NumberField value={data.income.days} onChange={(n) => patchIncome({ days: n ?? 0 })} />
              </label>
              <label>
                TJM HT
                <NumberField value={data.income.dailyRate} onChange={(n) => patchIncome({ dailyRate: n ?? 0 })} />
              </label>
            </>
          ) : (
            <label>
              Montant TTC
              <NumberField value={data.income.amount} onChange={(n) => patchIncome({ amount: n ?? 0 })} />
            </label>
          )}
          <label>
            Arrive sur
            <select value={data.income.account} onChange={(e) => patchIncome({ account: e.target.value })}>
              {accountOptions.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">
          {money(income)} TTC · {money(ht)} HT
          {data.income.dailyRate ? ` · ${round2(ht / data.income.dailyRate)} jours` : ''}
        </p>
      </section>

      {/* ---------- Plan ---------- */}
      <section className="card">
        <h2>Virements à faire</h2>
        <ul className="plan">
          {plan.toFund.map((t) => (
            <li key={t.to}>
              <span>
                <Badge>{t.from}</Badge> → <Badge>{t.to}</Badge>
              </span>
              <b>{money(t.amount)}</b>
            </li>
          ))}
          {plan.toRepatriate.map((t) => (
            <li key={t.from}>
              <span>
                <Badge>{t.from}</Badge> → <Badge>{t.to}</Badge> <span className="muted">excédent</span>
              </span>
              <b>{money(t.amount)}</b>
            </li>
          ))}
          <li>
            <span>
              Garder sur <Badge>{data.income.account}</Badge>
            </span>
            <b>{money(plan.keepOnIncome)}</b>
          </li>
          <li className={plan.remainder < 0 ? 'remainder negative' : 'remainder'}>
            <span>
              <Badge>{data.income.account}</Badge> → <Badge>{data.remainderAccount}</Badge> <span className="muted">ce qui reste</span>
            </span>
            <b>{money(plan.remainder)}</b>
          </li>
        </ul>
        {plan.remainder < 0 ? (
          <div className="warn">
            <b>Il manque {money(-plan.remainder)}.</b> Mets en pause une ligne ce mois-ci (bouton « Pause » sur un PER, une provision
            dont l'échéance est loin...), ou pioche dans la réserve de <b>{data.reserve.account || 'ton sous-compte'}</b> si elle couvre la
            prochaine échéance.
          </div>
        ) : null}
        {paused.length ? (
          <p className="muted">
            En pause ce mois-ci : {paused.map((p) => p.label).join(', ')}.{' '}
            <button className="link" onClick={() => setData((d) => ({ ...d, items: d.items.map((i) => ({ ...i, paused: undefined })) }))}>
              Tout réactiver
            </button>
          </p>
        ) : null}
        <label className="inline">
          Le reste va sur
          <select value={data.remainderAccount} onChange={(e) => patch({ remainderAccount: e.target.value })}>
            {uniqSorted([...accountOptions, data.remainderAccount]).map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      </section>

      {/* ---------- Réserve ---------- */}
      <section className="card">
        <h2>Réserve</h2>
        <div className="grid3">
          <label>
            Compte réserve
            <select value={data.reserve.account} onChange={(e) => patch({ reserve: { ...data.reserve, account: e.target.value } })}>
              <option value="">(aucun)</option>
              {accountOptions.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Solde actuel (avant virement)
            <NumberField
              value={data.reserve.balance}
              onChange={(n) => patch({ reserve: { ...data.reserve, balance: n ?? null } })}
              placeholder="ex. 7 600"
            />
          </label>
        </div>
        {data.reserve.account && forecast.current.reserveAfter !== null ? (
          <>
            <p>
              Après le virement et les prélèvements du mois : <b className={forecast.current.reserveAfter < 0 ? 'neg' : ''}>{money(forecast.current.reserveAfter)}</b>
            </p>
            {reserveDueRows.length ? (
              <ul className="dues">
                {reserveDueRows.map(({ due: d, left }) => (
                  <li key={d.item.id + d.date.toISOString()}>
                    <span>
                      {dayMonth.format(d.date)} · {d.item.label}
                    </span>
                    <span>
                      {money(-d.amount)} <span className={left >= 0 ? 'ok' : 'neg'}>{left >= 0 ? 'couvert' : `manque ${money(-left)}`}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="muted small">Les échéances suivantes sont dans la projection (avec les virements des mois à venir).</p>
            {canSkipProvision ? (
              <div className="warn">
                La réserve couvre déjà la prochaine échéance ({reserveDues[0].item.label} le {dayMonth.format(reserveDues[0].date)}) : si le mois est
                serré, tu peux virer <b>{money(ponctualProvision)}</b> de moins vers {data.reserve.account} (provisions des lignes trimestrielles et
                annuelles).
              </div>
            ) : null}
          </>
        ) : (
          <p className="muted">Choisis le compte réserve et saisis son solde pour vérifier que les prochaines échéances sont couvertes.</p>
        )}
      </section>

      {/* ---------- Projection ---------- */}
      <section className="card">
        <h2>Projection</h2>
        <p className="muted">
          Jours facturés prévus pour les prochains virements (congés, voyages...). « Reste » = ce qui part vers {data.remainderAccount} ; « Cumul » le
          total depuis ce mois, négatif = à financer avec de l'épargne. Les pauses ne s'appliquent qu'au mois en cours.
        </p>
        <div className="tableWrap">
          <table className="forecast">
            <thead>
              <tr>
                <th>Virement</th>
                <th>Jours</th>
                <th>Reste</th>
                <th>Cumul</th>
                <th>Réserve</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr className="current">
                <td>
                  Ce mois<div className="muted small">{money0(forecast.current.income)}</div>
                </td>
                <td>{forecast.current.days}</td>
                <td className={forecast.current.remainder < 0 ? 'neg' : ''}>{money0(forecast.current.remainder)}</td>
                <td className={forecast.current.remainder < 0 ? 'neg' : ''}>{money0(forecast.current.remainder)}</td>
                <td className={(forecast.current.reserveAfter ?? 0) < 0 ? 'neg' : ''}>
                  {forecast.current.reserveAfter === null ? '·' : money0(forecast.current.reserveAfter)}
                </td>
                <td></td>
              </tr>
              {forecast.rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    {monthYear.format(r.date)}
                    <div className="muted small">{money0(r.income)}</div>
                    {r.dues.length ? <div className="muted small">{r.dues.map((d) => d.item.label).join(', ')}</div> : null}
                  </td>
                  <td>
                    <NumberField
                      className="days"
                      value={r.days}
                      onChange={(n) => patch({ forecastDays: data.forecastDays.map((d, j) => (j === i ? n ?? 0 : d)) })}
                    />
                  </td>
                  <td className={r.remainder < 0 ? 'neg' : ''}>{money0(r.remainder)}</td>
                  <td className={cumul[i + 1] < 0 ? 'neg' : ''}>{money0(cumul[i + 1])}</td>
                  <td className={(r.reserveAfter ?? 0) < 0 ? 'neg' : ''}>{r.reserveAfter === null ? '·' : money0(r.reserveAfter)}</td>
                  <td>
                    {i === forecast.rows.length - 1 ? (
                      <button className="link" onClick={() => patch({ forecastDays: data.forecastDays.slice(0, -1) })} title="Retirer">
                        ×
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.forecastDays.length < 12 ? (
          <button className="small" onClick={() => patch({ forecastDays: [...data.forecastDays, data.forecastDays.at(-1) ?? 19] })}>
            + Mois
          </button>
        ) : null}
      </section>

      {/* ---------- Échéances ---------- */}
      <section className="card">
        <h2>Échéances des 6 prochains mois</h2>
        {upcoming.length ? (
          <ul className="dues">
            {upcoming.map((d) => (
              <li key={d.item.id + d.date.toISOString()} className={d.item.paused ? 'isPaused' : ''}>
                <span>
                  {dayMonth.format(d.date)} · {d.item.label} <Badge>{d.item.account}</Badge>
                </span>
                <b>{money(d.amount)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Aucune. Renseigne les mois d'échéance sur les lignes trimestrielles ou annuelles.</p>
        )}
      </section>

      {/* ---------- Lignes ---------- */}
      <section className="card">
        <h2>Lignes</h2>
        {groups.map(({ acc, items }) => (
          <div key={acc} className="group">
            <div className="groupHead">
              <span>
                <Badge>{acc}</Badge>
                {acc === data.income.account ? <span className="muted"> reçoit le virement</span> : null}
                {acc === data.reserve.account ? <span className="muted"> réserve</span> : null}
              </span>
              <span className="money">{money(byAccount.get(acc) ?? 0)}/mois</span>
            </div>
            <div className="cardList">
              {items.map((it) => {
                const ci = computedById.get(it.id);
                const isFormula = it.amountFormula !== undefined;
                const rec = it.amountRecurrence ?? 'monthly';
                return (
                  <details key={it.id} className={`itemCard${it.paused ? ' isPaused' : ''}`}>
                    <summary>
                      <div>
                        <div className="itemTitle">{it.label || it.name || '(sans nom)'}</div>
                        <div className="muted small">
                          {rec !== 'monthly' && ci ? `${money(ci.baseAmount)} ${RECURRENCE_LABEL[rec]}` : RECURRENCE_LABEL[rec]}
                          {it.dueMonths?.length ? ` · mois ${it.dueMonths.join(', ')}` : ''}
                          {it.tags.length ? ` · ${it.tags.join(', ')}` : ''}
                        </div>
                      </div>
                      <div className={`itemAmount ${ci && ci.monthlyAmount > 0 ? 'pos' : ''}`}>
                        {it.paused ? 'en pause' : ci ? money(round2(ci.monthlyAmount)) : '·'}
                        {ci && !it.paused ? <span className="muted small">{pct(ci.monthlyAmount)}</span> : null}
                      </div>
                    </summary>

                    <div className="itemGrid">
                      <label className="full">
                        Libellé
                        <input value={it.label} onChange={(e) => updateItem(it.id, { label: e.target.value })} />
                      </label>
                      <label>
                        Compte
                        <select value={it.account} onChange={(e) => updateItem(it.id, { account: e.target.value })}>
                          {accountOptions.map((a) => (
                            <option key={a}>{a}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Type
                        <select
                          value={isFormula ? 'formula' : (it.amount ?? 0) > 0 ? 'in' : 'out'}
                          onChange={(e) => {
                            const v = e.target.value;
                            const abs = Math.abs(it.amount ?? 0);
                            if (v === 'formula') updateItem(it.id, { amount: undefined, amountFormula: it.amountFormula ?? '-({income} * 0.1)' });
                            else updateItem(it.id, { amountFormula: undefined, amount: v === 'in' ? abs : -abs });
                          }}
                        >
                          <option value="out">Sortie</option>
                          <option value="in">Entrée</option>
                          <option value="formula">Formule</option>
                        </select>
                      </label>
                      {isFormula ? (
                        <label className="full">
                          Formule ({'{income}'} = virement TTC)
                          <input
                            value={it.amountFormula ?? ''}
                            onChange={(e) => updateItem(it.id, { amountFormula: e.target.value })}
                            placeholder="-Math.ceil({income} - ({income} / 1.20))"
                          />
                        </label>
                      ) : (
                        <label>
                          Montant {rec === 'monthly' ? '' : rec === 'quarterly' ? 'par trimestre' : 'par an'}
                          <NumberField
                            value={it.amount === undefined ? undefined : Math.abs(it.amount)}
                            onChange={(n) => updateItem(it.id, { amount: n === undefined ? 0 : (it.amount ?? -1) > 0 ? Math.abs(n) : -Math.abs(n) })}
                          />
                        </label>
                      )}
                      <label>
                        Récurrence
                        <select value={rec} onChange={(e) => updateItem(it.id, { amountRecurrence: e.target.value as Recurrence })}>
                          <option value="monthly">mensuel</option>
                          <option value="quarterly">trimestriel</option>
                          <option value="annually">annuel</option>
                        </select>
                      </label>
                      {rec !== 'monthly' ? (
                        <>
                          <label>
                            Mois d'échéance
                            <MonthsField value={it.dueMonths} onChange={(m) => updateItem(it.id, { dueMonths: m })} />
                          </label>
                          <label>
                            Jour
                            <NumberField
                              value={it.dueDay}
                              placeholder="15"
                              onChange={(n) => updateItem(it.id, { dueDay: n && n >= 1 && n <= 31 ? Math.round(n) : undefined })}
                            />
                          </label>
                        </>
                      ) : null}
                      <div className="full">
                        <div className="labelText">Tags</div>
                        <div className="chips">
                          {data.tags.map((t) => {
                            const on = it.tags.includes(t);
                            return (
                              <button
                                key={t}
                                className={`chip${on ? ' on' : ''}`}
                                style={on ? { background: badgeColor(t) } : undefined}
                                onClick={() => updateItem(it.id, { tags: on ? it.tags.filter((x) => x !== t) : [...it.tags, t] })}
                              >
                                {t}
                              </button>
                            );
                          })}
                          <button className="chip add" onClick={() => promptAdd('tags')}>
                            + tag
                          </button>
                        </div>
                      </div>
                      <div className="full itemActions">
                        <button onClick={() => updateItem(it.id, { paused: it.paused ? undefined : true })}>
                          {it.paused ? 'Réactiver' : 'Pause ce mois'}
                        </button>
                        <button className="danger" onClick={() => deleteItem(it.id, it.label)}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
            <button className="small" onClick={() => addItem(acc)}>
              + Ligne sur {acc}
            </button>
          </div>
        ))}

        {skipped.length ? (
          <details className="skipped">
            <summary>Lignes ignorées ({skipped.length})</summary>
            <ul>
              {skipped.map((s) => (
                <li key={s.item.id}>
                  <code>{s.item.label || s.item.name}</code> : {s.reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {/* ---------- Récaps ---------- */}
      <section className="grid2">
        <div className="card">
          <h2>Par compte</h2>
          <ul className="recap">
            {[...byAccount.entries()]
              .sort((a, b) => a[1] - b[1])
              .map(([acc, val]) => (
                <li key={acc}>
                  <Badge>{acc}</Badge>
                  <span className="money">
                    {money(round2(val))}
                    <span className="muted small">{pct(val)}</span>
                  </span>
                </li>
              ))}
          </ul>
        </div>
        <div className="card">
          <h2>Par tag</h2>
          <ul className="recap">
            {[...byTag.entries()]
              .sort((a, b) => a[1] - b[1])
              .map(([tag, val]) => (
                <li key={tag}>
                  <Badge>{tag}</Badge>
                  <span className="money">
                    {money(round2(val))}
                    <span className="muted small">{pct(val)}</span>
                  </span>
                </li>
              ))}
          </ul>
          <p className="muted small">Une ligne avec plusieurs tags compte dans chacun.</p>
        </div>
      </section>

      {/* ---------- Comptes & tags ---------- */}
      <section className="card">
        <h2>Comptes et tags</h2>
        <div className="labelText">Comptes</div>
        <div className="chips">
          {data.accounts.map((a) => (
            <span key={a} className="chip on" style={{ background: badgeColor(a) }}>
              {a}
              {!accountInUse(a) ? (
                <button className="x" onClick={() => removeFromList('accounts', a)} title="Retirer">
                  ×
                </button>
              ) : null}
            </span>
          ))}
          <button className="chip add" onClick={() => promptAdd('accounts')}>
            + compte
          </button>
        </div>
        <div className="labelText" style={{ marginTop: 12 }}>
          Tags
        </div>
        <div className="chips">
          {data.tags.map((t) => (
            <span key={t} className="chip on" style={{ background: badgeColor(t) }}>
              {t}
              {!tagInUse(t) ? (
                <button className="x" onClick={() => removeFromList('tags', t)} title="Retirer">
                  ×
                </button>
              ) : null}
            </span>
          ))}
          <button className="chip add" onClick={() => promptAdd('tags')}>
            + tag
          </button>
        </div>
      </section>

      <footer className="footer muted small">
        Données stockées dans ce navigateur uniquement (<code>{STORAGE_KEY_LABEL}</code>). Exporte régulièrement.
      </footer>
    </div>
  );
}
