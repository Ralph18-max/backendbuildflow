// F-33 à F-35 — Workflow clôture
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import comptabiliteRouter from '../../routes/comptabilite.routes';
import chantiersRouter from '../../routes/chantiers.routes';
import prisma from '../../prisma';

jest.mock('../../prisma');
const mock = prisma as jest.Mocked<typeof prisma>;

const app = express();
app.use(express.json());
app.use('/comptabilite', comptabiliteRouter);
app.use('/chantiers', chantiersRouter);

const SECRET = 'test-secret-key';
const tok = (role: string) =>
  `Bearer ${jwt.sign({ id: 1, email: 'a@b.ci', role, tenant_id: 'tid1' }, SECRET)}`;

// ── F-33 : admin clôture sans validation comptable → 400 ─────────────────────
test('F-33 admin clôture sans bilan validé → 400', async () => {
  (mock.cloture.findUnique as jest.Mock).mockResolvedValue(null); // pas de cloture

  const res = await request(app)
    .post('/comptabilite/cloture/6/cloturer')
    .set('Authorization', tok('admin'));

  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/comptable/i);
});

// ── F-34 : workflow complet → statut cloture ─────────────────────────────────
test('F-34 comptable valide → admin clôture → statut cloture', async () => {
  // Étape 1 : comptable valide le bilan
  (mock.cloture.findUnique as jest.Mock).mockResolvedValueOnce(null);
  (mock.cloture.upsert as jest.Mock).mockResolvedValue({
    id: 1, statut_bilan: 'bilan_valide',
    date_validation_comptable: new Date().toISOString(),
  });

  const validerRes = await request(app)
    .post('/comptabilite/cloture/6/valider')
    .set('Authorization', tok('comptable'));
  expect(validerRes.status).toBe(200);
  expect(validerRes.body.statut_bilan).toBe('bilan_valide');

  // Étape 2 : admin clôture officiellement
  (mock.cloture.findUnique as jest.Mock).mockResolvedValueOnce({ statut_bilan: 'bilan_valide' });
  (mock.chantier.findUnique as jest.Mock).mockResolvedValue({
    id: 6, situations: [{ montant_encaisse: 95_285_000 }], budget: { cout_reel_a_date: 115_000_000 },
  });
  (mock.cloture.update as jest.Mock).mockResolvedValue({
    id: 1, statut_bilan: 'cloture',
    date_cloture_admin: new Date().toISOString(),
    marge_reelle: -19_715_000,
  });
  (mock.chantier.update as jest.Mock).mockResolvedValue({ id: 6, statut: 'cloture' });

  const clotureRes = await request(app)
    .post('/comptabilite/cloture/6/cloturer')
    .set('Authorization', tok('admin'));
  expect(clotureRes.status).toBe(200);
  expect(clotureRes.body.statut_bilan).toBe('cloture');

  // Vérifier que le chantier est passé en statut cloture
  expect(mock.chantier.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: { statut: 'cloture' } })
  );
});

// ── F-35 : chantier clôturé → mise à jour avancement refusée ─────────────────
test('F-35 chantier clôturé → updateMany count=0 → 404', async () => {
  // Chantier clôturé : updateMany ne trouve pas (statut cloture ne peut pas être modifié)
  (mock.corpsEtat.update as jest.Mock).mockResolvedValue({ id: 1 });
  (mock.corpsEtat.findMany as jest.Mock).mockResolvedValue([{ part_chantier: 100, avancement: 100 }]);
  (mock.chantier.updateMany as jest.Mock).mockResolvedValue({ count: 0 }); // 0 = introuvable ou clôturé

  const res = await request(app)
    .patch('/chantiers/6/avancement')
    .set('Authorization', tok('conducteur'));

  // 404 car count=0
  expect(res.status).toBe(404);
});
