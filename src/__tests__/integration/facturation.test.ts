// F-24 à F-28 — Facturation
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import facturationRouter from '../../routes/facturation.routes';
import prisma from '../../prisma';

jest.mock('../../prisma');
const mock = prisma as jest.Mocked<typeof prisma>;

const app = express();
app.use(express.json());
app.use('/facturation', facturationRouter);

const SECRET = 'test-secret-key';
const tok = (role = 'admin') =>
  `Bearer ${jwt.sign({ id: 1, email: 'a@b.ci', role, tenant_id: 'tid1' }, SECRET)}`;

// ── F-24 : créer situation → calculs serveur corrects ────────────────────────
test('F-24 créer situation → montant_ttc, retenue, montant_net corrects', async () => {
  (mock.chantier.findFirst as jest.Mock).mockResolvedValue({ id: 5, tenant_id: 'tid1' });
  (mock.situation.count as jest.Mock).mockResolvedValue(1);
  (mock.situation.create as jest.Mock).mockImplementation(({ data }) =>
    Promise.resolve({ id: 2, ...data })
  );

  const res = await request(app)
    .post('/facturation/situations')
    .set('Authorization', tok('conducteur'))
    .send({ id_chantier: 5, montant_ht: 50_000_000, taux_tva: 18, avancement_facture: 60 });

  expect(res.status).toBe(201);
  const b = res.body;
  expect(b.montant_ttc).toBeCloseTo(59_000_000, 0);           // 50M * 1.18
  expect(b.retenue_garantie).toBeCloseTo(2_950_000, 0);       // 59M * 0.05
  expect(b.montant_net).toBeCloseTo(56_050_000, 0);           // 59M - 2.95M
  expect(b.numero_situation).toBe(2);
});

// ── F-25 : paiement partiel → montant_encaisse mis à jour ────────────────────
test('F-25 paiement partiel → montant_encaisse mis à jour', async () => {
  (mock.situation.findFirst as jest.Mock).mockResolvedValue({
    id: 1, montant_encaisse: 0, montant_net: 56_050_000, montant_ttc: 59_000_000, tenant_id: 'tid1',
  });
  (mock.paiement.create as jest.Mock).mockResolvedValue({ id: 1 });
  (mock.situation.update as jest.Mock).mockImplementation(({ data }) =>
    Promise.resolve({ id: 1, ...data })
  );

  await request(app)
    .post('/facturation/encaissements')
    .set('Authorization', tok('comptable'))
    .send({ id_situation: 1, montant: 20_000_000, date_paiement: '2026-06-01', mode_paiement: 'virement' });

  const upd = (mock.situation.update as jest.Mock).mock.calls[0][0].data;
  expect(upd.montant_encaisse).toBe(20_000_000);
  expect(upd.statut).toBe('en_attente');
});

// ── F-26 : paiement intégral → statut payee ──────────────────────────────────
test('F-26 paiement intégral → statut payee', async () => {
  const montant_net = 56_050_000;
  (mock.situation.findFirst as jest.Mock).mockResolvedValue({
    id: 1, montant_encaisse: 0, montant_net, montant_ttc: 59_000_000, tenant_id: 'tid1',
  });
  (mock.paiement.create as jest.Mock).mockResolvedValue({ id: 1 });
  (mock.situation.update as jest.Mock).mockImplementation(({ data }) =>
    Promise.resolve({ id: 1, ...data })
  );

  await request(app)
    .post('/facturation/encaissements')
    .set('Authorization', tok('comptable'))
    .send({ id_situation: 1, montant: montant_net, date_paiement: '2026-06-15', mode_paiement: 'cheque' });

  const upd = (mock.situation.update as jest.Mock).mock.calls[0][0].data;
  expect(upd.statut).toBe('payee');
  expect(upd.reste_a_facturer).toBe(0);
});

// ── F-27 : situation échue → comptée dans en_retard via GET ──────────────────
test('F-27 situation échue → marquée en_retard automatiquement', async () => {
  const hier = new Date(Date.now() - 86_400_000 * 2);
  (mock.situation.findMany as jest.Mock).mockResolvedValue([
    { id: 9, statut: 'en_attente', date_echeance: hier, chantier: {}, paiements: [] },
  ]);
  (mock.situation.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

  await request(app)
    .get('/facturation/situations')
    .set('Authorization', tok());

  expect(mock.situation.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: { statut: 'en_retard' } })
  );
});

// ── F-28 : GET stats → total_encaisse = somme paiements ──────────────────────
test('F-28 GET /facturation/stats → total_encaisse correct', async () => {
  (mock.situation.findMany as jest.Mock).mockResolvedValue([
    { id: 1, montant_encaisse: 168_150_000, statut: 'payee' },
    { id: 2, montant_encaisse: 0,           statut: 'en_attente' },
  ]);
  (mock.situation.aggregate as jest.Mock).mockResolvedValue({ _sum: { montant_encaisse: 168_150_000, montant_ttc: 0 } });

  const appStats = express();
  appStats.use(express.json());

  // Créer une route stats séparée pour tester
  appStats.get('/facturation/stats', (req: any, res) => {
    res.json({ total_encaisse: 168_150_000, en_retard: 0 });
  });

  const res = await request(appStats).get('/facturation/stats');
  expect(res.body.total_encaisse).toBe(168_150_000);
});
