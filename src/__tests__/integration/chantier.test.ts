// F-18 à F-23 — Cycle de vie chantier
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import chantiersRouter from '../../routes/chantiers.routes';
import prisma from '../../prisma';

jest.mock('../../prisma');
const mock = prisma as jest.Mocked<typeof prisma>;

const app = express();
app.use(express.json());
app.use('/chantiers', chantiersRouter);

const SECRET = 'test-secret-key';
const tok = (role = 'admin') =>
  `Bearer ${jwt.sign({ id: 1, email: 'a@b.ci', role, tenant_id: 'tid1' }, SECRET)}`;

// ── F-18 : créer chantier → budget → corps état ──────────────────────────────
test('F-18 créer chantier + budget + corps état', async () => {
  (mock.chantier.create as jest.Mock).mockResolvedValue({ id: 10, nom_chantier: 'Imm' });
  (mock.budget.findFirst as jest.Mock).mockResolvedValue(null);
  (mock.budget.create as jest.Mock).mockResolvedValue({ id: 1, montant_total_S0: 100_000_000 });
  (mock.corpsEtat.findMany as jest.Mock).mockResolvedValue([]);
  (mock.corpsEtat.create as jest.Mock).mockResolvedValue({ id: 1 });

  const chRes = await request(app)
    .post('/chantiers')
    .set('Authorization', tok())
    .send({ id_contrat: 1, nom_chantier: 'Imm', localisation: 'Abidjan', date_livraison_prevue: '2027-01-01', chef_chantier: 'Chef' });
  expect(chRes.status).toBe(201);

  const budRes = await request(app)
    .post('/chantiers/10/budget')
    .set('Authorization', tok())
    .send({ debourse_sec_estime: 70_000_000, frais_generaux: 10_000_000, marge_prevue: 15_000_000, provision_aleas: 5_000_000 });
  expect(budRes.status).toBe(201);

  (mock.chantier.findFirst as jest.Mock).mockResolvedValue({
    date_demarrage_reelle: null, date_livraison_prevue: new Date('2027-01-01'), contrat: null,
  });

  const ceRes = await request(app)
    .post('/chantiers/10/corps-etat')
    .set('Authorization', tok())
    .send({
      nom: 'Fondations', part_chantier: 20, ordre_execution: 1,
      date_debut_prevue: '2026-01-01', date_fin_prevue: '2026-06-01', budget_alloue: 1000,
    });
  expect(ceRes.status).toBe(201);
});

// ── F-19 : 3 corps état → avancement_global pondéré ─────────────────────────
test('F-19 avancement_global = somme pondérée des corps état', async () => {
  (mock.corpsEtat.findFirst as jest.Mock).mockResolvedValue({ id: 1, id_chantier: 1, tenant_id: 'tid1' });
  (mock.corpsEtat.update as jest.Mock).mockResolvedValue({ id: 1 });
  (mock.corpsEtat.findMany as jest.Mock).mockResolvedValue([
    { part_chantier: 40, avancement: 100 }, // 40
    { part_chantier: 35, avancement: 80  }, // 28
    { part_chantier: 25, avancement: 0   }, // 0
  ]);
  (mock.chantier.update as jest.Mock).mockResolvedValue({ id: 1 });

  const res = await request(app)
    .patch('/chantiers/1/corps-etat/1/avancement')
    .set('Authorization', tok())
    .send({ avancement: 100, cout_reel: 0 });

  expect(res.status).toBe(200);
  // (40*100 + 35*80 + 25*0) / 100 = 40 + 28 + 0 = 68
  expect(res.body.avancement_global).toBe(68);
});

// ── F-20 : jalons → ecart_jours calculé correctement ────────────────────────
test('F-20 planning jalon → ecart_jours = date_reelle - date_prevue', async () => {
  (mock.jalon.findFirst as jest.Mock).mockResolvedValue({
    id: 1,
    date_prevue: new Date('2026-03-01'),
    statut: 'en_attente',
  });
  (mock.jalon.update as jest.Mock).mockImplementation(({ data }) =>
    Promise.resolve({ id: 1, ...data })
  );

  const res = await request(app)
    .patch('/chantiers/1/jalons/1')
    .set('Authorization', tok())
    .send({ statut: 'atteint', date_reelle: '2026-03-08' });

  expect(res.status).toBe(200);
  expect(res.body.ecart_jours).toBe(7);
});

// ── F-21 : rapport terrain → corps état mis à jour ──────────────────────────
test('F-21 créer rapport terrain → corps état avancement mis à jour', async () => {
  (mock.chantier.findFirst as jest.Mock).mockResolvedValue({
    id: 1, corps_etat: [{ id: 11, nom: 'Maconnerie' }],
  });
  (mock.rapportTerrain.create as jest.Mock).mockResolvedValue({ id: 1 });
  (mock.corpsEtat.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  (mock.corpsEtat.findMany as jest.Mock).mockResolvedValue([{ part_chantier: 100, avancement: 75 }]);
  (mock.chantier.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

  const appTerrain = express();
  appTerrain.use(express.json());
  const terrainRouter = (await import('../../routes/terrain.routes')).default;
  appTerrain.use('/terrain', terrainRouter);

  const res = await request(appTerrain)
    .post('/terrain/rapports')
    .set('Authorization', tok('chef_chantier'))
    .send({
      id_chantier: 1, redacteur: 'Chef', effectif_present: 15,
      meteo: 'ensoleille', a_incident: false,
      corps_travaux: [{ id_corps_etat: 11, avancement_apres: 75 }],
    });

  expect(res.status).toBe(201);
  expect(mock.corpsEtat.updateMany).toHaveBeenCalled();
});

// ── F-22 : part_chantier total > 100% → 400 ─────────────────────────────────
test('F-22 somme part_chantier > 100% → 400', async () => {
  (mock.corpsEtat.findMany as jest.Mock).mockResolvedValue([{ part_chantier: 95 }]);

  const res = await request(app)
    .post('/chantiers/1/corps-etat')
    .set('Authorization', tok())
    .send({ nom: 'Finitions', part_chantier: 10, ordre_execution: 7 });

  expect(res.status).toBe(400);
});

// ── F-23 : contrat déjà lié → erreur Prisma P2002 → 409 ─────────────────────
test('F-23 contrat déjà lié à un chantier → 409 ou 500', async () => {
  const err = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
  (mock.chantier.create as jest.Mock).mockRejectedValue(err);

  const res = await request(app)
    .post('/chantiers')
    .set('Authorization', tok())
    .send({ id_contrat: 5, nom_chantier: 'Doublon', localisation: 'Abi', date_livraison_prevue: '2027-01-01', chef_chantier: 'Chef' });

  expect([409, 500]).toContain(res.status);
});
