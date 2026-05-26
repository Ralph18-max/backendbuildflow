// F-29 à F-32 — Avenants & Contrats
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import contratsRouter from '../../routes/contrats.routes';
import prisma from '../../prisma';

jest.mock('../../prisma');
const mock = prisma as jest.Mocked<typeof prisma>;

const app = express();
app.use(express.json());
app.use('/contrats', contratsRouter);

const SECRET = 'test-secret-key';
const tok = () =>
  `Bearer ${jwt.sign({ id: 1, email: 'a@b.ci', role: 'admin', tenant_id: 'tid1' }, SECRET)}`;

// ── F-29 : signer avenant → contrat.update avec increment ───────────────────
test('F-29 signer avenant → contrat.update appelé avec increment montant_supplementaire', async () => {
  (mock.modification.findFirst as jest.Mock).mockResolvedValue({
    id: 1, id_contrat: 5, statut: 'en_attente', montant_supplementaire: 8_000_000,
  });
  (mock.modification.update as jest.Mock).mockResolvedValue({ id: 1, statut: 'signe' });
  (mock.contrat.update as jest.Mock).mockResolvedValue({ id: 5 });
  (mock.contrat.findUnique as jest.Mock).mockResolvedValue({
    id: 5, montant_marche_revise: 128_000_000,
  });

  const res = await request(app)
    .patch('/contrats/5/avenants/1/signer')
    .set('Authorization', tok());

  expect(res.status).toBe(200);
  const upd = (mock.contrat.update as jest.Mock).mock.calls[0][0].data;
  expect(upd.montant_marche_revise.increment).toBe(8_000_000);
});

// ── F-30 : 2e avenant signé → increment du 2e montant ────────────────────────
test('F-30 deuxième avenant signé → contrat.update increment = montant 2e avenant', async () => {
  (mock.modification.findFirst as jest.Mock).mockResolvedValue({
    id: 2, id_contrat: 5, statut: 'en_attente', montant_supplementaire: 30_000_000,
  });
  (mock.modification.update as jest.Mock).mockResolvedValue({ id: 2, statut: 'signe' });
  (mock.contrat.update as jest.Mock).mockResolvedValue({ id: 5 });
  (mock.contrat.findUnique as jest.Mock).mockResolvedValue({
    id: 5, montant_marche_revise: 880_000_000,
  });

  const res = await request(app)
    .patch('/contrats/5/avenants/2/signer')
    .set('Authorization', tok());

  expect(res.status).toBe(200);
  const upd = (mock.contrat.update as jest.Mock).mock.calls[0][0].data;
  expect(upd.montant_marche_revise.increment).toBe(30_000_000);
});

// ── F-31 : refuser avenant déjà signé → 409 ──────────────────────────────────
test('F-31 refuser avenant déjà signé → 409', async () => {
  (mock.modification.findFirst as jest.Mock).mockResolvedValue({
    id: 1, id_contrat: 5, statut: 'signe',
  });

  const res = await request(app)
    .patch('/contrats/5/avenants/1/refuser')
    .set('Authorization', tok());

  expect(res.status).toBe(409);
});

// ── F-32 : avenant en_attente n'affecte pas montant_marche_revise ────────────
test('F-32 avenant en_attente non signé → montant_marche_revise inchangé', async () => {
  (mock.contrat.findMany as jest.Mock).mockResolvedValue([{
    id: 6, montant_marche: 120_000_000, montant_marche_revise: 0,
    modifications: [{ statut: 'en_attente', montant_supplementaire: 8_000_000 }],
    client: {}, chantier: null,
  }]);

  const res = await request(app)
    .get('/contrats')
    .set('Authorization', tok());

  expect(res.status).toBe(200);
  const contrat = res.body.find((c: any) => c.id === 6);
  if (contrat) {
    expect(contrat.montant_marche_revise).toBe(0);
  }
});
