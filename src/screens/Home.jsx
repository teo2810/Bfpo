import { useEffect, useMemo, useRef, useState } from 'react';
import { quoteBond, formatEUR, formatLire, formatDate, formatPct, formatPctInt, daysUntil, maturazione, nominaleEUR, valoreScadenzaEUR } from '../lib/quote.js';
import { isRitirato, riepilogoRitirati } from '../lib/ritirati.js';
import { savePortfolio, assignBondsToPortfolio } from '../lib/db.js';
import IncludiBuoni from '../components/IncludiBuoni.jsx';
import SheetBack from '../components/SheetBack.jsx';
import { BackIcon } from '../components/icons.jsx';
import { chromeOf } from '../components/icons.jsx';
import Ring from '../components/Ring.jsx';

export function urgencyOf(bond, now = new Date()) {
  const dScad = daysUntil(bond.dataScadenza, now);
  const dPres = daysUntil(bond.dataPrescrizione, now);
  const gg = (n) => (n === 1 ? '1 giorno' : `${n} gg`);

  if (dPres != null && dPres <= 90) {
    return {
      level: 'danger',
      label: dPres < 0 ? `Prescritto da ${gg(-dPres)}` : dPres === 0 ? 'Si prescrive oggi' : `Prescrizione tra ${gg(dPres)}`,
      criticalDays: dPres,
    };
  }
  if (dScad != null && dScad <= 90) {
    return {
      level: 'warn',
      label: dScad < 0 ? `Scaduto da ${gg(-dScad)}` : dScad === 0 ? 'Scade oggi' : `Scadenza tra ${gg(dScad)}`,
      criticalDays: dScad,
    };
  }
  // Prossima data rilevante ancora futura (la scadenza passata non conta più).
  const future = [dScad, dPres].filter((d) => d != null && d >= 0);
  return { level: 'ok', label: null, criticalDays: future.length ? Math.min(...future) : Infinity };
}

export function byCriticalDays(a, b) {
  const x = a.urgency.criticalDays;
  const y = b.urgency.criticalDays;
  if (x === y) return String(a.bond.numero || '').localeCompare(String(b.bond.numero || ''));
  if (x === Infinity) return 1;
  if (y === Infinity) return -1;
  return x - y;
}

const pct = (v) => (v == null ? null : Math.round(v * 100));

const LEAF = (
  <svg className="hero-leaf" viewBox="0 0 160 160" fill="currentColor" aria-hidden="true">
    <path d="M128 18c-38 8-78 46-74 108 28-18 62-22 86-48 14-16 18-38 10-54-6-10-14-12-22-6Z" />
    <path d="M62 118c22-28 52-48 76-58" fill="none" stroke="#06343c" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
  </svg>
);
const LEAF2 = (
  <svg className="hero-leaf-2" viewBox="0 0 120 120" fill="currentColor" aria-hidden="true">
    <path d="M96 16c-30 10-58 40-54 86 22-12 48-16 66-38 10-12 12-28 6-40-4-8-10-10-18-8Z" />
  </svg>
);

const PF_COLORS = [
  { key: 'cyan', label: 'Azzurro', var: 'var(--cyan)' },
  { key: 'mint', label: 'Verde', var: 'var(--mint)' },
  { key: 'amber', label: 'Ambra', var: 'var(--amber)' },
  { key: 'coral', label: 'Corallo', var: 'var(--coral)' },
  { key: 'violet', label: 'Viola', var: 'var(--violet)' },
];

const LONG_MS = 450;
const MOVE_PX = 8;

