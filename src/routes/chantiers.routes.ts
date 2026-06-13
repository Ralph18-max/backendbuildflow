import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authMiddleware);

// GET /api/chantiers
router.get('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  const where: Prisma.ChantierWhereInput = { tenant_id: user.tenant_id };

  if (user.role === 'chef_chantier') {
    where.chef_chantier = { contains: `${user.prenom} ${user.nom}`, mode: 'insensitive' };
  }

  const chantiers = await prisma.chantier.findMany({
    where,
    include: {
      budget: true,
      planning: { include: { jalons: true } },
      corps_etat: true,
      contrat: { include: { client: true } },
    },
    orderBy: { id: 'desc' },
  });
  res.json(chantiers);
}));

// GET /api/chantiers/en-cours
router.get('/en-cours', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  const where: Prisma.ChantierWhereInput = { tenant_id: user.tenant_id, statut: 'en_cours' };

  if (user.role === 'chef_chantier') {
    where.chef_chantier = { contains: `${user.prenom} ${user.nom}`, mode: 'insensitive' };
  }

  const chantiers = await prisma.chantier.findMany({
    where,
    include: {
      budget: true,
      corps_etat: true,
      contrat: { include: { client: true } },
    },
    orderBy: { id: 'desc' },
  });
  res.json(chantiers);
}));

// GET /api/chantiers/:id
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const chantier = await prisma.chantier.findFirst({
    where: { id: Number(req.params['id']), tenant_id: req.user!.tenant_id },
    include: {
      budget: true,
      planning: { include: { jalons: true } },
      corps_etat: { include: { intervenants: true } },
      intervenants: true,
      ressources: true,
      situations: true,
      cloture: true,
      contrat: { include: { client: true, modifications: true } },
    },
  });
  if (!chantier) { res.status(404).json({ message: 'Chantier introuvable' }); return; }
  res.json(chantier);
}));

// POST /api/chantiers
router.post('/', requireRole('admin', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id_contrat, nom_chantier, localisation, description,
          date_livraison_prevue, date_demarrage_reelle, chef_chantier } = req.body;

  try {
    const chantier = await prisma.chantier.create({
      data: {
        tenant_id: req.user!.tenant_id,
        id_contrat: Number(id_contrat),
        nom_chantier, localisation, description, chef_chantier,
        date_livraison_prevue: new Date(date_livraison_prevue),
        ...(date_demarrage_reelle ? { date_demarrage_reelle: new Date(date_demarrage_reelle) } : {}),
      },
    });
    res.status(201).json(chantier);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      res.status(409).json({ message: 'Ce contrat a déjà un chantier associé.' });
      return;
    }
    throw e;
  }
}));

// PATCH /api/chantiers/:id/avancement — recalcul automatique
router.patch('/:id/avancement', requireRole('admin', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params['id']);

  const corps = await prisma.corpsEtat.findMany({ where: { id_chantier: id } });
  const avancement_global = corps.reduce((sum, c) => sum + (c.part_chantier * c.avancement) / 100, 0);

  const updated = await prisma.chantier.updateMany({
    where: { id, tenant_id: req.user!.tenant_id },
    data: { avancement_global: Math.round(avancement_global * 10) / 10 },
  });
  if (!updated.count) { res.status(404).json({ message: 'Chantier introuvable' }); return; }
  res.json({ avancement_global });
}));

// PATCH /api/chantiers/:id — modification des infos générales
router.patch('/:id', requireRole('admin', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { nom_chantier, localisation, description, chef_chantier, date_demarrage_reelle, date_livraison_prevue } = req.body;
  const updated = await prisma.chantier.updateMany({
    where: { id: Number(req.params['id']), tenant_id: req.user!.tenant_id },
    data: {
      ...(nom_chantier          && { nom_chantier }),
      ...(localisation          && { localisation }),
      ...(description           !== undefined && { description }),
      ...(chef_chantier         && { chef_chantier }),
      ...(date_demarrage_reelle ? { date_demarrage_reelle: new Date(date_demarrage_reelle) } : {}),
      ...(date_livraison_prevue && { date_livraison_prevue: new Date(date_livraison_prevue) }),
    },
  });
  if (!updated.count) { res.status(404).json({ message: 'Chantier introuvable' }); return; }
  res.json({ message: 'Chantier mis à jour' });
}));

// PATCH /api/chantiers/:id/statut
router.patch('/:id/statut', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { statut } = req.body;
  await prisma.chantier.updateMany({
    where: { id: Number(req.params['id']), tenant_id: req.user!.tenant_id },
    data: { statut },
  });
  res.json({ message: 'Statut mis à jour' });
}));

