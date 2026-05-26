// seed-clients-contrats.js — données réalistes pour les modules clients & contrats
// Usage: node seed-clients-contrats.js (depuis buildflow-api/)

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const DEMO_TENANT = '7fe16c9e-ee67-429a-aef1-53e9a8558ff8';
const USER_TENANT = 'ed780289-1200-4d9d-ad13-2f9f9c1a3ac1';
const d = (s) => new Date(s);

// ─── DEMO TENANT ────────────────────────────────────────────────────────────
async function enrichirClientsContratsDemo() {
  console.log('\n📦 Enrichissement clients & contrats — tenant démo…');
  const tid = DEMO_TENANT;

  // 3 nouveaux clients
  const c3 = await p.client.create({
    data: {
      tenant_id: tid,
      raison_sociale: 'GROUPE IMMOBILIER IVOIRE',
      type_client: 'societe',
      telephone: '+225 27 20 31 60 00',
      email: 'projets@gi-ivoire.ci',
      adresse: 'Plateau, Rue du Commerce, Abidjan',
    },
  });

  const c4 = await p.client.create({
    data: {
      tenant_id: tid,
      nom: 'COULIBALY',
      prenom: 'Ibrahim',
      type_client: 'particulier',
      telephone: '+225 07 05 88 31 22',
      email: 'i.coulibaly@hotmail.fr',
      adresse: 'Riviera Palmeraie, Abidjan',
    },
  });

  const c5 = await p.client.create({
    data: {
      tenant_id: tid,
      raison_sociale: 'DIOCESE DE KORHOGO',
      type_client: 'societe',
      telephone: '+225 36 86 00 14',
      email: 'direction@diocese-korhogo.ci',
      adresse: 'Korhogo, Côte d\'Ivoire',
    },
  });

  console.log('  ✅ 3 clients ajoutés (tenant démo)');

  // Avenant sur contrat 1 (MRH-2025-001 — villa Kouassi)
  await p.modification.create({
    data: {
      tenant_id: tid, id_contrat: 1,
      numero_modification: 1,
      motif: 'Extension terrasse et ajout d\'une dépendance gardiennage non prévus au marché initial',
      montant_supplementaire: 7_500_000,
      delai_supplementaire: 21,
      statut: 'signe',
    },
  });
  await p.contrat.update({ where: { id: 1 }, data: { montant_marche_revise: 92_500_000 } });

  // Avenant sur contrat 3 (MRC-2026-002 — résidence Raphael)
  await p.modification.create({
    data: {
      tenant_id: tid, id_contrat: 3,
      numero_modification: 1,
      motif: 'Variante architecturale — changement facade et ajout ascenseur panoramique',
      montant_supplementaire: 120_000_000,
      delai_supplementaire: 45,
      statut: 'signe',
    },
  });
  await p.contrat.update({ where: { id: 3 }, data: { montant_marche_revise: 6_120_000_000 } });

  console.log('  ✅ 2 avenants signés sur contrats existants');

  // Nouveau contrat terminé (historique) — client Kouassi
  const contratTermine = await p.contrat.create({
    data: {
      tenant_id: tid,
      id_client: 1,
      numero_marche: 'MRH-2023-001',
      type_construction: 'Réhabilitation maison existante',
      montant_marche: 28_000_000,
      montant_marche_revise: 30_500_000,
      date_signature: d('2023-04-01'),
      date_demarrage_prevue: d('2023-05-01'),
      date_livraison_prevue: d('2023-10-31'),
      penalites_retard: 20_000,
      statut: 'termine',
    },
  });

  // Contrat pour Groupe Immobilier Ivoire — en attente (grand projet)
  await p.contrat.create({
    data: {
      tenant_id: tid,
      id_client: c3.id,
      numero_marche: 'MCH-2026-GII-001',
      type_construction: 'Résidence sécurisée R+8 — 64 logements',
      montant_marche: 3_200_000_000,
      date_signature: d('2026-05-20'),
      date_demarrage_prevue: d('2026-08-01'),
      date_livraison_prevue: d('2028-12-31'),
      penalites_retard: 2_000_000,
      statut: 'en_cours',
    },
  });

  // Contrat pour Coulibaly Ibrahim — villa premium
  await p.contrat.create({
    data: {
      tenant_id: tid,
      id_client: c4.id,
      numero_marche: 'MRH-2026-001',
      type_construction: 'Villa R+2 avec piscine et court de tennis',
      montant_marche: 450_000_000,
      date_signature: d('2026-04-10'),
      date_demarrage_prevue: d('2026-06-15'),
      date_livraison_prevue: d('2027-09-30'),
      penalites_retard: 300_000,
      statut: 'en_cours',
    },
  });

  // Contrat pour Diocèse de Korhogo — suspendu (financement en attente)
  await p.contrat.create({
    data: {
      tenant_id: tid,
      id_client: c5.id,
      numero_marche: 'MCH-2025-KOR-001',
      type_construction: 'Construction centre polyvalent et logements pastoraux',
      montant_marche: 180_000_000,
      date_signature: d('2025-09-01'),
      date_demarrage_prevue: d('2025-11-01'),
      date_livraison_prevue: d('2026-12-31'),
      penalites_retard: 0,
      statut: 'suspendu',
    },
  });

  console.log('  ✅ 4 nouveaux contrats (terminé, grand projet, villa premium, suspendu)');
}

