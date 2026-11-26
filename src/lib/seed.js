import { savePortfolio, saveBond, setMeta } from './db.js';
import { addYears, localDayOf } from './quote.js';

export async function seedDemoData() {
  const famiglia = await savePortfolio({ nome: 'Famiglia', colore: 'mint', isDemo: true });

  const oggi = new Date(localDayOf()).toISOString();
  const tra = (giorni) => new Date(localDayOf() + giorni * 86400000).toISOString();
  const demo = [
    {
      tipo: 'bfp',
      serieKey: 'ordinario',
      serie: 'Buono Ordinario',
      numero: 'AB0000001',
      nominale: 1000,
      dataEmissione: addYears(oggi, -15).toISOString(),
      dataScadenza: addYears(oggi, 5).toISOString(),
      valoreScadenza: 1620,
      intestatari: ['Intestatario Demo'],
      portafoglioId: famiglia.id,
      note: 'Esempio dimostrativo — non è un titolo reale.',
      isDemo: true,
    },
    {
      tipo: 'bfp',
      serieKey: '3x4',
      serie: 'BFP 3x4',
      numero: 'CD0000002',
      nominale: 500,
      dataEmissione: addYears(oggi, -3.5).toISOString(),
      dataScadenza: addYears(oggi, 0.5).toISOString(),
      valoreScadenza: 560,
      intestatari: ['Intestatario Demo', 'Cointestatario Demo'],
      portafoglioId: famiglia.id,
      note: 'Esempio dimostrativo — non è un titolo reale.',
      isDemo: true,
    },
    {
      tipo: 'bfp',
      serieKey: 'minori',
      serie: 'Buono Dedicato ai Minori',
      numero: 'EF0000003',
      nominale: 2000,
      dataEmissione: addYears(tra(20), -28).toISOString(),
      dataScadenza: addYears(tra(20), -10).toISOString(),
      dataPrescrizione: tra(20),
      valoreScadenza: 2450,
      intestatari: ['Minore Demo'],
      portafoglioId: famiglia.id,
      note: 'Esempio dimostrativo — quasi in prescrizione: da rimborsare.',
      isDemo: true,
    },
  ];

  for (const bond of demo) {
    if (!bond.dataPrescrizione) {
      bond.dataPrescrizione = addYears(bond.dataScadenza, 10).toISOString();
    }
    await saveBond(bond);
  }
  await setMeta('demoSeeded', true);
}
