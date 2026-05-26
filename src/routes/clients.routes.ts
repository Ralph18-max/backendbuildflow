import { Router, Response } from 'express';
import prisma from '../prisma';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authMiddleware);

// GET /api/clients
router.get('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const clients = await prisma.client.findMany({
    where: { tenant_id: req.user!.tenant_id },
    include: { _count: { select: { contrats: true } } },
    orderBy: { id: 'desc' },
  });
  res.json(clients.map(c => ({ ...c, nb_contrats: c._count.contrats })));
}));

// GET /api/clients/:id
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await prisma.client.findFirst({
    where: { id: Number(req.params['id']), tenant_id: req.user!.tenant_id },
    include: { contrats: true },
  });
  if (!client) { res.status(404).json({ message: 'Client introuvable' }); return; }
  res.json(client);
}));

// POST /api/clients
router.post('/', requireRole('admin', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { nom, prenom, raison_sociale, type_client, telephone, email, adresse } = req.body;
  if (!telephone || !email || !adresse) {
    res.status(400).json({ message: 'Téléphone, email et adresse sont requis' });
    return;
  }
  const client = await prisma.client.create({
    data: { nom, prenom, raison_sociale, type_client, telephone, email, adresse, tenant_id: req.user!.tenant_id },
  });
  res.status(201).json(client);
}));

// PUT /api/clients/:id
router.put('/:id', requireRole('admin', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { nom, prenom, raison_sociale, type_client, telephone, email, adresse } = req.body;
  const client = await prisma.client.updateMany({
    where: { id: Number(req.params['id']), tenant_id: req.user!.tenant_id },
    data: { nom, prenom, raison_sociale, type_client, telephone, email, adresse },
  });
  if (!client.count) { res.status(404).json({ message: 'Client introuvable' }); return; }
  res.json({ message: 'Client mis à jour' });
}));

export default router;
