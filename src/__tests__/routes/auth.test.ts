// U-10 à U-12 — routes /auth
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authRouter from '../../routes/auth.routes';
import prisma from '../../prisma';

jest.mock('../../prisma');
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

// ── U-10 : register → hash bcrypt + token JWT ────────────────────────────────
test('U-10 register → mot de passe haché + token JWT retourné', async () => {
  (mockPrisma.utilisateur.findFirst as jest.Mock).mockResolvedValue(null);
  (mockPrisma.entreprise.create as jest.Mock).mockResolvedValue({ tenant_id: 'tid-new' });
  (mockPrisma.utilisateur.create as jest.Mock).mockResolvedValue({
    id: 99, nom: 'TEST', prenom: 'User', email: 'new@test.ci',
    role: 'admin', tenant_id: 'tid-new', mot_de_passe_hash: 'hash',
  });

  const res = await request(app).post('/auth/register').send({
    prenom: 'User', nom: 'Test', nom_societe: 'Société Test',
    email: 'new@test.ci', mot_de_passe: 'Secure123!',
  });

  expect(res.status).toBe(201);
  expect(res.body.token).toBeDefined();

  const payload = jwt.verify(res.body.token, 'test-secret-key') as any;
  expect(payload.role).toBe('admin');

  // Vérifier que bcrypt.hash a bien été appelé (mot de passe non stocké en clair)
  const createCall = (mockPrisma.utilisateur.create as jest.Mock).mock.calls[0][0];
  expect(createCall.data.mot_de_passe_hash).not.toBe('Secure123!');
  expect(await bcrypt.compare('Secure123!', createCall.data.mot_de_passe_hash)).toBe(true);
});

// ── U-11 : login mauvais mot de passe → 401 ──────────────────────────────────
test('U-11 login mauvais mot de passe → 401', async () => {
  const hash = await bcrypt.hash('GoodPassword1!', 10);
  (mockPrisma.utilisateur.findFirst as jest.Mock).mockResolvedValue({
    id: 1, email: 'user@test.ci', mot_de_passe_hash: hash,
    role: 'admin', tenant_id: 'tid', actif: true,
  });

  const res = await request(app).post('/auth/login').send({
    email: 'user@test.ci', mot_de_passe: 'WrongPassword!',
  });

  expect(res.status).toBe(401);
  expect(res.body.message).toMatch(/incorrect/i);
});

// ── U-12 : login email inexistant → 401 ──────────────────────────────────────
test('U-12 login email inexistant → 401', async () => {
  (mockPrisma.utilisateur.findFirst as jest.Mock).mockResolvedValue(null);

  const res = await request(app).post('/auth/login').send({
    email: 'nobody@nowhere.ci', mot_de_passe: 'Whatever1!',
  });

  expect(res.status).toBe(401);
});
