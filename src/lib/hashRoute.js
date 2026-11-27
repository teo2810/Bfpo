/** Routing a hash per GitHub Pages (/Bfpo/): il path dopo # è la schermata. */
export const NO_PORTFOLIO = '__none';

export function parseHash(hash = typeof window !== 'undefined' ? window.location.hash : '') {
  const raw = String(hash || '').replace(/^#/, '') || '/';
  const u = new URL(raw, 'https://cassetto.local');
  const parts = u.pathname.split('/').filter(Boolean);
  const sheet = u.searchParams.get('sheet') === '1';
  const crea = u.searchParams.get('crea') === '1';
  const at = u.searchParams.get('at') || '';
  const scan = u.searchParams.get('scan') === '1';
  const pf = u.searchParams.get('pf') || '';
  let tab = 'home';
  const stack = [];
  const p0 = parts[0] || 'buoni';
  if (p0 === 'scadenze') tab = 'scadenze';
  else if (p0 === 'impostazioni') tab = 'impostazioni';
  else if (p0 === 'portafogli') {
    tab = 'portafogli';
    if (parts[1] === 'senza') stack.push({ name: 'portfolioDetail', params: { id: NO_PORTFOLIO } });
    else if (parts[1]) stack.push({ name: 'portfolioDetail', params: { id: parts[1] } });
  } else if (p0 === 'buono') {
    tab = 'home';
    if (parts[1] === 'nuovo') stack.push({ name: 'add', params: { scan, portafoglioId: pf } });
    else if (parts[1] && parts[2] === 'modifica') stack.push({ name: 'edit', params: { id: parts[1] } });
    else if (parts[1]) stack.push({ name: 'bond', params: { id: parts[1] } });
  }
  return { tab, stack, sheet, crea, at };
}

export function toHash(route = {}) {
  const { tab = 'home', stack = [], sheet = false, crea = false, at = '' } = route;
  const top = stack[stack.length - 1];
  let path = '/buoni';
  const q = new URLSearchParams();
  if (top?.name === 'bond') path = `/buono/${encodeURIComponent(top.params.id)}`;
  else if (top?.name === 'edit') path = `/buono/${encodeURIComponent(top.params.id)}/modifica`;
  else if (top?.name === 'add') {
    path = '/buono/nuovo';
    if (top.params?.scan) q.set('scan', '1');
    if (top.params?.portafoglioId) q.set('pf', top.params.portafoglioId);
  } else if (top?.name === 'portfolioDetail') {
    path = top.params?.id === NO_PORTFOLIO ? '/portafogli/senza' : `/portafogli/${encodeURIComponent(top.params.id)}`;
  } else if (tab === 'scadenze') path = '/scadenze';
  else if (tab === 'portafogli') path = '/portafogli';
  else if (tab === 'impostazioni') path = '/impostazioni';
  if (crea && (path === '/portafogli' || path.startsWith('/portafogli/'))) q.set('crea', '1');
  if (at && path.startsWith('/impostazioni')) q.set('at', at);
  if (sheet) q.set('sheet', '1');
  const qs = q.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function isHomeRoute(r) {
  return r.tab === 'home' && !r.stack.length && !r.sheet;
}
