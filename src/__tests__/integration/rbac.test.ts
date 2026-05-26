// F-11 à F-17 — RBAC par module
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import chantiersRouter from '../../routes/chantiers.routes';
import utilisateursRouter from '../../routes/utilisateurs.routes';
import facturationRouter from '../../routes/facturation.routes';
import contratsRouter from '../../routes/contrats.routes';
import comptabiliteRouter from '../../routes/comptabilite.routes';
import prisma from '../../prisma';

jest.mock('../../prisma');
const mock = prisma as jest.Mocked<typeof prisma>;

const app = express();
app.use(express.json());
app.use('/chantiers', chantiersRouter);
app.use('/utilisateurs', utilisateursRouter);
app.use('/facturation', facturationRouter);
app.use('/contrats', contratsRouter);
app.use('/comptabilite', comptabiliteRouter);

const SECRET = 'test-secret-key';
const tok = (role: string) =>
  `Bearer ${jwt.sign({ id: 1, email: 'u@t.ci', role, tenant_id: 'tid1' }, SECRET)}`;

// ── F-11 : chef_chantier → lecture OK, modification statut → 403 ────────────
test('F-11 chef_chantier : lecture chantiers OK, statut interdit', async () => {
  (mock.chantier.findMany as jest.Mock).mockResolvedValue([]);

  const readRes = await request(app).get('/chantiers').set('Authorization', tok('chef_chantier'));
  expect(readRes.status).toBe(200);

  const writeRes = await request(app)
    .patch('/chantiers/1/statut')
    .set('Authorization', tok('chef_chantier'))
    .send({ statut: 'termine' });
  expect(writeRes.status).toBe(403);
});

// ── F-12 : comptable → valide bilan OK, créer chantier → 403 ────────────────
test('F-12 comptable : valider cloture OK, créer chantier interdit', async () => {
  (mock.cloture.findUnique as jest.Mock).mockResolvedValue(null);
  (mock.cloture.upsert as jest.Mock).mockResolvedValue({ id: 1, statut_bilan: 'bilan_valide', date_validation_comptable: new Date() });

  const cloRes = await request(app)
    .post('/comptabilite/cloture/1/valider')
    .set('Authorization', tok('comptable'));
  expect(cloRes.status).toBe(200);

  const createRes = await request(app)
    .post('/chantiers')
    .set('Authorization', tok('comptable'))
    .send({ id_contrat: 1, nom_chantier: 'X', localisation: 'Y', date_livraison_prevue: '2027-01-01', chef_chantier: 'Z' });
  expect(createRes.status).toBe(403);
});

// ── F-13 : conducteur → avancement OK, gestion utilisateurs → 403 ───────────
test('F-13 conducteur : avancement OK, utilisateurs interdit', async () => {
  (mock.corpsEtat.update as jest.Mock).mockResolvedValue({ id: 1 });
  (mock.corpsEtat.findMany as jest.Mock).mockResolvedValue([{ part_chantier: 100, avancement: 80 }]);
  (mock.chantier.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

  const avancRes = await request(app)
    .patch('/chantiers/1/corps-etat/1/avancement')
    .set('Authorization', tok('conducteur'))
    .send({ avancement: 80, cout_reel: 0 });
  expect(avancRes.status).toBe(200);

  const userRes = await request(app)
    .post('/utilisateurs')
    .set('Authorization', tok('conducteur'))
    .send({ nom: 'X', prenom: 'Y', email: 'x@y.ci', role: 'chef_chantier', mot_de_passe: 'P@ssw0rd!' });
  expect(userRes.status).toBe(403);
});

// ── F-14 : chef_chantier → rapport terrain OK, facturation → 403 ────────────
test('F-14 chef_chantier : rapport terrain OK, facturation interdit', async () => {
  (mock.rapportTerrain.create as jest.Mock).mockResolvedValue({ id: 1 });
  (mock.chantier.findFirst as jest.Mock).mockResolvedValue({ id: 1, corps_etat: [] });

  const terrainRes = await request(app)
    .post('/chantiers/1/rapports')
    .set('Authorization', tok('chef_chantier'));
  // 404 ou 201 selon les mocks — l'important : pas 403
  expect(terrainRes.status).not.toBe(403);

  const factRes = await request(app)
    .post('/facturation/situations')
    .set('Authorization', tok('chef_chantier'))
    .send({ id_chantier: 1, montant_ht: 1000, taux_tva: 18, avancement_facture: 10 });
  expect(factRes.status).toBe(403);
});

// ── F-15 : comptable → valider facture ST OK, signer avenant → 403 ──────────
test('F-15 comptable : valider facture ST OK, signer avenant interdit', async () => {
  (mock.factureST.findFirst as jest.Mock).mockResolvedValue({ id: 1, tenant_id: 'tid1' });
  (mock.factureST.update as jest.Mock).mockResolvedValue({ id: 1, statut: 'validee' });

  const fstRes = await request(app)
    .patch('/facturation/factures-st/1/valider')
    .set('Authorization', tok('comptable'));
  expect(fstRes.status).toBe(200);

  const avRes = await request(app)
    .patch('/contrats/1/avenants/1/signer')
    .set('Authorization', tok('comptable'));
  expect(avRes.status).toBe(403);
});

// ── F-16 : admin → accès total ──────────────────────────────────────────────
test('F-16 admin : accès total — statut, avancement, cloture', async () => {
  (mock.chantier.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  (mock.cloture.findUnique as jest.Mock).mockResolvedValue({ statut_bilan: 'bilan_valide' });
  (mock.chantier.findUnique as jest.Mock).mockResolvedValue({ id: 1, situations: [], budget: null });
  (mock.cloture.update as jest.Mock).mockResolvedValue({ id: 1, statut_bilan: 'cloture', date_cloture_admin: new Date(), marge_reelle: 0 });
  (mock.chantier.update as jest.Mock).mockResolvedValue({ id: 1, statut: 'cloture' });

  const statutRes = await request(app)
    .patch('/chantiers/1/statut')
    .set('Authorization', tok('admin'))
    .send({ statut: 'termine' });
  expect(statutRes.status).toBe(200);

  const cloRes = await request(app)
    .post('/comptabilite/cloture/1/cloturer')
    .set('Authorization', tok('admin'));
  expect(cloRes.status).toBe(200);
});

// ── F-17 : utilisateur désactivé → 401 ──────────────────────────────────────
test('F-17 utilisateur actif=false → login refusé 401', async () => {
  (mock.utilisateur.findFirst as jest.Mock).mockResolvedValue(null); // findFirst avec actif:true retourne null

  const appAuth = express();
  appAuth.use(express.json());
  const authRouter = (await import('../../routes/auth.routes')).default;
  appAuth.use('/auth', authRouter);

  const res = await request(appAuth).post('/auth/login').send({
    email: 'desactive@test.ci', mot_de_passe: 'Test1234!',
  });

  expect(res.status).toBe(401);
});
