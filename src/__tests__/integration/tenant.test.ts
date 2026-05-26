// F-07 à F-10 — Isolation multi-tenant
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import chantiersRouter from '../../routes/chantiers.routes';
import clientsRouter from '../../routes/clients.routes';
import prisma from '../../prisma';

jest.mock('../../prisma');
const mock = prisma as jest.Mocked<typeof prisma>;

const app = express();
app.use(express.json());
app.use('/chantiers', chantiersRouter);
app.use('/clients', clientsRouter);

const SECRET = 'test-secret-key';
const tokenA = `Bearer ${jwt.sign({ id: 1, email: 'a@a.ci', role: 'admin', tenant_id: 'TENANT_A' }, SECRET)}`;
const tokenB = `Bearer ${jwt.sign({ id: 2, email: 'b@b.ci', role: 'admin', tenant_id: 'TENANT_B' }, SECRET)}`;

// ── F-07 : user A ne lit que ses chantiers (filtré par tenant_id) ────────────
test('F-07 chantiers filtrés par tenant_id du token', async () => {
  (mock.chantier.findMany as jest.Mock).mockResolvedValue([]);

  await request(app).get('/chantiers').set('Authorization', tokenA);

  const call = (mock.chantier.findMany as jest.Mock).mock.calls[0][0];
  expect(call.where.tenant_id).toBe('TENANT_A');
});

// ── F-08 : client créé avec le tenant_id du token, pas un autre ─────────────
test('F-08 client créé avec tenant_id du token signé', async () => {
  (mock.client.create as jest.Mock).mockResolvedValue({ id: 99, tenant_id: 'TENANT_B' });

  await request(app)
    .post('/clients')
    .set('Authorization', tokenB)
    .send({ raison_sociale: 'Client B', type_client: 'societe', telephone: '0700', email: 'b@b.ci', adresse: 'Abidjan' });

  const createCall = (mock.client.create as jest.Mock).mock.calls[0][0];
  expect(createCall.data.tenant_id).toBe('TENANT_B');
  expect(createCall.data.tenant_id).not.toBe('TENANT_A');
});

// ── F-09 : chantier d'un autre tenant retourne 404 ──────────────────────────
test('F-09 chantier tenant B introuvable avec token tenant A → 404', async () => {
  (mock.chantier.findFirst as jest.Mock).mockResolvedValue(null);

  const res = await request(app)
    .get('/chantiers/999')
    .set('Authorization', tokenA);

  expect(res.status).toBe(404);
  const call = (mock.chantier.findFirst as jest.Mock).mock.calls[0][0];
  expect(call.where.tenant_id).toBe('TENANT_A');
});

// ── F-10 : deux tenants même email → contrainte [email, tenant_id] ───────────
test('F-10 même email dans deux tenants différents → pas de conflit', async () => {
  // La contrainte unique est (email, tenant_id) — deux tenants peuvent avoir le même email
  (mock.utilisateur.findFirst as jest.Mock).mockResolvedValue(null); // email libre dans ce tenant
  (mock.entreprise.create as jest.Mock).mockResolvedValue({ tenant_id: 'TENANT_C' });
  (mock.utilisateur.create as jest.Mock).mockResolvedValue({
    id: 50, email: 'shared@email.ci', role: 'admin', tenant_id: 'TENANT_C',
    nom: 'C', prenom: 'User', mot_de_passe_hash: 'h',
  });

  const appAuth = express();
  appAuth.use(express.json());
  const authRouter = (await import('../../routes/auth.routes')).default;
  appAuth.use('/auth', authRouter);

  const res = await request(appAuth).post('/auth/register').send({
    prenom: 'User', nom: 'C', nom_societe: 'Société C',
    email: 'shared@email.ci', mot_de_passe: 'Secure123!',
  });

  expect(res.status).toBe(201);
  expect(res.body.utilisateur.email).toBe('shared@email.ci');
});
