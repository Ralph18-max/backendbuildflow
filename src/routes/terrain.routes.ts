import { Router, Response } from 'express';
import prisma from '../prisma';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authMiddleware);

// ── Rapports terrain ──────────────────────────────────────────────

// GET /api/terrain/rapports
router.get('/rapports', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { tenant_id: req.user!.tenant_id };
  if (req.query['chantier']) where['id_chantier'] = Number(req.query['chantier']);

  const rapports = await prisma.rapportTerrain.findMany({
    where,
    include: {
      corps_travaux: true,
      chantier: { select: { nom_chantier: true } },
    },
    orderBy: { date_rapport: 'desc' },
  });
  res.json(rapports);
}));

// POST /api/terrain/rapports
router.post('/rapports', requireRole('admin', 'conducteur', 'chef_chantier'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id_chantier, date_rapport, redacteur, effectif_present,
          meteo, observations, incidents, a_incident, corps_travaux } = req.body;

  const rapport = await prisma.rapportTerrain.create({
    data: {
      tenant_id: req.user!.tenant_id,
      id_chantier: Number(id_chantier),
      date_rapport: new Date(date_rapport),
      redacteur, effectif_present: Number(effectif_present),
      meteo, observations, incidents,
      a_incident: Boolean(a_incident),
      corps_travaux: {
        create: (corps_travaux || []).map((c: { id_corps_etat: number; nom: string; avancement_avant: number; avancement_apres: number }) => ({
          id_corps_etat:    Number(c.id_corps_etat),
          nom:              c.nom,
          avancement_avant: Number(c.avancement_avant),
          avancement_apres: Number(c.avancement_apres),
        })),
      },
    },
    include: {
      corps_travaux: true,
      chantier: { select: { nom_chantier: true } },
    },
  });

  // Mise à jour de l'avancement des corps d'état
  for (const c of corps_travaux || []) {
    await prisma.corpsEtat.updateMany({
      where: { id: Number(c.id_corps_etat), id_chantier: Number(id_chantier) },
      data: { avancement: Number(c.avancement_apres) },
    });
  }

  res.status(201).json(rapport);
}));

// ── Pointages ─────────────────────────────────────────────────────

// GET /api/terrain/pointages
router.get('/pointages', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { tenant_id: req.user!.tenant_id };
  if (req.query['chantier']) where['id_chantier'] = Number(req.query['chantier']);

  const pointages = await prisma.pointage.findMany({
    where,
    include: {
      intervenants: true,
      chantier: { select: { nom_chantier: true } },
    },
    orderBy: { date: 'desc' },
  });
  res.json(pointages);
}));

// POST /api/terrain/pointages
router.post('/pointages', requireRole('admin', 'conducteur', 'chef_chantier'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id_chantier, date, effectif_prevu, intervenants } = req.body;

  const liste = intervenants || [];
  const total_presents = liste.filter((i: { present: boolean }) => i.present).length;
  const total_heures   = liste.reduce((s: number, i: { present: boolean; heures: number }) => s + (i.present ? Number(i.heures) : 0), 0);

  const pointage = await prisma.pointage.create({
    data: {
      tenant_id: req.user!.tenant_id,
      id_chantier: Number(id_chantier),
      date: new Date(date),
      effectif_prevu: Number(effectif_prevu),
      total_presents,
      total_heures,
      intervenants: {
        create: liste.map((i: { id_intervenant: number; nom_complet: string; corps_etat: string; present: boolean; heures: number }) => ({
          id_intervenant: Number(i.id_intervenant),
          nom_complet:    i.nom_complet,
          corps_etat:     i.corps_etat,
          present:        Boolean(i.present),
          heures:         Number(i.heures),
        })),
      },
    },
    include: { intervenants: true },
  });
  res.status(201).json(pointage);
}));

export default router;