// POST /api/chantiers/:id/budget — S0 figé (création unique)
router.post('/:id/budget', requireRole('admin', 'comptable'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id_chantier = Number(req.params['id']);
  const existant = await prisma.budget.findFirst({ where: { id_chantier, tenant_id: req.user!.tenant_id } });
  if (existant) { res.status(409).json({ message: 'Budget S0 déjà défini — il est figé' }); return; }

  const { debourse_sec_estime, frais_generaux, marge_prevue, provision_aleas } = req.body;
  const montant_total_S0 = Number(debourse_sec_estime) + Number(frais_generaux)
                         + Number(marge_prevue) + Number(provision_aleas);

  const budget = await prisma.budget.create({
    data: {
      tenant_id: req.user!.tenant_id,
      id_chantier,
      debourse_sec_estime: Number(debourse_sec_estime),
      frais_generaux: Number(frais_generaux || 0),
      marge_prevue: Number(marge_prevue || 0),
      provision_aleas: Number(provision_aleas || 0),
      montant_total_S0,
      reste_a_depenser: montant_total_S0,
      cree_par: req.user!.email,
    },
  });
  res.status(201).json(budget);
}));

// PATCH /api/chantiers/:id/budget/cout-reel — mise à jour coût réel
router.patch('/:id/budget/cout-reel', requireRole('admin', 'comptable', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id_chantier = Number(req.params['id']);
  const { cout_reel_a_date } = req.body;

  const budget = await prisma.budget.findFirst({ where: { id_chantier, tenant_id: req.user!.tenant_id } });
  if (!budget) { res.status(404).json({ message: 'Budget introuvable' }); return; }

  const reste_a_depenser = budget.montant_total_S0 - Number(cout_reel_a_date);
  // positif = dépassement, négatif = économie
  const ecart_budget = Number(cout_reel_a_date) - budget.montant_total_S0;

  await prisma.budget.update({
    where: { id_chantier },
    data: { cout_reel_a_date: Number(cout_reel_a_date), reste_a_depenser, ecart_budget },
  });
  res.json({ cout_reel_a_date, reste_a_depenser, ecart_budget });
}));

// ── Corps d'état ──────────────────────────────────────────────────

// GET /api/chantiers/:id/corps-etat
router.get('/:id/corps-etat', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const corps = await prisma.corpsEtat.findMany({
    where: { id_chantier: Number(req.params['id']), tenant_id: req.user!.tenant_id },
    include: { intervenants: true },
    orderBy: { ordre_execution: 'asc' },
  });
  res.json(corps);
}));

// POST /api/chantiers/:id/corps-etat
router.post('/:id/corps-etat', requireRole('admin', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id_chantier = Number(req.params['id']);
  const { nom, part_chantier, ordre_execution, budget_alloue, date_debut_prevue, date_fin_prevue } = req.body;

  const chantier = await prisma.chantier.findFirst({
    where: { id: id_chantier, tenant_id: req.user!.tenant_id },
    select: {
      date_demarrage_reelle: true,
      date_livraison_prevue: true,
      contrat: { select: { date_demarrage_prevue: true } },
    },
  });
  if (!chantier) { res.status(404).json({ message: 'Chantier introuvable' }); return; }

  if (!date_debut_prevue || !date_fin_prevue) {
    res.status(400).json({ message: 'Les dates de début et de fin prévues sont obligatoires.' });
    return;
  }
  if (budget_alloue === undefined || budget_alloue === null || Number(budget_alloue) <= 0) {
    res.status(400).json({ message: 'Le budget alloué est obligatoire et doit être supérieur à 0.' });
    return;
  }
  if (new Date(date_debut_prevue) >= new Date(date_fin_prevue)) {
    res.status(400).json({ message: 'La date de début doit être avant la date de fin.' });
    return;
  }

  const dateMin = chantier.date_demarrage_reelle ?? chantier.contrat?.date_demarrage_prevue ?? null;
  if (date_debut_prevue && dateMin) {
    if (new Date(date_debut_prevue) < new Date(dateMin)) {
      res.status(400).json({ message: 'La date de début ne peut pas être avant le démarrage du chantier.' });
      return;
    }
  }
  if (date_fin_prevue && chantier.date_livraison_prevue) {
    if (new Date(date_fin_prevue) > chantier.date_livraison_prevue) {
      res.status(400).json({ message: 'La date de fin ne peut pas dépasser la livraison prévue du chantier.' });
      return;
    }
  }

  const existants = await prisma.corpsEtat.findMany({ where: { id_chantier } });
  const somme = existants.reduce((s, c) => s + c.part_chantier, 0);
  if (somme + Number(part_chantier) > 100) {
    res.status(400).json({ message: `La somme des parts dépasse 100% (actuel : ${somme}%)` });
    return;
  }

  const corps = await prisma.corpsEtat.create({
    data: {
      tenant_id: req.user!.tenant_id,
      id_chantier,
      nom,
      part_chantier:   Number(part_chantier || 0),
      ordre_execution: Number(ordre_execution || existants.length + 1),
      budget_alloue:   Number(budget_alloue || 0),
      date_debut_prevue: new Date(date_debut_prevue),
      date_fin_prevue:   new Date(date_fin_prevue),
    },
  });
  res.status(201).json(corps);
}));

