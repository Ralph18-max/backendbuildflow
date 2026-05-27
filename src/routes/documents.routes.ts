import path from 'path';
import fs from 'fs';
import { Router, Response } from 'express';
import multer from 'multer';
import prisma from '../prisma';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authMiddleware);

// ── Multer : stockage local dans <racine>/uploads/ ──────────────────────────
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext    = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 Mo max
});

// GET /api/documents
router.get('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { tenant_id: req.user!.tenant_id };
  if (req.query['chantier'])  where['id_chantier'] = Number(req.query['chantier']);
  if (req.query['categorie']) where['categorie']   = req.query['categorie'];

  const documents = await prisma.document.findMany({
    where,
    include: { chantier: { select: { nom_chantier: true } } },
    orderBy: { date_upload: 'desc' },
  });
  res.json(documents);
}));

// POST /api/documents/upload  — multipart/form-data avec fichier réel
router.post('/upload',
  requireRole('admin', 'conducteur', 'chef_chantier'),
  upload.single('fichier'),
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) { res.status(400).json({ message: 'Fichier manquant' }); return; }

    const { id_chantier, categorie } = req.body;
    if (!id_chantier) { res.status(400).json({ message: 'Chantier requis' }); return; }

    const baseUrl    = `${req.protocol}://${req.get('host')}`;
    const url_fichier = `${baseUrl}/uploads/${file.filename}`;
    const ext         = path.extname(file.originalname).replace('.', '').toLowerCase();

    const document = await prisma.document.create({
      data: {
        tenant_id:   req.user!.tenant_id,
        id_chantier: Number(id_chantier),
        nom_fichier: file.originalname,
        extension:   ext || 'bin',
        categorie:   categorie || 'divers',
        taille_ko:   Math.round(file.size / 1024),
        url_fichier,
        ajoute_par:  req.user!.email,
      },
      include: { chantier: { select: { nom_chantier: true } } },
    });
    res.status(201).json(document);
  })
);

// POST /api/documents  — JSON (métadonnées seules, sans fichier binaire)
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
      ajoute_par:  req.user!.email,
    },
    include: { chantier: { select: { nom_chantier: true } } },
  });
  res.status(201).json(document);
}));

// DELETE /api/documents/:id
router.delete('/:id', requireRole('admin', 'conducteur'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const doc = await prisma.document.findFirst({
    where: { id: Number(req.params['id']), tenant_id: req.user!.tenant_id },
  });
  if (!doc) { res.status(404).json({ message: 'Document introuvable' }); return; }

  // Supprimer le fichier physique si stocké localement
  if (doc.url_fichier?.includes('/uploads/')) {
    const filename = doc.url_fichier.split('/uploads/').pop();
    if (filename) {
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }

  await prisma.document.delete({ where: { id: doc.id } });
  res.json({ message: 'Document supprimé' });
}));

export default router;
