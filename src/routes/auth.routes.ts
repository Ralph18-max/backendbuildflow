import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// POST /api/auth/login
router.post('/login', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, mot_de_passe } = req.body;

  if (!email || !mot_de_passe) {
    res.status(400).json({ message: 'Email et mot de passe requis' });
    return;
  }

  const utilisateur = await prisma.utilisateur.findFirst({
    where: { email, actif: true },
    include: { entreprise: true },
  });

  if (!utilisateur || !await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe_hash)) {
    res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    return;
  }

  const token = jwt.sign(
    {
      id:        utilisateur.id,
      email:     utilisateur.email,
      role:      utilisateur.role,
      tenant_id: utilisateur.tenant_id,
    },
    process.env['JWT_SECRET']!,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    utilisateur: {
      id:               utilisateur.id,
      nom:              utilisateur.nom,
      prenom:           utilisateur.prenom,
      email:            utilisateur.email,
      role:             utilisateur.role,
      avatar_initiales: `${utilisateur.prenom[0]}${utilisateur.nom[0]}`.toUpperCase(),
      entreprise:       utilisateur.entreprise.nom_entreprise,
    },
  });
}));

// POST /api/auth/register
router.post('/register', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { prenom, nom, nom_societe, email, mot_de_passe } = req.body;

  // Validation
  if (!prenom || !nom || !nom_societe || !email || !mot_de_passe) {
    res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
    return;
  }

  if (mot_de_passe.length < 8) {
    res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères.' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ message: 'Adresse email invalide.' });
    return;
  }

  // Vérifier que l'email n'est pas déjà utilisé (toutes entreprises confondues)
  const emailExistant = await prisma.utilisateur.findFirst({ where: { email } });
  if (emailExistant) {
    res.status(409).json({ message: 'Cette adresse email est déjà associée à un compte.' });
    return;
  }

  // Créer l'entreprise (nouveau tenant)
  const entreprise = await prisma.entreprise.create({
    data: {
      nom_entreprise:  nom_societe.trim(),
      plan_abonnement: 'starter',
      statut:          'actif',
    },
  });

  // Créer l'utilisateur admin
  const mot_de_passe_hash = await bcrypt.hash(mot_de_passe, 10);

  const utilisateur = await prisma.utilisateur.create({
    data: {
      tenant_id:        entreprise.tenant_id,
      prenom:           prenom.trim(),
      nom:              nom.trim().toUpperCase(),
      email:            email.toLowerCase().trim(),
      mot_de_passe_hash,
      role:             'admin',
      actif:            true,
    },
  });

  // Émettre un token pour connexion automatique
  const token = jwt.sign(
    {
      id:        utilisateur.id,
      email:     utilisateur.email,
      role:      utilisateur.role,
      tenant_id: utilisateur.tenant_id,
    },
    process.env['JWT_SECRET']!,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    token,
    utilisateur: {
      id:               utilisateur.id,
      nom:              utilisateur.nom,
      prenom:           utilisateur.prenom,
      email:            utilisateur.email,
      role:             utilisateur.role,
      avatar_initiales: `${utilisateur.prenom[0]}${utilisateur.nom[0]}`.toUpperCase(),
      entreprise:       entreprise.nom_entreprise,
    },
  });
}));

// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body;

  if (!ancien_mot_de_passe || !nouveau_mot_de_passe) {
    res.status(400).json({ message: 'Champs requis manquants' });
    return;
  }
  if (nouveau_mot_de_passe.length < 8) {
    res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
    return;
  }

  const utilisateur = await prisma.utilisateur.findUnique({ where: { id: req.user!.id } });
  if (!utilisateur || !await bcrypt.compare(ancien_mot_de_passe, utilisateur.mot_de_passe_hash)) {
    res.status(401).json({ message: 'Mot de passe actuel incorrect' });
    return;
  }

  await prisma.utilisateur.update({
    where: { id: req.user!.id },
    data: { mot_de_passe_hash: await bcrypt.hash(nouveau_mot_de_passe, 10) },
  });

  res.json({ message: 'Mot de passe modifié avec succès' });
}));

export default router;
