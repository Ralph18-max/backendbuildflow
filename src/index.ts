import 'dotenv/config';
import app from './app';
import prisma from './prisma';

const PORT = Number(process.env['PORT']) || 3000;

async function main() {
  await prisma.$connect();
  console.log('✅ Connecté à PostgreSQL');

  app.listen(PORT, () => {
    console.log(`🚀 BuildFlow API démarrée sur http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('❌ Erreur au démarrage :', err);
  process.exit(1);
});
