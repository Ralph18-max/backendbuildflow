// F-01 à F-06 — Auth & Session
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import authRouter from '../../routes/auth.routes';
import chantiersRouter from '../../routes/chantiers.routes';
import prisma from '../../prisma';

jest.mock('../../prisma');
const mock = prisma as jest.Mocked<typeof prisma>;

const app = express();
app.use(express.json());
app.use('/auth', authRouter);
app.use('/chantiers', chantiersRouter);

const SECRET = 'test-secret-key';

// ── F-01 : inscription → token retourné + rôle admin ────────────────────────
test('F-01 inscription → entreprise + admin créés + token valide', async () => {
  (mock.utilisateur.findFirst as jest.Mock).mockResolvedValue(null);
  (mock.entreprise.create as jest.Mock).mockResolvedValue({ tenant_id: 'new-tid' });
  (mock.utilisateur.create as jest.Mock).mockResolvedValue({
    id: 1, nom: 'KOUAME', prenom: 'Jean', email: 'test@co.ci',
    role: 'admin', tenant_id: 'new-tid', mot_de_passe_hash: 'h',
  });

  const res = await request(app).post('/auth/register').send({
    prenom: 'Jean', nom: 'Kouame', nom_societe: 'BTP Test',
    email: 'test@co.ci', mot_de_passe: 'Secure123!',
  });

  expect(res.status).toBe(201);
  expect(res.body.token).toBeDefined();
  expect(res.body.utilisateur.role).toBe('admin');

  const payload: any = jwt.verify(res.body.token, SECRET);
  expect(payload.role).toBe('admin');
  expect(payload.tenant_id).toBe('new-tid');
});

// ── F-02 : connexion → token valide + rôle correct ──────────────────────────
test('F-02 connexion → token valide avec role et tenant_id', async () => {
  const hash = await bcrypt.hash('Buildflow2026!', 10);
  (mock.utilisateur.findFirst as jest.Mock).mockResolvedValue({
    id: 1, nom: 'BAMBA', prenom: 'Moussa', email: 'conducteur@btp.ci',
    role: 'conducteur', tenant_id: 'tid1', actif: true,
    mot_de_passe_hash: hash,
    entreprise: { nom_entreprise: 'BTP SA' },
  });

  const res = await request(app).post('/auth/login').send({
    email: 'conducteur@btp.ci', mot_de_passe: 'Buildflow2026!',
  });

  expect(res.status).toBe(200);
  const payload: any = jwt.verify(res.body.token, SECRET);
  expect(payload.role).toBe('conducteur');
  expect(payload.tenant_id).toBe('tid1');
});

// ── F-03 : mauvais mot de passe → 401 + message ─────────────────────────────
test('F-03 mauvais mot de passe → 401 message explicite', async () => {
  const hash = await bcrypt.hash('CorrectPass!', 10);
  (mock.utilisateur.findFirst as jest.Mock).mockResolvedValue({
    id: 1, email: 'u@t.ci', mot_de_passe_hash: hash, actif: true,
  });

  const res = await request(app).post('/auth/login').send({
    email: 'u@t.ci', mot_de_passe: 'WrongPass!',
  });

  expect(res.status).toBe(401);
  expect(res.body.message).toBeDefined();
});

// ── F-04 : appel sans token → 401 sur route protégée ────────────────────────
test('F-04 appel sans token → 401 sur route protégée', async () => {
  const res = await request(app).get('/chantiers');
  expect(res.status).toBe(401);
});

// ── F-05 : token expiré → 401 ───────────────────────────────────────────────
test('F-05 token expiré → 401', async () => {
  const expired = jwt.sign(
    { id: 1, email: 'a@b.ci', role: 'admin', tenant_id: 'tid' },
    SECRET,
    { expiresIn: -1 }
  );

  const res = await request(app)
    .get('/chantiers')
    .set('Authorization', `Bearer ${expired}`);

  expect(res.status).toBe(401);
});

// ── F-06 : email déjà utilisé → 409 ─────────────────────────────────────────
test('F-06 email déjà existant lors du register → 409', async () => {
  (mock.utilisateur.findFirst as jest.Mock).mockResolvedValue({ id: 1 });

  const res = await request(app).post('/auth/register').send({
    prenom: 'Jean', nom: 'Dupont', nom_societe: 'Dupont SA',
    email: 'existing@test.ci', mot_de_passe: 'Secure123!',
  });

  expect(res.status).toBe(409);
});
