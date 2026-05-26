// U-24 à U-27 — routes /contrats
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import contratsRouter from '../../routes/contrats.routes';
import prisma from '../../prisma';

jest.mock('../../prisma');
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const app = express();
app.use(express.json());
app.use('/contrats', contratsRouter);

const SECRET = 'test-secret-key';
const token = (role = 'admin') =>
  `Bearer ${jwt.sign({ id: 1, email: 'a@b.ci', role, tenant_id: 'tid1' }, SECRET)}`;

// ── U-24 : signer avenant → contrat.update avec increment ───────────────────
test('U-24 signer avenant → montant_marche_revise = initial + avenant', async () => {
  (mockPrisma.modification.findFirst as jest.Mock).mockResolvedValue({
    id: 1, id_contrat: 5, statut: 'en_attente', montant_supplementaire: 8_000_000,
  });
  (mockPrisma.modification.update as jest.Mock).mockResolvedValue({ id: 1, statut: 'signe' });
  (mockPrisma.contrat.update as jest.Mock).mockResolvedValue({ id: 5 });
  (mockPrisma.contrat.findUnique as jest.Mock).mockResolvedValue({
    id: 5, montant_marche_revise: 128_000_000,
  });

  const res = await request(app)
    .patch('/contrats/5/avenants/1/signer')
    .set('Authorization', token());

  expect(res.status).toBe(200);
  const updateCall = (mockPrisma.contrat.update as jest.Mock).mock.calls[0][0];
  expect(updateCall.data.montant_marche_revise.increment).toBe(8_000_000);
});

// ── U-25 : refuser avenant déjà signé → 409 ─────────────────────────────────
test('U-25 refuser avenant déjà signé → 409', async () => {
  (mockPrisma.modification.findFirst as jest.Mock).mockResolvedValue({
    id: 1, id_contrat: 5, statut: 'signe',
  });

  const res = await request(app)
    .patch('/contrats/5/avenants/1/refuser')
    .set('Authorization', token());

  expect(res.status).toBe(409);
});

// ── U-26 : comptable ne peut pas créer avenant → 403 ────────────────────────
test('U-26 comptable créer avenant → 403', async () => {
  const res = await request(app)
    .post('/contrats/5/avenants')
    .set('Authorization', token('comptable'))
    .send({ motif: 'Test', montant_supplementaire: 1000, delai_supplementaire: 0 });

  expect(res.status).toBe(403);
});

// ── U-27 : GET stats → total_raf calculé depuis chantiers+situations+contrat ─
test('U-27 GET /contrats/stats → total_raf retourné', async () => {
  (mockPrisma.chantier.findMany as jest.Mock).mockResolvedValue([
    {
      situations: [{ montant_ttc: 0 }],
      contrat: { montant_marche_revise: 0, montant_marche: 28_025_000 },
    },
  ]);

  const res = await request(app)
    .get('/contrats/stats')
    .set('Authorization', token());

  expect(res.status).toBe(200);
  expect(res.body.total_raf).toBe(28_025_000);
});
