import { useState } from 'react';
import { quoteBond, formatEUR } from '../lib/quote.js';
import { savePortfolio, deletePortfolio } from '../lib/db.js';

const COLORS = [
  { key: 'cyan', var: 'var(--cyan)' },
  { key: 'mint', var: 'var(--mint)' },
  { key: 'amber', var: 'var(--amber)' },
  { key: 'coral', var: 'var(--coral)' },
];

export default function Portfolios({ bonds, portfolios, onReload, onOpenPortfolio }) {
  const [creating, setCreating] = useState(false);
  const [nome, setNome] = useState('');
  const [colore, setColore] = useState('cyan');
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const totaleFor = (id) =>
    bonds.filter((b) => b.portafoglioId === id).reduce((s, b) => s + quoteBond(b, new Date()).valore, 0);

  const senzaPortafoglio = bonds.filter((b) => !b.portafoglioId);

  const handleCreate = async () => {
    if (!nome.trim()) return;
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
      setError(`"${p.nome}" contiene ${count} buoni: spostali prima di eliminare il portafoglio.`);
      return;
    }
    setError('');
    setPendingDelete(p);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deletePortfolio(pendingDelete.id);
    setPendingDelete(null);
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

      <div className="list">
        {portfolios.map((p) => (
          <div key={p.id} className="row" onClick={() => onOpenPortfolio(p.id)} style={{ cursor: 'pointer' }}>
            <div className="left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: `var(--${p.colore})`,
                  flexShrink: 0,
                }}
              />
              <div>
                <div className="name">{p.nome}</div>
                <div className="meta">{bonds.filter((b) => b.portafoglioId === p.id).length} buoni</div>
              </div>
            </div>
            <div className="right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="amount">{formatEUR(totaleFor(p.id))}</div>
              <button
                className="icon-btn"
                style={{ width: 32, height: 32, fontSize: 14 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(p);
                }}
                aria-label={`Elimina ${p.nome}`}
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {senzaPortafoglio.length > 0 && (
          <div className="row" style={{ opacity: 0.75 }}>
            <div className="left">
              <div className="name">Senza portafoglio</div>
              <div className="meta">{senzaPortafoglio.length} buoni</div>
            </div>
            <div className="right">
              <div className="amount">
                {formatEUR(senzaPortafoglio.reduce((s, b) => s + quoteBond(b, new Date()).valore, 0))}
              </div>
            </div>
          </div>
        )}
      </div>

      {creating ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="field">
            <label>Nome portafoglio</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Nonna Anna" autoFocus />
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
                  aria-label={c.key}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setCreating(false)}>Annulla</button>
            <button className="btn primary" style={{ flex: 1 }} onClick={handleCreate}>Crea</button>
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
