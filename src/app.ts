import path from 'path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

import authRoutes         from './routes/auth.routes';
import utilisateurRoutes  from './routes/utilisateurs.routes';
import clientRoutes       from './routes/clients.routes';
import contratRoutes      from './routes/contrats.routes';
import chantierRoutes     from './routes/chantiers.routes';
import terrainRoutes      from './routes/terrain.routes';
import facturationRoutes  from './routes/facturation.routes';
import comptabiliteRoutes from './routes/comptabilite.routes';
import documentRoutes     from './routes/documents.routes';

const app = express();

// crossOriginResourcePolicy désactivé : le frontend (autre origine Vercel) doit pouvoir
// charger les fichiers servis depuis /uploads (documents, photos, etc.)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const ALLOWED_ORIGINS = new Set([
  process.env['FRONTEND_URL'],
  'https://buildflow-prod.vercel.app',
  'https://buildflow.vercel.app',
].filter(Boolean));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) { callback(null, true); return; }
    if (ALLOWED_ORIGINS.has(origin)) { callback(null, true); return; }
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) { callback(null, true); return; }
    if (/\.vercel\.app$/.test(origin)) { callback(null, true); return; }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Limite les tentatives de connexion/inscription pour freiner le brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Trop de tentatives, réessayez dans quelques minutes.' },
});
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/api/auth',          authRoutes);
app.use('/api/utilisateurs',  utilisateurRoutes);
app.use('/api/clients',       clientRoutes);
app.use('/api/contrats',      contratRoutes);
app.use('/api/chantiers',     chantierRoutes);
app.use('/api/terrain',       terrainRoutes);
app.use('/api/facturation',   facturationRoutes);
app.use('/api/comptabilite',  comptabiliteRoutes);
app.use('/api/documents',     documentRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Route introuvable' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[BuildFlow Error]', err.stack);
  res.status(500).json({
    message: 'Erreur serveur interne',
    ...(process.env['NODE_ENV'] === 'development' && { detail: err.message }),
  });
});

export default app;
