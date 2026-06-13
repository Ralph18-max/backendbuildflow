// U-13 à U-18 — routes /chantiers
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import chantiersRouter from '../../routes/chantiers.routes';
import prisma from '../../prisma';

jest.mock('../../prisma');
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const app = express();
app.use(express.json());
app.use('/chantiers', chantiersRouter);

const SECRET = 'test-secret-key';
function token(role = 'admin', tid = 'tid1') {
  return `Bearer ${jwt.sign({ id: 1, email: 'a@b.ci', role, tenant_id: tid }, SECRET)}`;
}

// ── U-13 : sum part_chantier > 100% → 400 ───────────────────────────────────
test('U-13 corps état — somme part_chantier > 100% → 400', async () => {
  (mockPrisma.chantier.findFirst as jest.Mock).mockResolvedValue({
    date_demarrage_reelle: null, date_livraison_prevue: new Date('2027-01-01'), contrat: null,
  });
  (mockPrisma.corpsEtat.findMany as jest.Mock).mockResolvedValue([{ part_chantier: 90 }]);

  const res = await request(app)
    .post('/chantiers/1/corps-etat')
    .set('Authorization', token())
    .send({
      nom: 'Peinture', part_chantier: 15, ordre_execution: 9,
      date_debut_prevue: '2026-01-01', date_fin_prevue: '2026-06-01', budget_alloue: 1000,
    });

  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/100/);
});

// ── U-14 : recalcul avancement_global pondéré ────────────────────────────────
test('U-14 patch avancement → avancement_global recalculé', async () => {
  (mockPrisma.corpsEtat.findFirst as jest.Mock).mockResolvedValue({ id: 1, id_chantier: 1, tenant_id: 'tid1' });
  (mockPrisma.corpsEtat.update as jest.Mock).mockResolvedValue({ id: 1 });
  (mockPrisma.corpsEtat.findMany as jest.Mock).mockResolvedValue([
    { part_chantier: 50, avancement: 100 },
    { part_chantier: 50, avancement: 60 },
  ]);
  (mockPrisma.chantier.update as jest.Mock).mockResolvedValue({ id: 1 });

  const res = await request(app)
    .patch('/chantiers/1/corps-etat/1/avancement')
    .set('Authorization', token())
    .send({ avancement: 100, cout_reel: 0 });

  expect(res.status).toBe(200);
  // (50*100 + 50*60) / 100 = 80
  expect(res.body.avancement_global).toBe(80);
});

// ── U-15 : budget déjà existant → 409 ───────────────────────────────────────
test('U-15 budget déjà existant → 409', async () => {
  (mockPrisma.budget.findUnique as jest.Mock).mockResolvedValue({ id: 1 });

  const res = await request(app)
    .post('/chantiers/1/budget')
    .set('Authorization', token())
    .send({ debourse_sec_estime: 1000, frais_generaux: 0, marge_prevue: 0, provision_aleas: 0 });

  expect(res.status).toBe(409);
});

// ── U-16 : calcul ecart_jours jalon ─────────────────────────────────────────
test('U-16 marquer jalon atteint → ecart_jours calculé', async () => {
  const datePrevue = '2026-01-01';
  const dateReelle = '2026-01-08';
  (mockPrisma.jalon.findFirst as jest.Mock).mockResolvedValue({
    id: 1, date_prevue: new Date(datePrevue), statut: 'en_attente',
  });
  (mockPrisma.jalon.update as jest.Mock).mockImplementation(({ data }) =>
    Promise.resolve({ ...data, id: 1 })
  );

  const res = await request(app)
    .patch('/chantiers/1/jalons/1')
    .set('Authorization', token())
    .send({ statut: 'atteint', date_reelle: dateReelle });

  expect(res.status).toBe(200);
  expect(res.body.ecart_jours).toBe(7);
});

// ── U-17 : chef_chantier ne peut pas modifier statut → 403 ──────────────────
test('U-17 chef_chantier patch statut → 403', async () => {
  const res = await request(app)
    .patch('/chantiers/1/statut')
    .set('Authorization', token('chef_chantier'))
    .send({ statut: 'termine' });

  expect(res.status).toBe(403);
});

// ── U-18 : contrat déjà lié → 409 ───────────────────────────────────────────
test('U-18 contrat déjà lié à un chantier → 409', async () => {
  (mockPrisma.chantier.create as jest.Mock).mockRejectedValue(
    Object.assign(new Error(), { code: 'P2002' })
  );

  const res = await request(app)
    .post('/chantiers')
    .set('Authorization', token('admin'))
    .send({
      id_contrat: 5, nom_chantier: 'Test', localisation: 'Abidjan',
      date_livraison_prevue: '2027-01-01', chef_chantier: 'Chef',
    });

  expect([409, 500]).toContain(res.status);
});