// PATCH /api/chantiers/:id/corps-etat/:ceId/avancement — P-28 : chef_chantier inclus
router.patch('/:id/corps-etat/:ceId/avancement', requireRole('admin', 'conducteur', 'chef_chantier'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { avancement, cout_reel } = req.body;
  const av = Number(avancement);
  const id_chantier = Number(req.params['id']);

  const existant = await prisma.corpsEtat.findFirst({
    where: { id: Number(req.params['ceId']), id_chantier, tenant_id: req.user!.tenant_id },
  });
  if (!existant) { res.status(404).json({ message: 'Corps d\'état introuvable' }); return; }

  // Statut auto-déduit de l'avancement
  const statut = av >= 100 ? 'termine' : av > 0 ? 'en_cours' : 'en_attente';

  const updated = await prisma.corpsEtat.update({
    where: { id: existant.id },
    data: {
      avancement: av,
      statut,
      ...(cout_reel !== undefined && { cout_reel: Number(cout_reel) }),
    },
  });

  // Recalcul automatique de l'avancement global du chantier
  const tousCorps = await prisma.corpsEtat.findMany({ where: { id_chantier } });
  const avancement_global = tousCorps.reduce((sum, c) => sum + (c.part_chantier * c.avancement) / 100, 0);
  await prisma.chantier.update({
    where: { id: id_chantier },
    data: { avancement_global: Math.round(avancement_global * 10) / 10 },
  });

  res.json({ ...updated, avancement_global: Math.round(avancement_global * 10) / 10 });
}));

// DELETE /api/chantiers/:id/corps-etat/:ceId
router.delete('/:id/corps-etat/:ceId', requireRole('admin', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const ceId = Number(req.params['ceId']);

  const nbIntervenants = await prisma.intervenant.count({ where: { id_corps_etat: ceId } });
  if (nbIntervenants > 0) {
    res.status(400).json({ message: 'Impossible de supprimer ce corps d\'état : des intervenants y sont rattachés.' });
    return;
  }

  const deleted = await prisma.corpsEtat.deleteMany({
    where: { id: ceId, id_chantier: Number(req.params['id']), tenant_id: req.user!.tenant_id },
  });
  if (!deleted.count) { res.status(404).json({ message: 'Corps d\'état introuvable' }); return; }
  res.json({ message: 'Corps d\'état supprimé' });
}));

// ── Planning & Jalons ──────────────────────────────────────────────

// GET /api/chantiers/:id/planning
router.get('/:id/planning', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const planning = await prisma.planning.findFirst({
    where: { id_chantier: Number(req.params['id']), tenant_id: req.user!.tenant_id },
    include: { jalons: { orderBy: { date_prevue: 'asc' } } },
  });
  if (!planning) { res.status(404).json({ message: 'Planning introuvable' }); return; }
  res.json(planning);
}));

// POST /api/chantiers/:id/planning
router.post('/:id/planning', requireRole('admin', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id_chantier = Number(req.params['id']);
  const existant = await prisma.planning.findUnique({ where: { id_chantier } });
  const { date_debut_prevue, date_fin_prevue, jalons } = req.body;

  if (existant) {
    const updated = await prisma.planning.update({
      where: { id_chantier },
      data: { date_debut_prevue: new Date(date_debut_prevue), date_fin_prevue: new Date(date_fin_prevue), version: existant.version + 1 },
    });
    res.json(updated);
    return;
  }

  const planning = await prisma.planning.create({
    data: {
      tenant_id: req.user!.tenant_id,
      id_chantier,
      date_debut_prevue: new Date(date_debut_prevue),
      date_fin_prevue: new Date(date_fin_prevue),
      jalons: {
        create: (jalons || []).map((j: { nom_jalon: string; date_prevue: string }) => ({
          tenant_id:  req.user!.tenant_id,
          nom_jalon:  j.nom_jalon,
          date_prevue: new Date(j.date_prevue),
        })),
      },
    },
    include: { jalons: true },
  });
  res.status(201).json(planning);
}));

