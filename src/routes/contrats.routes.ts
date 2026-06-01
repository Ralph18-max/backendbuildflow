import { Router, Response } from 'express';
import prisma from '../prisma';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authMiddleware);

// GET /api/contrats/stats — total RAF global (avant /:id pour éviter le conflit de route)
router.get('/stats', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const chantiers = await prisma.chantier.findMany({
    where: { tenant_id: req.user!.tenant_id },
    include: { situations: true, contrat: true },
  });

  let total_raf = 0;
  for (const c of chantiers) {
    const emis    = c.situations.reduce((s, si) => s + si.montant_ttc, 0);
    // Utiliser le montant révisé si disponible, sinon le montant initial
    const montant = c.contrat.montant_marche_revise || c.contrat.montant_marche;
    total_raf    += Math.max(0, montant - emis);
  }

  res.json({ total_raf });
}));

// GET /api/contrats
router.get('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const contrats = await prisma.contrat.findMany({
    where: { tenant_id: req.user!.tenant_id },
    include: { client: true, modifications: true, chantier: { select: { id: true, statut: true } } },
    orderBy: { id: 'desc' },
  });
  res.json(contrats);
}));

// GET /api/contrats/:id
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const contrat = await prisma.contrat.findFirst({
    where: { id: Number(req.params['id']), tenant_id: req.user!.tenant_id },
    include: { client: true, modifications: true, chantier: true },
  });
  if (!contrat) { res.status(404).json({ message: 'Contrat introuvable' }); return; }
  res.json(contrat);
}));

// POST /api/contrats
router.post('/', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id_client, type_construction, montant_marche,
          date_signature, date_demarrage_prevue, date_livraison_prevue, penalites_retard } = req.body;

  const count = await prisma.contrat.count({ where: { tenant_id: req.user!.tenant_id } });
  const numero_marche = req.body.numero_marche
    || `MRC-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

  const montant = Number(montant_marche);

  const contrat = await prisma.contrat.create({
    data: {
      tenant_id: req.user!.tenant_id,
      id_client: Number(id_client),
      numero_marche, type_construction,
      montant_marche:        montant,
      montant_marche_revise: montant, // initialisé = montant initial, évolue avec les avenants signés
      date_signature: new Date(date_signature),
      date_demarrage_prevue: new Date(date_demarrage_prevue),
      date_livraison_prevue: new Date(date_livraison_prevue),
      penalites_retard: Number(penalites_retard || 0),
    },
  });
  res.status(201).json(contrat);
}));

// PATCH /api/contrats/:id — modifier les infos d'un contrat (admin seulement)
router.patch('/:id', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params['id']);
  const contrat = await prisma.contrat.findFirst({
    where: { id, tenant_id: req.user!.tenant_id },
  });
  if (!contrat) { res.status(404).json({ message: 'Contrat introuvable' }); return; }

  const { type_construction, date_signature, date_demarrage_prevue, date_livraison_prevue, penalites_retard, statut } = req.body;

  const updated = await prisma.contrat.update({
    where: { id },
    data: {
      ...(type_construction !== undefined && { type_construction }),
      ...(date_signature !== undefined && { date_signature: new Date(date_signature) }),
      ...(date_demarrage_prevue !== undefined && { date_demarrage_prevue: new Date(date_demarrage_prevue) }),
      ...(date_livraison_prevue !== undefined && { date_livraison_prevue: new Date(date_livraison_prevue) }),
      ...(penalites_retard !== undefined && { penalites_retard: Number(penalites_retard) }),
      ...(statut !== undefined && { statut }),
    },
    include: { client: true, modifications: true, chantier: true },
  });
  res.json(updated);
}));

// POST /api/contrats/:id/avenants
router.post('/:id/avenants', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id_contrat = Number(req.params['id']);
  const { motif, montant_supplementaire, delai_supplementaire, statut } = req.body;

  const count = await prisma.modification.count({ where: { id_contrat } });

  const avenant = await prisma.modification.create({
    data: {
      tenant_id: req.user!.tenant_id,
      id_contrat,
      numero_modification: count + 1,
      motif,
      montant_supplementaire: Number(montant_supplementaire || 0),
      delai_supplementaire:   Number(delai_supplementaire || 0),
      statut: statut || 'en_attente',
    },
  });

  // Si l'avenant est créé directement signé, mettre à jour le montant révisé
  if (avenant.statut === 'signe') {
    await prisma.contrat.update({
      where: { id: id_contrat },
      data: { montant_marche_revise: { increment: avenant.montant_supplementaire } },
    });
  }

  res.status(201).json(avenant);
}));

// PATCH /api/contrats/:id/avenants/:avId/signer — signer un avenant en_attente
router.patch('/:id/avenants/:avId/signer', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id_contrat = Number(req.params['id']);
  const id_avenant = Number(req.params['avId']);

  const avenant = await prisma.modification.findFirst({
    where: { id: id_avenant, id_contrat, tenant_id: req.user!.tenant_id },
  });
  if (!avenant) { res.status(404).json({ message: 'Avenant introuvable' }); return; }
  if (avenant.statut === 'signe') { res.status(409).json({ message: 'Avenant déjà signé' }); return; }

  const updated = await prisma.modification.update({
    where: { id: id_avenant },
    data: { statut: 'signe' },
  });

  // Mettre à jour le montant marché révisé du contrat
  await prisma.contrat.update({
    where: { id: id_contrat },
    data: { montant_marche_revise: { increment: avenant.montant_supplementaire } },
  });

  const contrat = await prisma.contrat.findUnique({ where: { id: id_contrat }, select: { montant_marche_revise: true } });

  res.json({ avenant: updated, montant_marche_revise: contrat?.montant_marche_revise });
}));

// PATCH /api/contrats/:id/avenants/:avId/refuser
router.patch('/:id/avenants/:avId/refuser', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id_avenant = Number(req.params['avId']);
  const id_contrat = Number(req.params['id']);

  const avenant = await prisma.modification.findFirst({
    where: { id: id_avenant, id_contrat, tenant_id: req.user!.tenant_id },
  });
  if (!avenant) { res.status(404).json({ message: 'Avenant introuvable' }); return; }
  if (avenant.statut === 'signe') { res.status(409).json({ message: 'Impossible de refuser un avenant déjà signé' }); return; }

  const updated = await prisma.modification.update({
    where: { id: id_avenant },
    data: { statut: 'refuse' },
  });
  res.json(updated);
}));

export default router;
