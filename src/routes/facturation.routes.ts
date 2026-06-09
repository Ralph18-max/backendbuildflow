import { Router, Response } from 'express';
import prisma from '../prisma';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authMiddleware);

const DELAI_PAIEMENT_JOURS = 30;
const TAUX_RETENUE_GARANTIE = 0.05;

// GET /api/facturation/situations
router.get('/situations', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { tenant_id: req.user!.tenant_id };
  if (req.query['chantier']) where['id_chantier'] = Number(req.query['chantier']);

  const situations = await prisma.situation.findMany({
    where,
    include: {
      chantier: { select: { nom_chantier: true, contrat: { select: { id: true, client: true } } } },
      paiements: true,
    },
    orderBy: { date_emission: 'desc' },
  });

  // Auto-marquer en_retard celles dont l'échéance est dépassée
  const now = new Date();
  const idsRetard = situations
    .filter(s => s.statut === 'en_attente' && s.date_echeance && new Date(s.date_echeance) < now)
    .map(s => s.id);

  if (idsRetard.length > 0) {
    await prisma.situation.updateMany({
      where: { id: { in: idsRetard } },
      data: { statut: 'en_retard' },
    });
    situations.forEach(s => {
      if (idsRetard.includes(s.id)) (s as any).statut = 'en_retard';
    });
  }

  res.json(situations);
}));

// GET /api/facturation/situations/:id
router.get('/situations/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const situation = await prisma.situation.findFirst({
    where: { id: Number(req.params['id']), tenant_id: req.user!.tenant_id },
    include: { chantier: true, paiements: true },
  });
  if (!situation) { res.status(404).json({ message: 'Situation introuvable' }); return; }
  res.json(situation);
}));

// POST /api/facturation/situations
router.post('/situations', requireRole('admin', 'comptable'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id_chantier, montant_ht, taux_tva, avancement_facture, delai_paiement_jours } = req.body;

  const count = await prisma.situation.count({ where: { id_chantier: Number(id_chantier) } });
  const tva = Number(taux_tva || 18);
  const ht  = Number(montant_ht);
  const ttc = ht * (1 + tva / 100);
  const retenue_garantie = ttc * TAUX_RETENUE_GARANTIE;
  const montant_net      = ttc - retenue_garantie;

  const delai = Number(delai_paiement_jours || DELAI_PAIEMENT_JOURS);
  const date_echeance = new Date();
  date_echeance.setDate(date_echeance.getDate() + delai);

  const situation = await prisma.situation.create({
    data: {
      tenant_id: req.user!.tenant_id,
      id_chantier: Number(id_chantier),
      numero_situation: count + 1,
      date_echeance,
      montant_ht: ht,
      taux_tva: tva,
      montant_ttc: ttc,
      retenue_garantie,
      montant_net,
      reste_a_facturer: montant_net, // ce qui reste à payer hors retenue
      avancement_facture: Number(avancement_facture || 0),
    },
  });
  res.status(201).json(situation);
}));

// POST /api/facturation/encaissements
router.post('/encaissements', requireRole('comptable', 'admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id_situation, montant, date_paiement, reference, mode_paiement } = req.body;

  const situation = await prisma.situation.findFirst({
    where: { id: Number(id_situation), tenant_id: req.user!.tenant_id },
  });
  if (!situation) { res.status(404).json({ message: 'Situation introuvable' }); return; }

  const paiement = await prisma.paiement.create({
    data: {
      tenant_id: req.user!.tenant_id,
      id_situation: Number(id_situation),
      montant: Number(montant),
      date_paiement: new Date(date_paiement),
      reference, mode_paiement,
    },
  });

  const nouveau_encaisse = situation.montant_encaisse + Number(montant);
  // La situation est payée quand l'encaissé couvre le montant net (hors retenue)
  const montant_net = situation.montant_net || (situation.montant_ttc * (1 - TAUX_RETENUE_GARANTIE));
  const reste = montant_net - nouveau_encaisse;
  const statut = reste <= 0 ? 'payee' : 'en_attente';

  await prisma.situation.update({
    where: { id: Number(id_situation) },
    data: { montant_encaisse: nouveau_encaisse, reste_a_facturer: Math.max(0, reste), statut },
  });

  res.status(201).json(paiement);
}));

// ── Factures sous-traitants ───────────────────────────────────────────────────

// GET /api/facturation/factures-st
router.get('/factures-st', requireRole('admin', 'comptable', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { tenant_id: req.user!.tenant_id };
  if (req.query['chantier']) where['id_chantier'] = Number(req.query['chantier']);

  const factures = await prisma.factureST.findMany({
    where,
    include: { chantier: { select: { nom_chantier: true } } },
    orderBy: { created_at: 'desc' },
  });
  res.json(factures);
}));

// POST /api/facturation/factures-st
router.post('/factures-st', requireRole('admin', 'comptable'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id_chantier, intervenant, corps_etat, date_facture, montant_ht, taux_tva } = req.body;

  const count = await prisma.factureST.count({ where: { tenant_id: req.user!.tenant_id } });
  const ht  = Number(montant_ht);
  const tva = Number(taux_tva || 18);
  const montant_tva = ht * tva / 100;
  const montant_ttc = ht + montant_tva;
  const annee = new Date().getFullYear();
  const numero = `FST-${annee}-${String(count + 1).padStart(3, '0')}`;

  const facture = await prisma.factureST.create({
    data: {
      tenant_id: req.user!.tenant_id,
      id_chantier: Number(id_chantier),
      numero,
      intervenant,
      corps_etat: corps_etat || null,
      date_facture: new Date(date_facture),
      montant_ht: ht,
      taux_tva: tva,
      montant_tva,
      montant_ttc,
    },
  });
  res.status(201).json(facture);
}));

// PATCH /api/facturation/factures-st/:id/valider
router.patch('/factures-st/:id/valider', requireRole('admin', 'comptable'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const facture = await prisma.factureST.findFirst({
    where: { id: Number(req.params['id']), tenant_id: req.user!.tenant_id },
  });
  if (!facture) { res.status(404).json({ message: 'Facture introuvable' }); return; }

  const updated = await prisma.factureST.update({
    where: { id: Number(req.params['id']) },
    data: { statut: 'validee' },
  });
  res.json(updated);
}));

// GET /api/facturation/stats
router.get('/stats', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const situations = await prisma.situation.findMany({
    where: { tenant_id: req.user!.tenant_id },
  });

  const now = new Date();
  // Marquer en_retard à la volée pour les stats
  const enRetardIds = situations
    .filter(s => s.statut === 'en_attente' && s.date_echeance && new Date(s.date_echeance) < now)
    .map(s => s.id);
  if (enRetardIds.length > 0) {
    await prisma.situation.updateMany({ where: { id: { in: enRetardIds } }, data: { statut: 'en_retard' } });
    situations.forEach(s => { if (enRetardIds.includes(s.id)) (s as any).statut = 'en_retard'; });
  }

  const total_encaisse = situations.reduce((s, si) => s + si.montant_encaisse, 0);
  const en_retard      = situations
    .filter(si => si.statut === 'en_retard')
    .reduce((s, si) => s + si.reste_a_facturer, 0);

  res.json({ total_encaisse, en_retard });
}));

export default router;
