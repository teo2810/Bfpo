import { useEffect, useRef } from 'react';

export default function Disclaimer({ onAccept }) {
  const btnRef = useRef(null);
  useEffect(() => {
    btnRef.current?.focus();
  }, []);
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
      <div className="sheet">
        <div className="sheet-handle" aria-hidden="true" />
        <p className="eyebrow">Prima di iniziare</p>
        <h1 id="disclaimer-title" className="title" style={{ fontSize: 24 }}>Cassetto non è Poste Italiane né un consulente</h1>
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
        <button ref={btnRef} className="btn primary" onClick={onAccept}>Ho capito, continua</button>
      </div>
    </div>
  );
}