function BondRow({ bond, quote, urgency, portfolio, mat, onOpen, ritirato = false, selecting = false, selected = false, onToggle, onLongPress }) {
  const { tone, Icon } = chromeOf(bond, portfolio);
  const p = pct(mat);
  const who = bond.intestatari?.length ? bond.intestatari.join(' e ') : 'Nessun intestatario';
  const lp = useRef({});
  const cancelLp = () => {
    if (lp.current.t) clearTimeout(lp.current.t);
    lp.current.t = null;
  };
  const onPointerDown = (e) => {
    if (ritirato) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelLp();
    lp.current = {
      x: e.clientX,
      y: e.clientY,
      fired: false,
      t: setTimeout(() => {
        lp.current.fired = true;
        onLongPress?.(bond.id);
      }, LONG_MS),
    };
  };
  const onPointerMove = (e) => {
    if (!lp.current.t) return;
    const dx = e.clientX - lp.current.x;
    const dy = e.clientY - lp.current.y;
    if (dx * dx + dy * dy > MOVE_PX * MOVE_PX) cancelLp();
  };
  const onClick = (e) => {
    if (lp.current.fired) {
      e.preventDefault();
      lp.current.fired = false;
      return;
    }
    if (selecting) onToggle?.(bond.id);
    else onOpen(bond.id);
  };
  return (
    <button
      type="button"
      className={`row bond-row${selecting ? ' is-selecting' : ''}${selected ? ' is-selected' : ''}`}
      data-testid={`bond-row-${bond.id}`}
      aria-pressed={selecting ? selected : undefined}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancelLp}
      onPointerCancel={cancelLp}
      onContextMenu={(e) => { e.preventDefault(); }}
      style={{
        ['--row-accent']: `var(--${tone})`,
        ['--row-bg']: `var(--${tone}-bg)`,
        ['--row-ink']: `var(--${tone}-ink, var(--${tone}))`,
      }}
    >
      {selecting && (
        <span className={`sel-check${selected ? ' on' : ''}`} aria-hidden="true" data-testid={`bond-check-${bond.id}`} />
      )}
      <span className="bond-main">
      <span className="bond-top">
        <span className="tile" aria-hidden="true"><Icon size={20} /></span>
        <span className="left">
          <span className="name">{
            ritirato && !bond.serie
              ? (bond.numero ? `Ordinario · Ritirato · n. ${bond.numero}` : 'Ordinario · Ritirato')
              : (bond.numero ? `${bond.serie || 'Buono'} · n. ${bond.numero}` : (bond.serie || 'Buono'))
          }</span>
          <span className="meta">{who}</span>
          <span className={`pf-tag${portfolio ? '' : ' is-none'}`} data-testid="bond-pf">
            {portfolio ? (
              <>
                <span className="dot-lg" style={{ background: `var(--${portfolio.colore || 'cyan'})` }} />
                <span className="pf-tag-name">{portfolio.nome}</span>
              </>
            ) : '—'}
          </span>
        </span>
        <span className="amount-col">
          {ritirato ? (
            <>
              <span className="amount" data-testid="importo-incassato">{formatEUR(bond.importoIncassato)}</span>
              <span className="amount-sub" data-testid="data-rimborso">{bond.dataRimborso ? formatDate(bond.dataRimborso) : 'Ritirato'}</span>
            </>
          ) : (
            <>
              <span className="amount">{formatEUR(quote.valore)}</span>
              {quote.valuta === 'ITL' && <span className="amount-sub" data-testid="importo-lire">da {formatLire(bond.nominale)}</span>}
            </>
          )}
        </span>
      </span>
      {!ritirato && p != null && (
        <span className="mat" title="Maturazione stimata">
          <span className="mat-track"><i style={{ width: `${p}%` }} /></span>
          <span className="mat-pct pc">{p}%</span>
        </span>
      )}
      {!ritirato && urgency.label && <span className={`pill ${urgency.level}`}>{urgency.label}</span>}
      </span>
    </button>
  );
}

