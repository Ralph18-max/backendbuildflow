import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { envoyerCredentiels } from '../services/email.service';

const router = Router();
router.use(authMiddleware);

// GET /api/utilisateurs
router.get('/', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const utilisateurs = await prisma.utilisateur.findMany({
    where: { tenant_id: req.user!.tenant_id },
    select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true },
    orderBy: { nom: 'asc' },
  });
  res.json(utilisateurs);
}));

// POST /api/utilisateurs — Admin uniquement
router.post('/', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { nom, prenom, email, role } = req.body;
  if (!nom || !prenom || !email || !role) {
    res.status(400).json({ message: 'Champs requis manquants' });
    return;
  }

  const existe = await prisma.utilisateur.findFirst({
    where: { email, tenant_id: req.user!.tenant_id },
  });
  if (existe) {
    res.status(409).json({ message: 'Un utilisateur avec cet email existe déjà' });
    return;
  }

  const defaultPassword = process.env['DEFAULT_PASSWORD'] || 'Buildflow2026!';
  const mot_de_passe_hash = await bcrypt.hash(defaultPassword, 10);

  const entreprise = await prisma.entreprise.findUnique({
    where: { tenant_id: req.user!.tenant_id },
    select: { nom_entreprise: true },
  });

  const nouveau = await prisma.utilisateur.create({
    data: { nom, prenom, email, role, mot_de_passe_hash, tenant_id: req.user!.tenant_id },
    select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true },
  });

  // Envoi email en arrière-plan — ne bloque pas la réponse
  envoyerCredentiels({
    prenom,
    nom,
    email,
    role,
    societe:  entreprise?.nom_entreprise ?? 'votre entreprise',
    password: defaultPassword,
  }).then(() => console.log(`[Email] ✓ Identifiants envoyés à ${email}`))
    .catch(err => console.error('[Email] ✗ Échec envoi identifiants :', err.message));

  res.status(201).json(nouveau);
}));

// PATCH /api/utilisateurs/:id/toggle — activer/désactiver
router.patch('/:id/toggle', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params['id']);
  const utilisateur = await prisma.utilisateur.findFirst({
    where: { id, tenant_id: req.user!.tenant_id },
  });
  if (!utilisateur) { res.status(404).json({ message: 'Utilisateur introuvable' }); return; }

  const updated = await prisma.utilisateur.update({
    where: { id },
    data: { actif: !utilisateur.actif },
    select: { id: true, actif: true },
  });
  res.json(updated);
}));

// PUT /api/utilisateurs/:id — modifier
router.put('/:id', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params['id']);
  const { nom, prenom, email, role } = req.body;

  const updated = await prisma.utilisateur.update({
    where: { id },
    data: { nom, prenom, email, role },
    select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true },
  });
  res.json(updated);
}));

// DELETE /api/utilisateurs/:id — supprimer (admin only, ne peut pas se supprimer lui-même)
router.delete('/:id', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params['id']);
  if (id === req.user!.id) {
    res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
    return;
  }
  const utilisateur = await prisma.utilisateur.findFirst({
    where: { id, tenant_id: req.user!.tenant_id },
  });
  if (!utilisateur) { res.status(404).json({ message: 'Utilisateur introuvable' }); return; }

  await prisma.utilisateur.delete({ where: { id } });
  res.status(204).send();
}));

export default router;