// ─── USER TENANT ─────────────────────────────────────────────────────────────
async function enrichirClientsContratsUser() {
  console.log('\n🏗️  Enrichissement clients & contrats — buildpro SA…');
  const tid = USER_TENANT;

  // 4 nouveaux clients
  const c6 = await p.client.create({
    data: {
      tenant_id: tid,
      raison_sociale: 'HOUSING FUND CI',
      type_client: 'societe',
      telephone: '+225 27 20 20 88 00',
      email: 'projets@housingfund.ci',
      adresse: 'Zone 4, Boulevard VGE, Abidjan',
    },
  });

  const c7 = await p.client.create({
    data: {
      tenant_id: tid,
      nom: 'OUATTARA',
      prenom: 'Daouda',
      type_client: 'particulier',
      telephone: '+225 07 07 18 62 44',
      email: 'd.ouattara@yahoo.fr',
      adresse: 'Yopougon Wassakara, Abidjan',
    },
  });

  const c8 = await p.client.create({
    data: {
      tenant_id: tid,
      raison_sociale: 'MAIRIE DE BOUAKE',
      type_client: 'societe',
      telephone: '+225 36 63 11 00',
      email: 'dgt@mairie-bouake.ci',
      adresse: 'Bouaké, Vallée du Bandama, Côte d\'Ivoire',
    },
  });

  const c9 = await p.client.create({
    data: {
      tenant_id: tid,
      nom: 'BAMBA',
      prenom: 'Aminata',
      type_client: 'particulier',
      telephone: '+225 05 24 30 17 88',
      email: 'aminata.bamba@gmail.com',
      adresse: 'Angré 8e Tranche, Abidjan',
    },
  });

  console.log('  ✅ 4 nouveaux clients');

  // Avenants sur contrats existants
  // Contrat 5 — Immeuble Les Cocotiers (2 avenants)
  await p.modification.createMany({
    data: [
      {
        tenant_id: tid, id_contrat: 5,
        numero_modification: 1,
        motif: 'Passage dalles plancher de nervuré à dalle pleine sur demande bureau d\'étude',
        montant_supplementaire: 35_000_000,
        delai_supplementaire: 30,
        statut: 'signe',
      },
      {
        tenant_id: tid, id_contrat: 5,
        numero_modification: 2,
        motif: 'Ajout local groupes électrogènes et local gardiennage en sous-sol',
        montant_supplementaire: 22_000_000,
        delai_supplementaire: 15,
        statut: 'en_attente',
      },
    ],
  });
  await p.contrat.update({ where: { id: 5 }, data: { montant_marche_revise: 885_000_000 } });

  // Contrat 6 — Villa Duplex (avenant 2 supplémentaire)
  await p.modification.create({
    data: {
      tenant_id: tid, id_contrat: 6,
      numero_modification: 2,
      motif: 'Remplacement carrelage standard par marbre importé sur demande client',
      montant_supplementaire: 4_500_000,
      delai_supplementaire: 10,
      statut: 'refuse',
    },
  });

  console.log('  ✅ 3 avenants (2 pour immeuble, 1 refusé villa)');

  // Contrat pour Housing Fund — grand projet immobilier
  await p.contrat.create({
    data: {
      tenant_id: tid,
      id_client: c6.id,
      numero_marche: 'MCH-2026-HFC-001',
      type_construction: 'Programme 200 logements sociaux R+4',
      montant_marche: 8_500_000_000,
      date_signature: d('2026-05-15'),
      date_demarrage_prevue: d('2026-10-01'),
      date_livraison_prevue: d('2029-03-31'),
      penalites_retard: 5_000_000,
      statut: 'en_cours',
    },
  });

  // Contrat pour Ouattara Daouda — petite villa en cours
  await p.contrat.create({
    data: {
      tenant_id: tid,
      id_client: c7.id,
      numero_marche: 'MCH-2026-001',
      type_construction: 'Villa F5 plain-pied avec terrasse couverte',
      montant_marche: 65_000_000,
      date_signature: d('2026-03-01'),
      date_demarrage_prevue: d('2026-04-15'),
      date_livraison_prevue: d('2026-12-31'),
      penalites_retard: 50_000,
      statut: 'en_cours',
    },
  });

  // Contrat pour Mairie de Bouaké — marché public (résilié — contentieux)
  const contratResilie = await p.contrat.create({
    data: {
      tenant_id: tid,
      id_client: c8.id,
      numero_marche: 'MPC-2025-BKE-007',
      type_construction: 'Réhabilitation Hôtel de Ville de Bouaké',
      montant_marche: 320_000_000,
      date_signature: d('2025-02-20'),
      date_demarrage_prevue: d('2025-04-01'),
      date_livraison_prevue: d('2026-03-31'),
      penalites_retard: 500_000,
      statut: 'resilie',
    },
  });

  // Avenant refusé avant résiliation
  await p.modification.create({
    data: {
      tenant_id: tid, id_contrat: contratResilie.id,
      numero_modification: 1,
      motif: 'Révision prix suite hausse matériaux — demande entreprise rejetée par la mairie',
      montant_supplementaire: 48_000_000,
      delai_supplementaire: 0,
      statut: 'refuse',
    },
  });

  // Contrat pour Bamba Aminata — terminé (historique)
  const contratTermine2 = await p.contrat.create({
    data: {
      tenant_id: tid,
      id_client: c9.id,
      numero_marche: 'MCH-2024-001',
      type_construction: 'Villa R+1 clé en main',
      montant_marche: 95_000_000,
      montant_marche_revise: 98_500_000,
      date_signature: d('2024-03-01'),
      date_demarrage_prevue: d('2024-04-01'),
      date_livraison_prevue: d('2025-02-28'),
      penalites_retard: 80_000,
      statut: 'termine',
    },
  });

  await p.modification.create({
    data: {
      tenant_id: tid, id_contrat: contratTermine2.id,
      numero_modification: 1,
      motif: 'Ajout garde-corps et claustra sur balcons — demande client',
      montant_supplementaire: 3_500_000,
      delai_supplementaire: 7,
      statut: 'signe',
    },
  });

  console.log('  ✅ 4 nouveaux contrats (grand projet, villa en cours, résilié + avenant refusé, terminé)');
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seed clients & contrats\n');
  await enrichirClientsContratsDemo();
  await enrichirClientsContratsUser();

  // Résumé final
  const [demoClients, demoContrats, userClients, userContrats, demoAv, userAv] = await Promise.all([
    p.client.count({ where: { tenant_id: DEMO_TENANT } }),
    p.contrat.count({ where: { tenant_id: DEMO_TENANT } }),
    p.client.count({ where: { tenant_id: USER_TENANT } }),
    p.contrat.count({ where: { tenant_id: USER_TENANT } }),
    p.modification.count({ where: { tenant_id: DEMO_TENANT } }),
    p.modification.count({ where: { tenant_id: USER_TENANT } }),
  ]);

  console.log('\n📊 Récapitulatif base de données :');
  console.log(`   Tenant démo    — ${demoClients} clients | ${demoContrats} contrats | ${demoAv} avenants`);
  console.log(`   Tenant user    — ${userClients} clients | ${userContrats} contrats | ${userAv} avenants`);
  console.log('\n🎉 Seed terminé !');
}

main()
  .catch(e => { console.error('\n❌ Erreur :', e.message); process.exit(1); })
  .finally(() => p.$disconnect());
