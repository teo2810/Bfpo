export default function Disclaimer({ onAccept }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        background: 'rgba(0,0,0,0.55)',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          maxWidth: 560,
          margin: '0 auto',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        }}
      >
        <p className="eyebrow">Prima di iniziare</p>
        <h1 className="title" style={{ fontSize: 22 }}>Cassetto non è Poste Italiane né un consulente</h1>
        <p className="subtitle" style={{ marginBottom: 14 }}>
          Cassetto ti aiuta a tenere traccia dei tuoi buoni fruttiferi postali cartacei. Ogni valore
          mostrato in app è una <strong>stima</strong>: la fonte di verità resta sempre il titolo
          cartaceo e Poste Italiane.
        </p>
        <p className="disclaimer" style={{ marginBottom: 18 }}>
          Per i buoni cartacei il diritto al rimborso si prescrive in genere dopo 10 anni dalla
          scadenza; i titoli dematerializzati non si prescrivono. Verifica sempre condizioni
          aggiornate in un ufficio postale o su poste.it.
        </p>
        <button className="btn primary" onClick={onAccept}>Ho capito, continua</button>
      </div>
    </div>
  );
}
