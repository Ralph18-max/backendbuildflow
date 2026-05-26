import { Router, Response } from 'express';
import prisma from '../prisma';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authMiddleware);

// GET /api/documents
router.get('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { tenant_id: req.user!.tenant_id };
  if (req.query['chantier']) where['id_chantier'] = Number(req.query['chantier']);
  if (req.query['categorie']) where['categorie'] = req.query['categorie'];

  const documents = await prisma.document.findMany({
    where,
    include: { chantier: { select: { nom_chantier: true } } },
    orderBy: { date_upload: 'desc' },
  });
  res.json(documents);
}));

// POST /api/documents
router.post('/', requireRole('admin', 'conducteur', 'chef_chantier'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id_chantier, nom_fichier, extension, categorie, taille_ko, url_fichier } = req.body;

  if (!id_chantier || !nom_fichier) {
    res.status(400).json({ message: 'Chantier et nom de fichier requis' });
    return;
  }

  const document = await prisma.document.create({
    data: {
      tenant_id:   req.user!.tenant_id,
      id_chantier: Number(id_chantier),
      nom_fichier, extension, categorie,
      taille_ko:   Number(taille_ko || 0),
      url_fichier,
      ajoute_par:  `${req.user!.email}`,
    },
  });
  res.status(201).json(document);
}));

// DELETE /api/documents/:id
router.delete('/:id', requireRole('admin', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const deleted = await prisma.document.deleteMany({
    where: { id: Number(req.params['id']), tenant_id: req.user!.tenant_id },
  });
  if (!deleted.count) { res.status(404).json({ message: 'Document introuvable' }); return; }
  res.json({ message: 'Document supprimé' });
}));

export default router;
