import { useEffect, useMemo, useState } from 'react';
import './App.css';
import type { BudgetData, BudgetItem, Recurrence } from './lib/types';
import { DEFAULT_DATA } from './lib/types';
import { exportBudgetData, loadBudgetData, normalizeImportedData, saveBudgetData } from './lib/storage';
import { computeItems, computeTransfers, round2, sumByAccount, sumByTag } from './lib/compute';
import { SAMPLE_DATA } from './lib/sampleData';
import { uuid } from './lib/uuid';

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

function money(n: number) {
  return eur.format(n);
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.map((x) => x.trim()).filter(Boolean))];
}

function stringToColor(tag: string): string {
  // stable color from tag
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 80% 92%)`;
}

function badgeStyle(tag: string) {
  return { background: stringToColor(tag) } as const;
}

function recurrenceValue(r?: Recurrence): Recurrence {
  if (r === 'annually') return 'annually';
  if (r === 'monthly') return 'monthly';
  return '';
}

export default function App() {
  const [data, setData] = useState<BudgetData>(() => loadBudgetData());
  const [importError, setImportError] = useState<string>('');

  useEffect(() => {
    saveBudgetData(data);
  }, [data]);

  const { computed, skipped } = useMemo(() => computeItems(data), [data]);
  const byTag = useMemo(() => sumByTag(computed), [computed]);

  const tagOptions = useMemo(() => {
    const base = ['professional', 'lmnp', 'trappes', 'couple', 'personal', 'cité pottier'];
    const fromItems = data.items.flatMap((it) => it.tags ?? []);
    return uniq([...base, ...fromItems]).sort((a, b) => a.localeCompare(b));
  }, [data.items]);

  const accountOptions = useMemo(() => {
    return uniq([data.income.account, ...data.items.map((x) => x.account).filter(Boolean)]).sort((a, b) => a.localeCompare(b));
  }, [data.income.account, data.items]);

  function promptNewAccount() {
    const name = window.prompt('Nom du nouveau compte ? (ex: shine-taxes)');
    if (!name) return;
    const cleaned = name.trim();
    if (!cleaned) return;
    // Add a placeholder item so the account appears in the list (no amount/formula => ignored)
    setData((d) => ({
      ...d,
      items: [
        { id: uuid(), name: `account:${cleaned}`, label: `Compte: ${cleaned}`, tags: [], account: cleaned },
        ...d.items,
      ],
    }));
  }

  function promptNewTag() {
    const name = window.prompt('Nom du nouveau tag ? (ex: vacances)');
    if (!name) return;
    const cleaned = name.trim();
    if (!cleaned) return;
    // Persist the tag by adding a placeholder item that carries this tag (ignored in compute)
    setData((d) => ({
      ...d,
      items: [
        { id: uuid(), name: `tag:${cleaned}`, label: `Tag: ${cleaned}`, tags: [cleaned], account: d.income.account },
        ...d.items,
      ],
    }));
  }
  const byAccount = useMemo(() => sumByAccount(computed), [computed]);
  const transfers = useMemo(() => computeTransfers(data, computed), [data, computed]);

  const totals = useMemo(() => {
    const itemsTotal = computed.reduce((acc, x) => acc + x.monthlyAmount, 0);
    return {
      itemsTotal: round2(itemsTotal),
      finalTotal: round2(data.income.amount + itemsTotal),
    };
  }, [computed, data.income.amount]);

  function updateIncome(field: 'amount' | 'account', value: string) {
    setData((d) => ({
      ...d,
      income: {
        ...d.income,
        [field]: field === 'amount' ? Number(value || 0) : value,
      },
    }));
  }

  function pctOfIncome(amount: number): number | null {
    if (!data.income.amount) return null;
    return round2((Math.abs(amount) / data.income.amount) * 100);
  }

  function addItem() {
    const it: BudgetItem = {
      id: uuid(),
      name: 'new-item',
      label: 'New item',
      tags: [],
      account: data.income.account,
      amount: 0,
      amountRecurrence: 'monthly',
    };
    setData((d) => ({ ...d, items: [it, ...d.items] }));
  }

  function updateItem(id: string, patch: Partial<BudgetItem>) {
    setData((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  }

  function deleteItem(id: string) {
    setData((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }));
  }

  function downloadJson() {
    const blob = new Blob([exportBudgetData(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function uploadJson(file: File) {
    setImportError('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const normalized = normalizeImportedData(parsed);
      setData(normalized);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed');
    }
  }

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>Budget</h1>
          <p className="muted">
            Local uniquement (localStorage) • import/export JSON • formules: {'{income}'} et Math.ceil/floor/round/abs/min/max
          </p>
        </div>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={() => setData(SAMPLE_DATA)}>Charger l’exemple</button>
          <button onClick={() => setData(DEFAULT_DATA)}>Réinitialiser</button>
          <button onClick={downloadJson}>Exporter JSON</button>
          <label className="fileBtn">
            Import JSON
            <input
              type="file"
              accept="application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadJson(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </header>

      {importError ? <div className="error">Erreur d’import : {importError}</div> : null}

      <section className="card">
        <h2>Revenu</h2>
        <div className="grid2">
          <label>
            Montant (mensuel)
            <input type="number" value={data.income.amount} onChange={(e) => updateIncome('amount', e.target.value)} />
          </label>
          <label>
            Compte qui reçoit le revenu
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <select value={data.income.account} onChange={(e) => updateIncome('account', e.target.value)}>
                {accountOptions.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
              <button type="button" onClick={promptNewAccount} title="Nouveau compte">+</button>
            </div>
            <div style={{ marginTop: 6 }}>
              <span className="badge" style={badgeStyle(data.income.account)}>{data.income.account}</span>
            </div>
          </label>
        </div>
        <div className="summary">
          <div>
            <b>Total des lignes (mensuel) :</b> {money(totals.itemsTotal)}
          </div>
          <div>
            <b>Revenu + lignes :</b> {money(totals.finalTotal)}
          </div>
          <div className="muted">
            (Sanity check. Les transferts ramènent les comptes à 0 en déplaçant l’argent depuis le compte income.)
          </div>
        </div>
      </section>

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Lignes</h2>
          <button onClick={addItem}>+ Ajouter</button>
        </div>

        <div className="desktopOnly">
          <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Libellé</th>
                <th>Compte</th>
                <th>Tags</th>
                <th>Montant</th>
                <th>Formule</th>
                <th>Récurrence</th>
                <th>Mensuel</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => {
                const ci = computed.find((c) => c.item.id === it.id);
                return (
                  <tr key={it.id}>
                    <td>
                      <input value={it.label} onChange={(e) => updateItem(it.id, { label: e.target.value })} />
                    </td>
                    <td>
                      <select
                        value={it.account}
                        onChange={(e) => updateItem(it.id, { account: e.target.value })}
                      >
                        {accountOptions.map((acc) => (
                          <option key={acc} value={acc}>
                            {acc}
                          </option>
                        ))}
                      </select>
                      <div className="row" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}>
                        <span className="badge" style={badgeStyle(it.account)}>{it.account}</span>
                        <button type="button" onClick={promptNewAccount} title="Nouveau compte">+</button>
                      </div>
                    </td>
                    <td>
                      <div className="badges" style={{ marginBottom: 6 }}>
                        {(it.tags ?? []).map((t) => (
                          <span key={t} className="badge" style={badgeStyle(t)}>
                            {t}
                          </span>
                        ))}
                      </div>
                      <select
                        className="tagSelect"
                        multiple
                        value={it.tags}
                        onChange={(e) => {
                          const values = Array.from(e.currentTarget.selectedOptions).map((o) => o.value);
                          updateItem(it.id, { tags: values });
                        }}
                      >
                        {tagOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <div style={{ marginTop: 6 }}>
                        <button type="button" onClick={promptNewTag} title="Nouveau tag">+</button>
                      </div>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                        <input
                          className="smallInput"
                          type="number"
                          value={typeof it.amount === 'number' ? it.amount : ''}
                          onChange={(e) => updateItem(it.id, { amount: e.target.value === '' ? undefined : Number(e.target.value) })}
                          placeholder="(optionnel)"
                        />
                        {ci ? (
                          (() => {
                            const p = pctOfIncome(ci.monthlyAmount);
                            return p === null ? null : <span className="muted pctInline">{p}%</span>;
                          })()
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <input
                        value={it.amountFormula ?? ''}
                        onChange={(e) => updateItem(it.id, { amountFormula: e.target.value || undefined })}
                        placeholder="Math.ceil({income} - ({income}/1.20))"
                      />
                    </td>
                    <td>
                      <select
                        value={recurrenceValue(it.amountRecurrence)}
                        onChange={(e) => updateItem(it.id, { amountRecurrence: e.target.value as Recurrence })}
                      >
                        <option value="">(mensuel)</option>
                        <option value="monthly">mensuel</option>
                        <option value="annually">annuel</option>
                      </select>
                    </td>
                    <td className={ci ? 'money' : 'muted'}>
                      {ci ? (
                        <>
                          {money(round2(ci.monthlyAmount))}
                          {(() => {
                            const p = pctOfIncome(ci.monthlyAmount);
                            return p === null ? null : <span className="muted pct">— {p}%</span>;
                          })()}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <button className="danger" onClick={() => deleteItem(it.id)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>

        <div className="mobileOnly">
          <div className="cardList">
            {data.items.map((it) => {
              const ci = computed.find((c) => c.item.id === it.id);
              const p = ci ? pctOfIncome(ci.monthlyAmount) : null;
              return (
                <details key={it.id} className="itemCard">
                  <summary className="itemCardSummary">
                    <div className="itemCardSummaryMain">
                      <div className="itemCardTitle">{it.label || it.name}</div>
                      <div className="itemCardSub muted">
                        {ci ? money(round2(ci.monthlyAmount)) : '—'}
                        {p === null ? null : <span className="pct">— {p}%</span>}
                      </div>
                    </div>
                    <div className="itemCardSummaryBadges">
                      <span className="badge" style={badgeStyle(it.account)}>{it.account}</span>
                      {(it.tags ?? []).slice(0, 2).map((t) => (
                        <span key={t} className="badge" style={badgeStyle(t)}>{t}</span>
                      ))}
                      {(it.tags?.length ?? 0) > 2 ? <span className="badge" style={badgeStyle('more')}>+{(it.tags?.length ?? 0) - 2}</span> : null}
                    </div>
                  </summary>

                  <div className="itemCardGrid">
                    <label className="full">
                      Libellé
                      <input value={it.label} onChange={(e) => updateItem(it.id, { label: e.target.value })} />
                    </label>

                    <label>
                      Compte
                      <div className="badges" style={{ marginTop: 6, marginBottom: 6 }}>
                        <span className="badge" style={badgeStyle(it.account)}>{it.account}</span>
                      </div>
                      <select value={it.account} onChange={(e) => updateItem(it.id, { account: e.target.value })}>
                        {accountOptions.map((acc) => (
                          <option key={acc} value={acc}>{acc}</option>
                        ))}
                      </select>
                    </label>
                    <div style={{ alignSelf: 'end' }}>
                      <button type="button" onClick={promptNewAccount} title="Nouveau compte">+</button>
                    </div>

                    <label className="full">
                      Tags
                      <div className="badges" style={{ marginTop: 6, marginBottom: 6 }}>
                        {(it.tags ?? []).map((t) => (
                          <span key={t} className="badge" style={badgeStyle(t)}>{t}</span>
                        ))}
                      </div>
                      <select className="tagSelect" multiple value={it.tags} onChange={(e) => {
                        const values = Array.from(e.currentTarget.selectedOptions).map((o) => o.value);
                        updateItem(it.id, { tags: values });
                      }}>
                        {tagOptions.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <div style={{ marginTop: 6 }}>
                        <button type="button" onClick={promptNewTag} title="Nouveau tag">+</button>
                      </div>
                    </label>

                    <label>
                      Montant
                      <input type="number" value={typeof it.amount === 'number' ? it.amount : ''} onChange={(e) => updateItem(it.id, { amount: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="(optionnel)" />
                      {ci ? (
                        (() => {
                          const p2 = pctOfIncome(ci.monthlyAmount);
                          return p2 === null ? null : <div className="muted" style={{ marginTop: 6 }}>{p2}%</div>;
                        })()
                      ) : null}
                    </label>

                    <label>
                      Mensuel
                      <div className="money">
                        {ci ? money(round2(ci.monthlyAmount)) : '—'}
                        {p === null ? null : <span className="muted pct">— {p}%</span>}
                      </div>
                    </label>

                    <label className="full">
                      Formule
                      <input value={it.amountFormula ?? ''} onChange={(e) => updateItem(it.id, { amountFormula: e.target.value || undefined })} placeholder="-Math.ceil({income} - ({income}/1.20))" />
                    </label>

                    <label>
                      Récurrence
                      <select value={recurrenceValue(it.amountRecurrence)} onChange={(e) => updateItem(it.id, { amountRecurrence: e.target.value as Recurrence })}>
                        <option value="">(mensuel)</option>
                        <option value="monthly">mensuel</option>
                        <option value="annually">annuel</option>
                      </select>
                    </label>

                    <div style={{ alignSelf: 'end' }}>
                      <button className="danger" onClick={() => deleteItem(it.id)}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>

        {skipped.length ? (
          <details style={{ marginTop: 12 }}>
            <summary>Éléments ignorés ({skipped.length})</summary>
            <ul>
              {skipped.map((s) => (
                <li key={s.item.id}>
                  <code>{s.item.label || s.item.name}</code> — {s.reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="grid2">
        <div className="card">
          <h2>Récap par tag</h2>
          <ul>
            {[...byTag.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([tag, val]) => {
                const p = pctOfIncome(val);
                return (
                  <li key={tag}>
                    <span className="badge" style={badgeStyle(tag)}>{tag}</span>
                    <span className="money" style={{ marginLeft: 8 }}>{money(round2(val))}</span>
                    {p === null ? null : <span className="muted pct">— {p}%</span>}
                  </li>
                );
              })}
          </ul>
        </div>

        <div className="card">
          <h2>Récap par compte</h2>
          <ul>
            {[...byAccount.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([acc, val]) => {
                const p = pctOfIncome(val);
                return (
                  <li key={acc}>
                    <span className="badge" style={badgeStyle(acc)}>{acc}</span>
                    <span className="money" style={{ marginLeft: 8 }}>{money(round2(val))}</span>
                    {p === null ? null : <span className="muted pct">— {p}%</span>}
                  </li>
                );
              })}
          </ul>
        </div>
      </section>

      <section className="card">
        <h2>Plan de transferts (depuis le compte de revenu)</h2>
        <p className="muted">
          Objectif: ramener chaque compte à 0 en transférant depuis/vers <code>{data.income.account}</code>.
        </p>

        <h3>À transférer (pour financer)</h3>
        {transfers.toFund.length ? (
          <ul>
            {transfers.toFund.map((t, i) => {
              const p = pctOfIncome(t.amount);
              return (
                <li key={i}>
                  <span className="badge" style={badgeStyle(t.from)}>{t.from}</span>
                  <span style={{ margin: '0 8px' }}>→</span>
                  <span className="badge" style={badgeStyle(t.to)}>{t.to}</span>
                  <span className="money" style={{ marginLeft: 10 }}><b>{money(t.amount)}</b></span>
                  {p === null ? null : <span className="muted pct">— {p}%</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="muted">Rien à financer.</div>
        )}

        <h3 style={{ marginTop: 12 }}>À rapatrier (excédents)</h3>
        {transfers.toRepatriate.length ? (
          <ul>
            {transfers.toRepatriate.map((t, i) => {
              const p = pctOfIncome(t.amount);
              return (
                <li key={i}>
                  <span className="badge" style={badgeStyle(t.from)}>{t.from}</span>
                  <span style={{ margin: '0 8px' }}>→</span>
                  <span className="badge" style={badgeStyle(t.to)}>{t.to}</span>
                  <span className="money" style={{ marginLeft: 10 }}><b>{money(t.amount)}</b></span>
                  {p === null ? null : <span className="muted pct">— {p}%</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="muted">Rien à rapatrier.</div>
        )}
      </section>

      <footer className="footer muted">
        <div>
          Clé localStorage : <code>budget-tool:data:v2</code>
        </div>
      </footer>
    </div>
  );
}
