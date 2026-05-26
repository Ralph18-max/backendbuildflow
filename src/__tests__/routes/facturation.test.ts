// U-19 à U-23 — routes /facturation
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import facturationRouter from '../../routes/facturation.routes';
import prisma from '../../prisma';

jest.mock('../../prisma');
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const app = express();
app.use(express.json());
app.use('/facturation', facturationRouter);

const SECRET = 'test-secret-key';
const token = (role = 'admin') =>
  `Bearer ${jwt.sign({ id: 1, email: 'a@b.ci', role, tenant_id: 'tid1' }, SECRET)}`;

// ── U-19 : montant_ttc = ht * 1.18 ──────────────────────────────────────────
test('U-19 créer situation → montant_ttc = ht * 1.18', async () => {
  (mockPrisma.situation.count as jest.Mock).mockResolvedValue(0);
  (mockPrisma.situation.create as jest.Mock).mockImplementation(({ data }) =>
    Promise.resolve({ id: 1, ...data })
  );

  const res = await request(app)
    .post('/facturation/situations')
    .set('Authorization', token('conducteur'))
    .send({ id_chantier: 1, montant_ht: 10_000_000, taux_tva: 18, avancement_facture: 30 });

  expect(res.status).toBe(201);
  expect(res.body.montant_ttc).toBeCloseTo(11_800_000, 0);
});

// ── U-20 : retenue_garantie = ttc * 0.05 ────────────────────────────────────
test('U-20 créer situation → retenue_garantie = ttc * 0.05', async () => {
  (mockPrisma.situation.count as jest.Mock).mockResolvedValue(0);
  (mockPrisma.situation.create as jest.Mock).mockImplementation(({ data }) =>
    Promise.resolve({ id: 1, ...data })
  );

  const res = await request(app)
    .post('/facturation/situations')
    .set('Authorization', token('conducteur'))
    .send({ id_chantier: 1, montant_ht: 10_000_000, taux_tva: 18, avancement_facture: 30 });

  expect(res.body.retenue_garantie).toBeCloseTo(590_000, 0); // 11_800_000 * 0.05
});

// ── U-21 : paiement complet → statut payee ───────────────────────────────────
test('U-21 paiement complet → situation statut payee', async () => {
  const montant_net = 11_210_000; // 11.8M - 5%
  (mockPrisma.situation.findFirst as jest.Mock).mockResolvedValue({
    id: 1, montant_encaisse: 0, montant_net, montant_ttc: 11_800_000,
    tenant_id: 'tid1',
  });
  (mockPrisma.paiement.create as jest.Mock).mockResolvedValue({ id: 1 });
  (mockPrisma.situation.update as jest.Mock).mockImplementation(({ data }) =>
    Promise.resolve({ id: 1, ...data })
  );

  const res = await request(app)
    .post('/facturation/encaissements')
    .set('Authorization', token('comptable'))
    .send({ id_situation: 1, montant: montant_net, date_paiement: '2026-05-26', mode_paiement: 'virement' });

  expect(res.status).toBe(201);
  const updateCall = (mockPrisma.situation.update as jest.Mock).mock.calls[0][0];
  expect(updateCall.data.statut).toBe('payee');
});

// ── U-22 : paiement partiel → statut en_attente ──────────────────────────────
test('U-22 paiement partiel → situation statut en_attente', async () => {
  const montant_net = 11_210_000;
  (mockPrisma.situation.findFirst as jest.Mock).mockResolvedValue({
    id: 1, montant_encaisse: 0, montant_net, montant_ttc: 11_800_000, tenant_id: 'tid1',
  });
  (mockPrisma.paiement.create as jest.Mock).mockResolvedValue({ id: 1 });
  (mockPrisma.situation.update as jest.Mock).mockImplementation(({ data }) =>
    Promise.resolve({ id: 1, ...data })
  );

  await request(app)
    .post('/facturation/encaissements')
    .set('Authorization', token('comptable'))
    .send({ id_situation: 1, montant: 5_000_000, date_paiement: '2026-05-26', mode_paiement: 'virement' });

  const updateCall = (mockPrisma.situation.update as jest.Mock).mock.calls[0][0];
  expect(updateCall.data.statut).toBe('en_attente');
});

// ── U-23 : situation échue → marquée en_retard via GET ───────────────────────
test('U-23 GET situations → situation échue marquée en_retard', async () => {
  const datePassee = new Date(Date.now() - 86_400_000 * 5); // -5 jours
  (mockPrisma.situation.findMany as jest.Mock).mockResolvedValue([
    { id: 1, statut: 'en_attente', date_echeance: datePassee, chantier: {}, paiements: [] },
  ]);
  (mockPrisma.situation.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

  const res = await request(app)
    .get('/facturation/situations')
    .set('Authorization', token());

  expect(mockPrisma.situation.updateMany).toHaveBeenCalled();
  const retardCall = (mockPrisma.situation.updateMany as jest.Mock).mock.calls[0][0];
  expect(retardCall.data.statut).toBe('en_retard');
  expect(res.status).toBe(200);
});
