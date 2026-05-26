import { Router, Response } from 'express';
import prisma from '../prisma';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authMiddleware);

// GET /api/comptabilite/bilan
router.get('/bilan', requireRole('admin', 'comptable'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const chantiers = await prisma.chantier.findMany({
    where: { tenant_id: req.user!.tenant_id },
    include: {
      budget: true,
      situations: true,
      cloture: true,
      contrat: { include: { client: true } },
    },
  });

  const bilan = chantiers.map(c => {
    const encaisse     = c.situations.reduce((s, si) => s + si.montant_encaisse, 0);
    const raf          = c.situations.reduce((s, si) => s + si.reste_a_facturer, 0);
    const cout_reel    = c.budget?.cout_reel_a_date || 0;
    const marge        = encaisse - cout_reel;
    // Utiliser le montant révisé (avec avenants signés) pour les calculs financiers
    const montant_marche = (c.contrat as any)?.montant_marche_revise || (c.contrat as any)?.montant_marche || 0;
    const rad          = montant_marche - cout_reel;
    const avancement   = c.situations.length > 0
      ? Math.max(...c.situations.map(s => s.avancement_facture))
      : 0;
    const client       = (c.contrat as any)?.client;
    const nom_client   = client
      ? (client.type_client === 'societe'
          ? (client.raison_sociale || '')
          : `${client.nom || ''} ${client.prenom || ''}`.trim())
      : '';
    return {
      id:            c.id,
      nom_chantier:  c.nom_chantier,
      nom_client,
      statut:        c.statut,
      statut_bilan:  c.cloture?.statut_bilan || 'en_cours',
      avancement,
      montant_marche,
      encaisse,
      raf,
      rad,
      cout_reel,
      marge,
      alerte: c.budget ? cout_reel > c.budget.debourse_sec_estime * 1.05 : false,
    };
  });

  res.json(bilan);
}));

// POST /api/comptabilite/cloture/:chantier_id/valider — étape 1 comptable
router.post('/cloture/:chantier_id/valider', requireRole('comptable'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id_chantier = Number(req.params['chantier_id']);

  const existante = await prisma.cloture.findUnique({ where: { id_chantier } });
  if (existante && existante.statut_bilan !== 'en_cours') {
    res.status(409).json({ message: 'Clôture déjà validée ou effectuée' });
    return;
  }

  const cloture = await prisma.cloture.upsert({
    where: { id_chantier },
    create: {
      tenant_id: req.user!.tenant_id,
      id_chantier,
      statut_bilan: 'bilan_valide',
      date_validation_comptable: new Date(),
    },
    update: {
      statut_bilan: 'bilan_valide',
      date_validation_comptable: new Date(),
    },
  });
  res.json(cloture);
}));

// POST /api/comptabilite/cloture/:chantier_id/cloturer — étape 2 admin
router.post('/cloture/:chantier_id/cloturer', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id_chantier = Number(req.params['chantier_id']);
  const cloture = await prisma.cloture.findUnique({ where: { id_chantier } });

  if (!cloture || cloture.statut_bilan !== 'bilan_valide') {
    res.status(400).json({ message: 'Le comptable doit valider le bilan avant la clôture' });
    return;
  }

  const chantier = await prisma.chantier.findUnique({
    where: { id: id_chantier },
    include: { budget: true, situations: true },
  });
  const encaisse  = chantier?.situations.reduce((s, si) => s + si.montant_encaisse, 0) || 0;
  const cout_reel = chantier?.budget?.cout_reel_a_date || 0;
  const marge_reelle = encaisse - cout_reel;

  const updated = await prisma.cloture.update({
    where: { id_chantier },
    data: { statut_bilan: 'cloture', date_cloture_admin: new Date(), marge_reelle },
  });

  await prisma.chantier.update({ where: { id: id_chantier }, data: { statut: 'cloture' } });

  res.json(updated);
}));

export default router;