export default function Home({
  bonds,
  portfolios,
  lastOpenedPrevious,
  onOpenBond,
  onGoAdd,
  demoActive,
  onStartFresh,
  titleOverride,
  subtitleOverride,
  onBack,
  selecting = false,
  onEnterSelect,
  onExitSelect,
  onDataChanged,
}) {
  const [filter, setFilter] = useState('all');
  const [pfFilter, setPfFilter] = useState('all');
  const [pfOpen, setPfOpen] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [sposta, setSposta] = useState(false); // false | 'choose' | 'nuovo' | 'includi'
  const [newNome, setNewNome] = useState('');
  const [newColore, setNewColore] = useState('cyan');
  const [pfError, setPfError] = useState('');
  const [pendingPf, setPendingPf] = useState(null);
  useEffect(() => {
    if (!selecting) {
      setPicked(new Set());
      setSposta(false);
      setPfError('');
      setPendingPf(null);
    }
  }, [selecting]);
  const vistaRitirati = filter === 'ritirati';
  const pfAttivo = portfolios.find((p) => p.id === pfFilter);
  const enriched = useMemo(() => {
    const now = new Date();
    return bonds.filter((b) => !isRitirato(b)).map((b) => ({ bond: b, quote: quoteBond(b, now), urgency: urgencyOf(b, now), mat: maturazione(b, now) }));
  }, [bonds]);
  const enrichedRitirati = useMemo(() => {
    const now = new Date();
    return bonds.filter(isRitirato)
      .map((b) => ({ bond: b, quote: quoteBond(b, now), urgency: { label: null, level: 'ok' }, mat: null }))
      .sort((a, b) => String(b.bond.dataRimborso || '').localeCompare(String(a.bond.dataRimborso || '')));
  }, [bonds]);
  const recap = useMemo(() => riepilogoRitirati(bonds), [bonds]);

  const totale = enriched.reduce((sum, e) => sum + e.quote.valore, 0);
  const capitale = enriched.reduce((sum, e) => sum + nominaleEUR(e.bond), 0);
  const interessi = totale - capitale;
  const sorted = [...enriched].sort(byCriticalDays);

  // Maturazione complessiva: interessi maturati / interessi a scadenza (solo buoni stimabili).
  const matTot = (() => {
    let num = 0;
    let den = 0;
    for (const e of enriched) {
      const vs = valoreScadenzaEUR(e.bond) ?? NaN;
      const n = nominaleEUR(e.bond);
      if (vs > n) {
        num += Math.max(0, e.quote.valore - n);
        den += vs - n;
      }
    }
    return den > 0 ? num / den : null;
  })();

  const showFilters = !onBack && bonds.length > 0;
  useEffect(() => {
    if (filter !== 'all' && filter !== 'ritirare' && filter !== 'ritirati') setFilter('all');
    if (pfFilter !== 'all' && !portfolios.some((p) => p.id === pfFilter)) setPfFilter('all');
  }, [filter, pfFilter, portfolios]);
  const inPf = (e) => pfFilter === 'all' || e.bond.portafoglioId === pfFilter;
  const visible = (vistaRitirati ? enrichedRitirati : sorted.filter((e) => {
    if (filter === 'ritirare') return e.urgency.level !== 'ok';
    return true;
  })).filter(inPf);

  const notVerified =
    lastOpenedPrevious && (Date.now() - new Date(lastOpenedPrevious).getTime()) / 86400000 > 90;
  const portfolioOf = (id) => portfolios.find((p) => p.id === id);

  const enterWith = (id) => {
    setPicked(new Set([id]));
    onEnterSelect?.();
  };
  const togglePick = (id) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const attivi = bonds.filter((b) => !isRitirato(b));
  const spostaIn = async (portafoglioId) => {
    const ids = [...picked];
    if (!ids.length) return;
    await assignBondsToPortfolio(ids, portafoglioId);
    await onDataChanged?.();
    onExitSelect?.();
  };
  const creaEIncludi = async () => {
    if (!newNome.trim()) return;
    if (portfolios.some((p) => p.nome.trim().toLowerCase() === newNome.trim().toLowerCase())) {
      setPfError(`Esiste già un portafoglio chiamato «${newNome.trim()}».`);
      return;
    }
    setPfError('');
    const created = await savePortfolio({ nome: newNome.trim(), colore: newColore });
    setPendingPf(created);
    setSposta('includi');
  };
  const confermaIncludi = async () => {
    if (pendingPf) await assignBondsToPortfolio([...picked], pendingPf.id);
    await onDataChanged?.();
    onExitSelect?.();
  };


  return (
    <div className={`screen screen-enter screen-pin${selecting && !vistaRitirati ? " has-sel-bar" : ""}`}>
      {demoActive && (
        <div className="banner info">
          <span>Stai vedendo dati dimostrativi.</span>
          <button className="link-btn" onClick={onStartFresh}>Inizia con i tuoi</button>
        </div>
      )}

      {notVerified && (
        <div className="banner">
          <strong>Cassetto non verificato.</strong> Non apri l'app da più di 90 giorni: controlla che
          scadenze e prescrizioni siano ancora corrette confrontando i titoli cartacei.
        </div>
      )}

      <header className="stat-hero hero-main" data-testid="home-hero">
        {LEAF}{LEAF2}
        <div className="hero-top">
          <div style={{ minWidth: 0 }}>
            {onBack ? (
              <>
                <button className="icon-btn on-brand" onClick={onBack} aria-label="Indietro"><BackIcon /></button>
                <h1 className="title hero-title">{titleOverride || 'Portafoglio'}</h1>
                <p className="hero-sub">{subtitleOverride || 'Buoni di questo portafoglio.'}</p>
              </>
            ) : (
              <p className="hero-hello">Ciao,</p>
            )}
            {vistaRitirati ? (
              <>
                <p className="value is-stima" data-testid="totale-incassato">{formatEUR(recap.incassato)}</p>
                <p className="hero-sub">totale incassato</p>
              </>
            ) : (
              <>
                <p className="value is-stima" data-testid="totale">{formatEUR(totale)}</p>
                <p className="hero-sub">totale stimato</p>
              </>
            )}
          </div>
          {vistaRitirati ? (
            <Ring
              value={recap.rendimento == null ? 0 : Math.min(1, Math.abs(recap.rendimento))}
              label={formatPctInt(recap.rendimento)}
              caption="resa"
              stroke={recap.differenza < 0 ? 'var(--coral)' : 'var(--ring)'}
            />
          ) : (
            <Ring value={matTot} label={matTot == null ? '—' : `${pct(matTot)}%`} caption="maturato" />
          )}
        </div>
        <div className="split-bar" aria-hidden="true">
          {vistaRitirati ? (
            recap.differenza >= 0 ? (
              <>
                <span className="cap" style={{ flex: Math.max(recap.nominale, 0.0001) }} />
                <span className="int" style={{ flex: Math.max(recap.differenza, 0.0001) }} />
              </>
            ) : (
              <>
                <span className="cap" style={{ flex: Math.max(recap.incassato, 0.0001) }} />
                <span className="int neg" style={{ flex: Math.max(-recap.differenza, 0.0001) }} />
              </>
            )
          ) : (
            <>
              <span className="cap" style={{ flex: Math.max(capitale, 0.0001) }} />
              <span className="int" style={{ flex: Math.max(interessi, 0.0001) }} />
            </>
          )}
        </div>
        <div className="hero-legend">
          {vistaRitirati ? (
            <>
              <div>
                <div className="leg-name"><span className="dot cap" />Nominale</div>
                <div className="leg-val">{formatEUR(recap.nominale)}</div>
              </div>
              <div>
                <div className="leg-name"><span className={`dot int${recap.differenza < 0 ? ' neg' : ''}`} />Rendimento</div>
                <div className="leg-val">{formatEUR(recap.differenza)}{recap.rendimento != null ? ` · ${formatPct(recap.rendimento)}` : ''}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="leg-name"><span className="dot cap" />Capitale</div>
                <div className="leg-val">{formatEUR(capitale)}</div>
              </div>
              <div>
                <div className="leg-name"><span className="dot int" />Interessi</div>
                <div className="leg-val">{formatEUR(interessi)}</div>
              </div>
            </>
          )}
        </div>
      </header>

      {bonds.length === 0 ? (
        <div className="body-pad screen-col">
          <div className="screen-scroll" data-testid="list-scroll"><div className="empty">
          <div className="icon">🗂️</div>
          <p>Nessun buono ancora indicizzato.</p>
          <button className="btn primary" style={{ marginTop: 14, width: 'auto', padding: '0 24px' }} onClick={onGoAdd}>
            Aggiungi il primo buono
          </button>
        </div></div>
        </div>
      ) : (
        <div className="body-pad screen-col">
          {showFilters && (
            <div className="pin-tools">
            <div className="filters" role="tablist" aria-label="Filtra i buoni" data-testid="filtri">
              {[
                { key: 'all', label: 'Tutti' },
                { key: 'ritirare', label: 'Da ritirare' },
                { key: 'ritirati', label: 'Ritirati' },
              ].map((f) => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  title={f.label}
                  data-testid={`filtro-${f.key}`}
                  className={`chip${filter === f.key ? ' on' : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {portfolios.length > 0 && (
              <button
                type="button"
                className={`pf-switch${pfFilter !== 'all' ? ' on' : ''}`}
                data-testid="filtro-portafogli"
                aria-haspopup="listbox"
                aria-expanded={pfOpen}
                onClick={() => setPfOpen(true)}
              >
                {pfAttivo ? pfAttivo.nome : `Portafogli (${portfolios.length})`}
              </button>
            )}
            </div>
          )}
          <div className="screen-scroll" data-testid="list-scroll">
          {vistaRitirati && (
            <div className="card ritirati-recap" data-testid="ritirati-recap">
              <p className="eyebrow">Confronto con il nominale</p>
              <div className="recap-row"><span className="recap-label">Incassato</span><span className="recap-val" data-testid="recap-incassato">{formatEUR(recap.incassato)}</span></div>
              <div className="recap-row"><span className="recap-label">Nominale</span><span className="recap-val" data-testid="recap-nominale">{formatEUR(recap.nominale)}</span></div>
              <div className="recap-row"><span className="recap-label">Differenza</span><span className="recap-val" data-testid="recap-differenza">{formatEUR(recap.differenza)}</span></div>
              {recap.rendimento != null && (
                <div className="recap-row"><span className="recap-label">Rendimento</span><span className="recap-val" data-testid="recap-rendimento">{formatPct(recap.rendimento)}</span></div>
              )}
              {recap.tassoMedio != null && (
                <div className="recap-row"><span className="recap-label">Tasso medio annuo</span><span className="recap-val" data-testid="recap-tasso-medio">{formatPct(recap.tassoMedio)}</span></div>
              )}
            </div>
          )}
          <div className="list bond-list">
            {visible.map((e) => (
              <BondRow
                key={e.bond.id}
                {...e}
                ritirato={vistaRitirati}
                portfolio={portfolioOf(e.bond.portafoglioId)}
                onOpen={onOpenBond}
                selecting={selecting && !vistaRitirati}
                selected={picked.has(e.bond.id)}
                onToggle={togglePick}
                onLongPress={vistaRitirati ? undefined : (selecting ? togglePick : enterWith)}
              />
            ))}
            {visible.length === 0 && <div className="empty" style={{ gridColumn: '1 / -1' }}><p>Nessun buono in questo filtro.</p></div>}
          </div>
          {onBack && (
            <button className="btn ghost block" style={{ marginTop: 14 }} onClick={onGoAdd}>+ Aggiungi buono qui</button>
          )}
          </div>
        </div>
      )}

      {pfOpen && (
        <SheetBack data-testid="pf-sheet" onClick={() => setPfOpen(false)}>
          <div className="card sheet-card" onClick={(e) => e.stopPropagation()} role="listbox" aria-label="Portafogli">
            <p className="eyebrow">Portafogli</p>
            <div className="includi-list">
              <button
                type="button"
                className={`includi-row as-btn${pfFilter === 'all' ? ' on' : ''}`}
                data-testid="filtro-pf-all"
                aria-selected={pfFilter === 'all'}
                onClick={() => { setPfFilter('all'); setPfOpen(false); }}
              >
                Tutti i portafogli
              </button>
              {portfolios.map((pf) => {
                const n = bonds.filter((b) => !isRitirato(b) && b.portafoglioId === pf.id).length;
                return (
                  <button
                    key={pf.id}
                    type="button"
                    className={`includi-row as-btn${pfFilter === pf.id ? ' on' : ''}`}
                    data-testid={`filtro-${pf.id}`}
                    aria-selected={pfFilter === pf.id}
                    onClick={() => { setPfFilter(pf.id); setPfOpen(false); }}
                  >
                    <span className="dot-lg" style={{ background: `var(--${pf.colore})` }} />
                    <span>{pf.nome}</span>
                    <span className="meta">{n === 1 ? '1 buono' : `${n} buoni`}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn ghost block" style={{ marginTop: 12 }} onClick={() => setPfOpen(false)}>Chiudi</button>
          </div>
        </SheetBack>
      )}

      {selecting && !vistaRitirati && (
        <div className="sel-bar" data-testid="sel-bar" role="toolbar" aria-label="Selezione buoni">
          <span className="sel-count" data-testid="sel-count">{picked.size === 1 ? '1 selezionato' : `${picked.size} selezionati`}</span>
          <button type="button" className="btn ghost" data-testid="sel-annulla" onClick={() => onExitSelect?.()}>Annulla</button>
          <button
            type="button"
            className="btn primary"
            data-testid="sel-sposta"
            disabled={picked.size === 0}
            onClick={() => { setSposta('choose'); setPfError(''); }}
          >
            Sposta in portafoglio
          </button>
        </div>
      )}

      {sposta === 'choose' && (
        <SheetBack data-testid="sposta-sheet" onClick={() => setSposta(false)}>
          <div className="card sheet-card" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow">Sposta in portafoglio</p>
            <div className="includi-list">
              {portfolios.map((pf) => (
                <button key={pf.id} type="button" className="includi-row as-btn" onClick={() => spostaIn(pf.id)}>
                  <span className="dot-lg" style={{ background: `var(--${pf.colore})` }} />
                  <span>{pf.nome}</span>
                </button>
              ))}
              <button type="button" className="includi-row as-btn" onClick={() => spostaIn(null)}>
                Senza portafoglio
              </button>
            </div>
            <button type="button" className="btn ghost block" style={{ marginTop: 12 }} onClick={() => { setNewNome(''); setNewColore('cyan'); setPfError(''); setSposta('nuovo'); }}>
              + Nuovo portafoglio
            </button>
            <button type="button" className="btn ghost block" style={{ marginTop: 8 }} onClick={() => setSposta(false)}>Annulla</button>
          </div>
        </SheetBack>
      )}

      {sposta === 'nuovo' && (
        <SheetBack onClick={() => setSposta('choose')}>
          <div className="card sheet-card" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow">Nuovo portafoglio</p>
            {pfError && <div className="banner">{pfError}</div>}
            <div className="field">
              <label>Nome portafoglio</label>
              <input value={newNome} maxLength={40} onChange={(e) => setNewNome(e.target.value)} placeholder="Es. Nonna" autoFocus />
            </div>
            <div className="field">
              <label>Colore</label>
              <div className="color-swatches">
                {PF_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={`swatch${newColore === c.key ? ' selected' : ''}`}
                    style={{ background: c.var }}
                    onClick={() => setNewColore(c.key)}
                    aria-label={c.label}
                    aria-pressed={newColore === c.key}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setSposta('choose')}>Indietro</button>
              <button type="button" className="btn primary" style={{ flex: 1 }} disabled={!newNome.trim()} onClick={creaEIncludi}>Crea</button>
            </div>
          </div>
        </SheetBack>
      )}

      {sposta === 'includi' && pendingPf && (
        <SheetBack>
          <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
            <IncludiBuoni
              bonds={attivi}
              selected={picked}
              onToggle={togglePick}
              onSkip={confermaIncludi}
              onConfirm={confermaIncludi}
              skipLabel="Usa la selezione attuale"
              title={`Includi in «${pendingPf.nome}»`}
            />
          </div>
        </SheetBack>
      )}
    </div>
  );
}
