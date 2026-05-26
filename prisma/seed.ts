import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed en cours...');

  // Entreprise (tenant)
  const entreprise = await prisma.entreprise.create({
    data: {
      nom_entreprise: 'BTP Constructions Abidjan',
      plan_abonnement: 'pro',
      nb_utilisateurs_max: 20,
    },
  });
  const tid = entreprise.tenant_id;
  console.log(`✅ Entreprise créée — tenant_id: ${tid}`);

  // Utilisateurs
  const hash = await bcrypt.hash('Buildflow2026!', 10);
  await prisma.utilisateur.createMany({
    data: [
      { tenant_id: tid, nom: 'Konan', prenom: 'Yves', email: 'admin@btp-abi.ci', mot_de_passe_hash: hash, role: 'admin' },
      { tenant_id: tid, nom: 'Bamba', prenom: 'Moussa', email: 'conducteur@btp-abi.ci', mot_de_passe_hash: hash, role: 'conducteur' },
      { tenant_id: tid, nom: 'Yapi', prenom: 'Serge', email: 'chef@btp-abi.ci', mot_de_passe_hash: hash, role: 'chef_chantier' },
      { tenant_id: tid, nom: 'Diabaté', prenom: 'Fatou', email: 'compta@btp-abi.ci', mot_de_passe_hash: hash, role: 'comptable' },
    ],
  });
  console.log('✅ 4 utilisateurs créés');

  // Client
  const client = await prisma.client.create({
    data: {
      tenant_id: tid,
      nom: 'Kouassi', prenom: 'Edmond',
      type_client: 'particulier',
      telephone: '+225 07 00 00 01',
      email: 'edmond@gmail.com',
      adresse: 'Cocody, Abidjan',
    },
  });

  // Contrat
  const contrat = await prisma.contrat.create({
    data: {
      tenant_id: tid,
      id_client: client.id,
      numero_marche: 'MRH-2025-001',
      type_construction: 'Villa R+1',
      montant_marche: 85_000_000,
      date_signature: new Date('2025-01-15'),
      date_demarrage_prevue: new Date('2025-02-01'),
      date_livraison_prevue: new Date('2025-12-31'),
      penalites_retard: 50_000,
    },
  });

  // Chantier
  const chantier = await prisma.chantier.create({
    data: {
      tenant_id: tid,
      id_contrat: contrat.id,
      nom_chantier: 'Résidence Les Palmiers',
      localisation: 'Cocody, Abidjan',
      description: 'Construction villa R+1 avec piscine',
      date_livraison_prevue: new Date('2025-12-31'),
      date_demarrage_reelle: new Date('2025-02-03'),
      chef_chantier: 'Yapi Serge',
      avancement_global: 62,
    },
  });

  // Budget S0
  await prisma.budget.create({
    data: {
      tenant_id: tid,
      id_chantier: chantier.id,
      debourse_sec_estime: 60_000_000,
      frais_generaux: 8_000_000,
      marge_prevue: 12_000_000,
      provision_aleas: 5_000_000,
      montant_total_S0: 85_000_000,
      cout_reel_a_date: 54_000_000,
      reste_a_depenser: 31_000_000,
      ecart_budget: 6_000_000,
    },
  });

  // Corps d'état
  await prisma.corpsEtat.createMany({
    data: [
      { tenant_id: tid, id_chantier: chantier.id, nom: 'Terrassement',  avancement: 100, part_chantier: 8,  ordre_execution: 1, budget_alloue: 4_000_000, cout_reel: 3_800_000, statut: 'termine' },
      { tenant_id: tid, id_chantier: chantier.id, nom: 'Fondations',    avancement: 100, part_chantier: 15, ordre_execution: 2, budget_alloue: 12_000_000, cout_reel: 11_500_000, statut: 'termine' },
      { tenant_id: tid, id_chantier: chantier.id, nom: 'Maçonnerie',    avancement: 75,  part_chantier: 25, ordre_execution: 3, budget_alloue: 20_000_000, cout_reel: 15_000_000, statut: 'en_cours' },
      { tenant_id: tid, id_chantier: chantier.id, nom: 'Plomberie',     avancement: 40,  part_chantier: 15, ordre_execution: 4, budget_alloue: 8_000_000, cout_reel: 3_500_000, statut: 'en_cours' },
      { tenant_id: tid, id_chantier: chantier.id, nom: 'Électricité',   avancement: 30,  part_chantier: 12, ordre_execution: 5, budget_alloue: 7_000_000, cout_reel: 2_200_000, statut: 'en_cours' },
      { tenant_id: tid, id_chantier: chantier.id, nom: 'Menuiserie',    avancement: 0,   part_chantier: 10, ordre_execution: 6, budget_alloue: 5_000_000, cout_reel: 0, statut: 'en_cours' },
      { tenant_id: tid, id_chantier: chantier.id, nom: 'Revêtements',   avancement: 0,   part_chantier: 10, ordre_execution: 7, budget_alloue: 4_000_000, cout_reel: 0, statut: 'en_cours' },
      { tenant_id: tid, id_chantier: chantier.id, nom: 'Peinture',      avancement: 0,   part_chantier: 5,  ordre_execution: 8, budget_alloue: 3_000_000, cout_reel: 0, statut: 'en_cours' },
    ],
  });

  // Situation de travaux
  const situation = await prisma.situation.create({
    data: {
      tenant_id: tid,
      id_chantier: chantier.id,
      numero_situation: 1,
      montant_ht: 30_000_000,
      taux_tva: 18,
      montant_ttc: 35_400_000,
      montant_encaisse: 35_400_000,
      reste_a_facturer: 0,
      avancement_facture: 42,
      statut: 'payee',
    },
  });

  await prisma.paiement.create({
    data: {
      tenant_id: tid,
      id_situation: situation.id,
      montant: 35_400_000,
      date_paiement: new Date('2025-05-10'),
      reference: 'VIR-2025-0501',
      mode_paiement: 'virement',
    },
  });

  console.log('✅ Chantier, budget, corps d\'état, situation créés');
  console.log('\n🎉 Seed terminé !');
  console.log('\n📋 Comptes de test :');
  console.log('   admin@btp-abi.ci      → mot de passe: Buildflow2026!  (Admin)');
  console.log('   conducteur@btp-abi.ci → mot de passe: Buildflow2026!  (Conducteur)');
  console.log('   chef@btp-abi.ci       → mot de passe: Buildflow2026!  (Chef chantier)');
  console.log('   compta@btp-abi.ci     → mot de passe: Buildflow2026!  (Comptable)');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
