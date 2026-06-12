import { Router, Response } from 'express';
import prisma from '../prisma';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authMiddleware);

// GET /api/clients
router.get('/', requireRole('admin', 'conducteur', 'comptable'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const clients = await prisma.client.findMany({
    where: { tenant_id: req.user!.tenant_id },
    include: { _count: { select: { contrats: true } } },
    orderBy: { id: 'desc' },
  });
  res.json(clients.map(c => ({ ...c, nb_contrats: c._count.contrats })));
}));

// GET /api/clients/:id
router.get('/:id', requireRole('admin', 'conducteur', 'comptable'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await prisma.client.findFirst({
    where: { id: Number(req.params['id']), tenant_id: req.user!.tenant_id },
    include: { contrats: true },
  });
  if (!client) { res.status(404).json({ message: 'Client introuvable' }); return; }
  res.json(client);
}));

// POST /api/clients
router.post('/', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { nom, prenom, raison_sociale, type_client, telephone, email, adresse } = req.body;
  if (!telephone || !email || !adresse) {
    res.status(400).json({ message: 'Téléphone, email et adresse sont requis' });
    return;
  }
  if (type_client === 'societe') {
    if (!raison_sociale) {
      res.status(400).json({ message: 'La raison sociale est requise pour une société' });
      return;
    }
  } else if (!nom || !prenom) {
    res.status(400).json({ message: 'Le nom et le prénom sont requis pour un particulier' });
    return;
  }

  const doublon = await prisma.client.findFirst({
    where: { tenant_id: req.user!.tenant_id, email },
  });
  if (doublon) {
    res.status(400).json({ message: 'Un client avec cet email existe déjà' });
    return;
  }

  const client = await prisma.client.create({
    data: { nom, prenom, raison_sociale, type_client, telephone, email, adresse, tenant_id: req.user!.tenant_id },
  });
  res.status(201).json(client);
}));

// PUT /api/clients/:id
router.put('/:id', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params['id']);
  const { nom, prenom, raison_sociale, type_client, telephone, email, adresse } = req.body;

  if (type_client === 'societe') {
    if (!raison_sociale) {
      res.status(400).json({ message: 'La raison sociale est requise pour une société' });
      return;
    }
  } else if (!nom || !prenom) {
    res.status(400).json({ message: 'Le nom et le prénom sont requis pour un particulier' });
    return;
  }

  if (email) {
    const doublon = await prisma.client.findFirst({
      where: { tenant_id: req.user!.tenant_id, email, id: { not: id } },
    });
    if (doublon) {
      res.status(400).json({ message: 'Un client avec cet email existe déjà' });
      return;
    }
  }

  const client = await prisma.client.updateMany({
    where: { id, tenant_id: req.user!.tenant_id },
    data: { nom, prenom, raison_sociale, type_client, telephone, email, adresse },
  });
  if (!client.count) { res.status(404).json({ message: 'Client introuvable' }); return; }
  res.json({ message: 'Client mis à jour' });
}));

// DELETE /api/clients/:id
router.delete('/:id', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params['id']);
  const client = await prisma.client.findFirst({
    where: { id, tenant_id: req.user!.tenant_id },
    include: { _count: { select: { contrats: true } } },
  });
  if (!client) { res.status(404).json({ message: 'Client introuvable' }); return; }
  if (client._count.contrats > 0) {
    res.status(400).json({ message: 'Impossible de supprimer un client ayant des contrats associés' });
    return;
  }
  await prisma.client.delete({ where: { id } });
  res.json({ message: 'Client supprimé' });
}));

export default router;