// POST /api/chantiers/:id/jalons
router.post('/:id/jalons', requireRole('admin', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id_chantier = Number(req.params['id']);
  let planning = await prisma.planning.findUnique({ where: { id_chantier } });

  // Pas de planning ? On en crée un automatiquement à partir des dates du chantier.
  if (!planning) {
    const chantier = await prisma.chantier.findFirst({
      where: { id: id_chantier, tenant_id: req.user!.tenant_id },
      select: { date_demarrage_reelle: true, date_livraison_prevue: true, created_at: true },
    });
    if (!chantier) { res.status(404).json({ message: 'Chantier introuvable' }); return; }

    planning = await prisma.planning.create({
      data: {
        tenant_id: req.user!.tenant_id,
        id_chantier,
        date_debut_prevue: chantier.date_demarrage_reelle || chantier.created_at,
        date_fin_prevue: chantier.date_livraison_prevue,
      },
    });
  }

  const { nom_jalon, date_prevue } = req.body;
  const jalon = await prisma.jalon.create({
    data: { tenant_id: req.user!.tenant_id, id_planning: planning.id, nom_jalon, date_prevue: new Date(date_prevue) },
  });
  res.status(201).json(jalon);
}));

// PATCH /api/chantiers/:id/jalons/:jalonId — marquer atteint/manqué
router.patch('/:id/jalons/:jalonId', requireRole('admin', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { statut, date_reelle } = req.body;

  const jalon = await prisma.jalon.findFirst({
    where: {
      id: Number(req.params['jalonId']),
      tenant_id: req.user!.tenant_id,
      planning: { id_chantier: Number(req.params['id']) },
    },
  });
  if (!jalon) { res.status(404).json({ message: 'Jalon introuvable' }); return; }

  const ecart_jours = date_reelle
    ? Math.round((new Date(date_reelle).getTime() - new Date(jalon.date_prevue).getTime()) / 86_400_000)
    : 0;

  const updated = await prisma.jalon.update({
    where: { id: jalon.id },
    data: { statut, date_reelle: date_reelle ? new Date(date_reelle) : undefined, ecart_jours },
  });
  res.json(updated);
}));

// ── Intervenants ───────────────────────────────────────────────────

// GET /api/chantiers/:id/intervenants
router.get('/:id/intervenants', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const intervenants = await prisma.intervenant.findMany({
    where: { id_chantier: Number(req.params['id']), tenant_id: req.user!.tenant_id },
    include: { corpsEtat: { select: { nom: true } } },
    orderBy: { id: 'asc' },
  });
  res.json(intervenants);
}));

// POST /api/chantiers/:id/intervenants
router.post('/:id/intervenants', requireRole('admin', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id_chantier = Number(req.params['id']);
  const { id_corps_etat, type_intervenant, nom, raison_sociale, nom_responsable, telephone, email, montant_contrat, assurance, numero_agrement } = req.body;

  const intervenant = await prisma.intervenant.create({
    data: {
      tenant_id: req.user!.tenant_id,
      id_chantier,
      id_corps_etat: Number(id_corps_etat),
      type_intervenant, nom: nom || raison_sociale, raison_sociale, nom_responsable, telephone, email,
      montant_contrat: Number(montant_contrat || 0),
      assurance: Boolean(assurance),
      numero_agrement,
    },
  });
  res.status(201).json(intervenant);
}));

// PATCH /api/chantiers/:id/intervenants/:intId — modifier
router.patch('/:id/intervenants/:intId', requireRole('admin', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { nom, raison_sociale, nom_responsable, telephone, email, montant_contrat, assurance, actif } = req.body;

  const existant = await prisma.intervenant.findFirst({
    where: { id: Number(req.params['intId']), id_chantier: Number(req.params['id']), tenant_id: req.user!.tenant_id },
  });
  if (!existant) { res.status(404).json({ message: 'Intervenant introuvable' }); return; }

  const updated = await prisma.intervenant.update({
    where: { id: existant.id },
    data: { nom, raison_sociale, nom_responsable, telephone, email, montant_contrat: Number(montant_contrat || 0), assurance: Boolean(assurance), actif: Boolean(actif) },
  });
  res.json(updated);
}));

// DELETE /api/chantiers/:id/intervenants/:intId
router.delete('/:id/intervenants/:intId', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const deleted = await prisma.intervenant.deleteMany({
    where: { id: Number(req.params['intId']), id_chantier: Number(req.params['id']), tenant_id: req.user!.tenant_id },
  });
  if (!deleted.count) { res.status(404).json({ message: 'Intervenant introuvable' }); return; }
  res.json({ message: 'Intervenant supprimé' });
}));

export default router;
