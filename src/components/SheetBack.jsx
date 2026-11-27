import { createPortal } from 'react-dom';

/** Foglio modale fuori dallo stacking del .screen, così sta sopra la tab bar. */
export default function SheetBack({ children, className = '', ...props }) {
  const cls = className ? `sheet-back ${className}` : 'sheet-back';
  return createPortal(
    <div className={cls} {...props}>
      {children}
    </div>,
    document.body,
  );
}
