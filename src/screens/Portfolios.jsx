import { useState } from 'react';
import { quoteBond, formatEUR } from '../lib/quote.js';
import { savePortfolio, deletePortfolio } from '../lib/db.js';
import { TrashIcon } from '../components/icons.jsx';

const COLORS = [
  { key: 'cyan', label: 'Azzurro', var: 'var(--cyan)' },
  { key: 'mint', label: 'Verde', var: 'var(--mint)' },
  { key: 'amber', label: 'Ambra', var: 'var(--amber)' },
  { key: 'coral', label: 'Corallo', var: 'var(--coral)' },
  { key: 'violet', label: 'Viola', var: 'var(--violet)' },
];

export default function Portfolios({ bonds, portfolios, onReload, onOpenPortfolio }) {
  const [creating, setCreating] = useState(false);
  const [nome, setNome] = useState('');
  const [colore, setColore] = useState('cyan');
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const totaleFor = (id) =>
    bonds.filter((b) => b.portafoglioId === id).reduce((s, b) => s + quoteBond(b, new Date()).valore, 0);

  const ids = new Set(portfolios.map((p) => p.id));
  const senzaPortafoglio = bonds.filter((b) => !b.portafoglioId || !ids.has(b.portafoglioId));

  const handleCreate = async () => {
    if (!nome.trim()) return;
    if (portfolios.some((p) => p.nome.trim().toLowerCase() === nome.trim().toLowerCase())) {
      setError(`Esiste già un portafoglio chiamato «${nome.trim()}».`);
      return;
    }
    setError('');
    await savePortfolio({ nome: nome.trim(), colore });
    setNome('');
    setColore('cyan');
    setCreating(false);
    onReload();
  };

  const handleDelete = async (p) => {
    const count = bonds.filter((b) => b.portafoglioId === p.id).length;
    if (count > 0) {
      setPendingDelete(null);
      setError(`«${p.nome}» contiene ${count === 1 ? '1 buono' : `${count} buoni`}: spostali prima di eliminare il portafoglio.`);
      return;
    }
    setError('');
    setPendingDelete(p);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deletePortfolio(pendingDelete.id);
    setPendingDelete(null);
    setError('');
    onReload();
  };

  return (
    <div className="screen screen-enter">
      <p className="eyebrow">Cassetto</p>
      <h1 className="title">Portafogli</h1>
      <p className="subtitle">Raggruppa i buoni per persona o obiettivo.</p>

      {error && <div className="banner">{error}</div>}
      {pendingDelete && (
        <div className="card" style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 12px', fontSize: 14 }}>
            Eliminare il portafoglio «{pendingDelete.nome}»? I buoni non vengono toccati: questo portafoglio è vuoto.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setPendingDelete(null)}>Annulla</button>
            <button className="btn danger-ghost" style={{ flex: 1 }} onClick={confirmDelete}>Elimina</button>
          </div>
        </div>
      )}

      <div className="list grid-list">
        {portfolios.map((p) => {
          const count = bonds.filter((b) => b.portafoglioId === p.id).length;
          return (
            <div key={p.id} className="row row-split" style={{ ['--row-accent']: `var(--${p.colore})` }}>
              <button className="row-link" onClick={() => onOpenPortfolio(p.id)} aria-label={`Apri ${p.nome}`}>
                <div className="left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="dot-lg" style={{ background: `var(--${p.colore})` }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="name">{p.nome}</div>
                    <div className="meta">{count === 1 ? '1 buono' : `${count} buoni`}</div>
                  </div>
                </div>
                <div className="amount">{formatEUR(totaleFor(p.id))}</div>
              </button>
              <button className="icon-btn sm" onClick={() => handleDelete(p)} aria-label={`Elimina ${p.nome}`}>
                <TrashIcon />
              </button>
            </div>
          );
        })}

        {senzaPortafoglio.length > 0 && (
          <button className="row" style={{ ['--row-accent']: 'var(--text-2)' }} onClick={() => onOpenPortfolio(null)}>
            <div className="left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="dot-lg" style={{ background: 'var(--text-2)' }} />
              <div>
                <div className="name">Senza portafoglio</div>
                <div className="meta">{senzaPortafoglio.length === 1 ? '1 buono' : `${senzaPortafoglio.length} buoni`}</div>
              </div>
            </div>
            <div className="right">
              <div className="amount">
                {formatEUR(senzaPortafoglio.reduce((s, b) => s + quoteBond(b, new Date()).valore, 0))}
              </div>
            </div>
          </button>
        )}
        {portfolios.length === 0 && senzaPortafoglio.length === 0 && (
          <div className="empty"><div className="icon">👛</div><p>Nessun portafoglio. Creane uno per raggruppare i buoni.</p></div>
        )}
      </div>

      {creating ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="field">
            <label>Nome portafoglio</label>
            <input value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} placeholder="Es. Nonna" autoFocus />
          </div>
          <div className="field">
            <label>Colore</label>
            <div className="color-swatches">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  className={`swatch${colore === c.key ? ' selected' : ''}`}
                  style={{ background: c.var }}
                  onClick={() => setColore(c.key)}
                  aria-label={c.label}
                  aria-pressed={colore === c.key}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => { setCreating(false); setError(''); }}>Annulla</button>
            <button className="btn primary" style={{ flex: 1 }} disabled={!nome.trim()} onClick={handleCreate}>Crea</button>
          </div>
        </div>
      ) : (
        <button className="btn ghost block" style={{ marginTop: 16 }} onClick={() => setCreating(true)}>
          + Nuovo portafoglio
        </button>
      )}
    </div>
  );
}
