import { savePortfolio, saveBond, setMeta } from './db.js';
import { addYears } from './quote.js';

export async function seedDemoData() {
  const famiglia = await savePortfolio({ nome: 'Famiglia', colore: 'mint', isDemo: true });

  const oggi = new Date();
  const demo = [
    {
      tipo: 'bfp',
      serie: 'Ordinario',
      numero: 'AB0000001',
      nominale: 1000,
      dataEmissione: addYears(oggi, -15).toISOString(),
      dataScadenza: addYears(oggi, 5).toISOString(),
      valoreScadenza: 1620,
      intestatari: ['Mario Rossi'],
      portafoglioId: famiglia.id,
      note: 'Esempio dimostrativo — non è un titolo reale.',
      isDemo: true,
    },
    {
      tipo: 'bfp',
      serie: '3x4',
      numero: 'CD0000002',
      nominale: 500,
      dataEmissione: addYears(oggi, -3.5).toISOString(),
      dataScadenza: addYears(oggi, 0.5).toISOString(),
      valoreScadenza: 560,
      intestatari: ['Mario Rossi', 'Anna Rossi'],
      portafoglioId: famiglia.id,
      note: 'Esempio dimostrativo — non è un titolo reale.',
      isDemo: true,
    },
    {
      tipo: 'bfp',
      serie: 'Dedicato ai Minori',
      numero: 'EF0000003',
      nominale: 2000,
      dataEmissione: addYears(oggi, -19.8).toISOString(),
      dataScadenza: addYears(oggi, -0.1).toISOString(),
      dataPrescrizione: addYears(oggi, 9.9).toISOString(),
      valoreScadenza: 2450,
      intestatari: ['Luca Rossi'],
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
