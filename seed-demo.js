// seed-demo.js — données réalistes pour les modules chantier et planning
// Usage: node seed-demo.js (depuis buildflow-api/)

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// ─── Tenants à alimenter ────────────────────────────────────────────────────
const DEMO_TENANT  = '7fe16c9e-ee67-429a-aef1-53e9a8558ff8'; // BTP Constructions Abidjan (comptes démo)
const USER_TENANT  = 'ed780289-1200-4d9d-ad13-2f9f9c1a3ac1'; // buildpro SA (kouamejeantrinite@gmail.com)

// ─── Helpers ────────────────────────────────────────────────────────────────
const d = (s) => new Date(s);

async function addPlanningToChantier(tid, chantierId, debut, fin, jalons) {
  const pl = await p.planning.create({
    data: {
      tenant_id: tid,
      id_chantier: chantierId,
      date_debut_prevue: d(debut),
      date_fin_prevue: d(fin),
      statut: 'actif',
    },
  });
  for (const j of jalons) {
    await p.jalon.create({
      data: {
        tenant_id: tid,
        id_planning: pl.id,
        nom_jalon: j.nom,
        date_prevue: d(j.prevue),
        date_reelle: j.reelle ? d(j.reelle) : null,
        statut: j.statut,
        ecart_jours: j.ecart || 0,
      },
    });
  }
  return pl;
}

// ─── 1. Enrichir le tenant DEMO ─────────────────────────────────────────────
async function enrichirTenantDemo() {
  console.log('\n📦 Enrichissement du tenant démo…');

  // 1a. Planning + jalons pour chantier 1 (Résidence Les Palmiers)
  const existingPl = await p.planning.findUnique({ where: { id_chantier: 1 } });
  if (!existingPl) {
    await addPlanningToChantier(DEMO_TENANT, 1, '2025-02-03', '2025-12-31', [
      { nom: 'Installation de chantier',   prevue: '2025-02-10', reelle: '2025-02-10', statut: 'atteint',   ecart: 0  },
      { nom: 'Fin terrassement',            prevue: '2025-03-15', reelle: '2025-03-18', statut: 'manque',    ecart: 3  },
      { nom: 'Fin fondations',              prevue: '2025-05-01', reelle: '2025-05-05', statut: 'manque',    ecart: 4  },
      { nom: 'Fin maconnerie RDC',          prevue: '2025-07-15', reelle: null,          statut: 'en_attente', ecart: 0 },
      { nom: 'Mise hors eau',               prevue: '2025-09-01', reelle: null,          statut: 'en_attente', ecart: 0 },
      { nom: 'Livraison provisoire',        prevue: '2025-12-31', reelle: null,          statut: 'en_attente', ecart: 0 },
    ]);
    console.log('  ✅ Planning chantier 1 — 6 jalons');
  }

  // 1b. Intervenants pour chantier 1 (lier aux corps d'état existants)
  const corps = await p.corpsEtat.findMany({ where: { id_chantier: 1 } });
  const corpsByNom = {};
  corps.forEach(c => { corpsByNom[c.nom] = c.id; });

  const existingInterv = await p.intervenant.findMany({ where: { id_chantier: 1 } });
  if (existingInterv.length === 0 && corps.length > 0) {
    const intervenantData = [
      {
        nom: 'SODACI BTP',
        raison_sociale: 'SODACI Travaux Publics SARL',
        type_intervenant: 'entreprise',
        telephone: '+225 27 20 30 10 15',
        email: 'contact@sodaci-btp.ci',
        id_corps_etat: corps[0]?.id || corps[0]?.id,
        montant_contrat: 16_000_000,
        assurance: true,
        numero_agrement: 'AGR-2024-0081',
        date_expiration_agrement: d('2026-12-31'),
      },
      {
        nom: 'ELEC PRO ABIDJAN',
        type_intervenant: 'entreprise',
        telephone: '+225 27 22 41 55 12',
        email: 'elecpro@gmail.com',
        id_corps_etat: corps[4]?.id || corps[0]?.id,
        montant_contrat: 7_000_000,
        assurance: true,
        numero_agrement: 'AGR-2024-0142',
        date_expiration_agrement: d('2025-12-31'),
      },
      {
        nom: 'PLOMBERIE MODERNE CI',
        type_intervenant: 'entreprise',
        telephone: '+225 07 03 22 48 90',
        email: 'plomberieci@outlook.com',
        id_corps_etat: corps[3]?.id || corps[0]?.id,
        montant_contrat: 8_000_000,
        assurance: false,
      },
    ];

    for (const iv of intervenantData) {
      await p.intervenant.create({
        data: { tenant_id: DEMO_TENANT, id_chantier: 1, ...iv },
      });
    }
    console.log('  ✅ 3 intervenants chantier 1');
  }

  // 1c. Rapports terrain pour chantier 1
  const existingRapports = await p.rapportTerrain.findMany({ where: { id_chantier: 1 } });
  if (existingRapports.length === 0) {
    const rapportsData = [
      { date: '2026-05-19', effectif: 18, meteo: 'ensoleille', observations: 'Avancement maconnerie R+1 conforme. Pose des agglos niveau 2 en cours.', a_incident: false, redacteur: 'Yapi Serge' },
      { date: '2026-05-20', effectif: 20, meteo: 'nuageux',    observations: 'Livraison ciment 200 sacs. Debut installation coffrage escalier.', a_incident: false, redacteur: 'Yapi Serge' },
      { date: '2026-05-21', effectif: 15, meteo: 'pluvieux',   observations: 'Arret travaux 2h suite pluie. Chantier reprend apres drainage.', incidents: 'Glissade d un ouvrier — soins de premier secours administres.', a_incident: true, redacteur: 'Yapi Serge' },
      { date: '2026-05-22', effectif: 19, meteo: 'ensoleille', observations: 'Coulage plancher haut RDC. Beton 300kg/m3. Inspection chef de projet OK.', a_incident: false, redacteur: 'Yapi Serge' },
      { date: '2026-05-23', effectif: 22, meteo: 'ensoleille', observations: 'Debut implantation cloisons R+1. Plombier commence passage fourreaux.', a_incident: false, redacteur: 'Yapi Serge' },
    ];

    for (const r of rapportsData) {
      await p.rapportTerrain.create({
        data: {
          tenant_id: DEMO_TENANT,
          id_chantier: 1,
          date_rapport: d(r.date),
          redacteur: r.redacteur,
          effectif_present: r.effectif,
          meteo: r.meteo,
          observations: r.observations,
          incidents: r.incidents || null,
          a_incident: r.a_incident,
        },
      });
    }
    console.log('  ✅ 5 rapports terrain chantier 1');
  }

  // 1d. Situation 2 pour chantier 1
  const existingSits = await p.situation.findMany({ where: { id_chantier: 1 } });
  if (existingSits.length < 2) {
    const sit2 = await p.situation.create({
      data: {
        tenant_id: DEMO_TENANT,
        id_chantier: 1,
        numero_situation: 2,
        montant_ht: 25_000_000,
        taux_tva: 18,
        montant_ttc: 29_500_000,
        retenue_garantie: 1_475_000,
        montant_net: 28_025_000,
        montant_encaisse: 0,
        reste_a_facturer: 28_025_000,
        avancement_facture: 72,
        statut: 'en_retard',
        date_emission: d('2026-04-15'),
        date_echeance: d('2026-05-15'),
      },
    });
    console.log('  ✅ Situation 2 chantier 1 (en retard)');
  }

  // 1e. FactureST chantier 1
  const existingFST = await p.factureST.findMany({ where: { id_chantier: 1 } });
  if (existingFST.length === 0) {
    await p.factureST.createMany({
      data: [
        {
          tenant_id: DEMO_TENANT, id_chantier: 1,
          numero: 'FST-2026-001', intervenant: 'SODACI BTP', corps_etat: 'Maconnerie',
          date_facture: d('2026-04-30'), montant_ht: 8_000_000, taux_tva: 18,
          montant_tva: 1_440_000, montant_ttc: 9_440_000, statut: 'validee',
        },
        {
          tenant_id: DEMO_TENANT, id_chantier: 1,
          numero: 'FST-2026-002', intervenant: 'ELEC PRO ABIDJAN', corps_etat: 'Electricite',
          date_facture: d('2026-05-10'), montant_ht: 2_200_000, taux_tva: 18,
          montant_tva: 396_000, montant_ttc: 2_596_000, statut: 'en_attente',
        },
      ],
    });
    console.log('  ✅ 2 factures ST chantier 1');
  }
}

// ─── 2. Alimenter le tenant USER (buildpro SA) ──────────────────────────────
async function alimenterTenantUser() {
  console.log('\n🏗️  Alimentation du tenant buildpro SA…');

  const tid = USER_TENANT;

  // Clients
  const client1 = await p.client.create({
    data: {
      tenant_id: tid,
      raison_sociale: 'SECOGENIE SA',
      type_client: 'societe',
      telephone: '+225 27 20 25 60 00',
      email: 'direction@secogenie.ci',
      adresse: 'Plateau, Avenue Chardy, Abidjan',
    },
  });

  const client2 = await p.client.create({
    data: {
      tenant_id: tid,
      nom: 'DIALLO',
      prenom: 'Mamadou',
      type_client: 'particulier',
      telephone: '+225 07 08 72 33 14',
      email: 'mamadou.diallo@gmail.com',
      adresse: 'Cocody 2 Plateaux, Abidjan',
    },
  });
  console.log('  ✅ 2 clients');

  // Contrats
  const contrat1 = await p.contrat.create({
    data: {
      tenant_id: tid,
      id_client: client1.id,
      numero_marche: 'MCH-2025-001',
      type_construction: 'Immeuble R+5',
      montant_marche: 850_000_000,
      date_signature: d('2025-01-10'),
      date_demarrage_prevue: d('2025-03-01'),
      date_livraison_prevue: d('2026-09-30'),
      penalites_retard: 500_000,
      statut: 'en_cours',
    },
  });

  const contrat2 = await p.contrat.create({
    data: {
      tenant_id: tid,
      id_client: client2.id,
      numero_marche: 'MCH-2025-002',
      type_construction: 'Villa R+1 avec piscine',
      montant_marche: 120_000_000,
      montant_marche_revise: 128_000_000,
      date_signature: d('2025-06-15'),
      date_demarrage_prevue: d('2025-08-01'),
      date_livraison_prevue: d('2026-06-30'),
      penalites_retard: 100_000,
      statut: 'en_cours',
    },
  });
  console.log('  ✅ 2 contrats');

  // ── CHANTIER 1 : Immeuble R+5 (42% avancement) ──────────────────────────
  const ch1 = await p.chantier.create({
    data: {
      tenant_id: tid,
      id_contrat: contrat1.id,
      nom_chantier: 'Immeuble Les Cocotiers',
      localisation: 'Zone 4, Marcory, Abidjan',
      description: 'Construction immeuble R+5 usage mixte (commerces RDC + appartements)',
      date_livraison_prevue: d('2026-09-30'),
      date_demarrage_reelle: d('2025-03-05'),
      chef_chantier: 'Kouame Jean Trinite',
      avancement_global: 42,
      statut: 'en_cours',
    },
  });

  // Budget S0 chantier 1
  await p.budget.create({
    data: {
      tenant_id: tid,
      id_chantier: ch1.id,
      debourse_sec_estime: 600_000_000,
      frais_generaux:      80_000_000,
      marge_prevue:       120_000_000,
      provision_aleas:     50_000_000,
      montant_total_S0:   850_000_000,
      cout_reel_a_date:   356_000_000,
      reste_a_depenser:   494_000_000,
      ecart_budget:        -6_000_000,
    },
  });

  // Corps d'etat chantier 1
  const corpsEtat1 = await p.corpsEtat.createMany({
    data: [
      { tenant_id: tid, id_chantier: ch1.id, nom: 'Terrassement',    avancement: 100, part_chantier: 5,  ordre_execution: 1, budget_alloue: 30_000_000,  cout_reel: 31_000_000,  statut: 'termine',   date_debut_prevue: d('2025-03-05'), date_fin_prevue: d('2025-04-15') },
      { tenant_id: tid, id_chantier: ch1.id, nom: 'Fondations',      avancement: 100, part_chantier: 12, ordre_execution: 2, budget_alloue: 90_000_000,  cout_reel: 87_000_000,  statut: 'termine',   date_debut_prevue: d('2025-04-16'), date_fin_prevue: d('2025-07-01') },
      { tenant_id: tid, id_chantier: ch1.id, nom: 'Gros oeuvre',     avancement: 60,  part_chantier: 30, ordre_execution: 3, budget_alloue: 200_000_000, cout_reel: 119_000_000, statut: 'en_cours',  date_debut_prevue: d('2025-07-01'), date_fin_prevue: d('2026-05-01') },
      { tenant_id: tid, id_chantier: ch1.id, nom: 'Charpente',       avancement: 0,   part_chantier: 8,  ordre_execution: 4, budget_alloue: 55_000_000,  cout_reel: 0,           statut: 'en_cours',  date_debut_prevue: d('2026-03-01'), date_fin_prevue: d('2026-06-30') },
      { tenant_id: tid, id_chantier: ch1.id, nom: 'Etancheite',      avancement: 0,   part_chantier: 5,  ordre_execution: 5, budget_alloue: 30_000_000,  cout_reel: 0,           statut: 'en_cours',  date_debut_prevue: d('2026-04-01'), date_fin_prevue: d('2026-06-01') },
      { tenant_id: tid, id_chantier: ch1.id, nom: 'Second oeuvre',   avancement: 0,   part_chantier: 25, ordre_execution: 6, budget_alloue: 195_000_000, cout_reel: 0,           statut: 'en_cours',  date_debut_prevue: d('2026-05-01'), date_fin_prevue: d('2026-09-01') },
    ],
  });

  // Recup les IDs corps d'etat chantier 1
  const corps1 = await p.corpsEtat.findMany({ where: { id_chantier: ch1.id }, orderBy: { ordre_execution: 'asc' } });

  // Intervenants chantier 1
  await p.intervenant.createMany({
    data: [
      {
        tenant_id: tid, id_chantier: ch1.id, id_corps_etat: corps1[2].id,
        type_intervenant: 'entreprise', nom: 'TRAVAUX GENERAUX CI',
        raison_sociale: 'TGC Constructions SARL',
        telephone: '+225 27 22 50 40 30', email: 'tgc@tgc-ci.com',
        montant_contrat: 200_000_000, assurance: true,
        numero_agrement: 'AGR-2023-0205',
        date_expiration_agrement: d('2027-03-31'),
        actif: true,
      },
      {
        tenant_id: tid, id_chantier: ch1.id, id_corps_etat: corps1[0].id,
        type_intervenant: 'entreprise', nom: 'TERRABAT',
        telephone: '+225 07 05 11 22 44', email: 'terrabat@gmail.com',
        montant_contrat: 30_000_000, assurance: true,
        numero_agrement: 'AGR-2024-0099',
        date_expiration_agrement: d('2026-06-30'),
        actif: true,
      },
      {
        tenant_id: tid, id_chantier: ch1.id, id_corps_etat: corps1[5].id,
        type_intervenant: 'entreprise', nom: 'MULTI TECH FINISHING',
        telephone: '+225 01 42 88 77 56', email: 'mtf@multitech.ci',
        montant_contrat: 130_000_000, assurance: false,
        actif: true,
      },
    ],
  });

  // Planning chantier 1
  await addPlanningToChantier(tid, ch1.id, '2025-03-05', '2026-09-30', [
    { nom: 'Installation chantier',         prevue: '2025-03-10', reelle: '2025-03-10', statut: 'atteint',    ecart: 0  },
    { nom: 'Fin terrassement',               prevue: '2025-04-15', reelle: '2025-04-18', statut: 'manque',     ecart: 3  },
    { nom: 'Fin fondations',                 prevue: '2025-07-01', reelle: '2025-07-08', statut: 'manque',     ecart: 7  },
    { nom: 'Mise hors eau',                  prevue: '2026-04-01', reelle: null,          statut: 'en_attente', ecart: 0  },
    { nom: 'Fin second oeuvre',              prevue: '2026-07-15', reelle: null,          statut: 'en_attente', ecart: 0  },
    { nom: 'Reception provisoire',           prevue: '2026-09-15', reelle: null,          statut: 'en_attente', ecart: 0  },
    { nom: 'Livraison definitive',           prevue: '2026-09-30', reelle: null,          statut: 'en_attente', ecart: 0  },
  ]);

  // Situations chantier 1
  const sit1_1 = await p.situation.create({
    data: {
      tenant_id: tid, id_chantier: ch1.id,
      numero_situation: 1,
      date_emission: d('2025-08-01'), date_echeance: d('2025-09-01'),
      montant_ht: 150_000_000, taux_tva: 18,
      montant_ttc: 177_000_000,
      retenue_garantie: 8_850_000, montant_net: 168_150_000,
      montant_encaisse: 168_150_000,
      reste_a_facturer: 0,
      avancement_facture: 20,
      statut: 'payee',
    },
  });
  await p.paiement.create({
    data: {
      tenant_id: tid, id_situation: sit1_1.id,
      montant: 168_150_000, date_paiement: d('2025-08-28'),
      reference: 'VIR-2025-0801', mode_paiement: 'virement',
    },
  });

  await p.situation.create({
    data: {
      tenant_id: tid, id_chantier: ch1.id,
      numero_situation: 2,
      date_emission: d('2025-12-01'), date_echeance: d('2026-01-01'),
      montant_ht: 200_000_000, taux_tva: 18,
      montant_ttc: 236_000_000,
      retenue_garantie: 11_800_000, montant_net: 224_200_000,
      montant_encaisse: 224_200_000,
      reste_a_facturer: 0,
      avancement_facture: 42,
      statut: 'payee',
    },
  });

  // Rapports terrain chantier 1
  await p.rapportTerrain.createMany({
    data: [
      { tenant_id: tid, id_chantier: ch1.id, date_rapport: d('2026-05-19'), redacteur: 'Kouame Jean Trinite', effectif_present: 35, meteo: 'ensoleille', observations: 'Coulage poteau RDC niveau 3 OK. Ferraillage niveau 4 en cours.', a_incident: false },
      { tenant_id: tid, id_chantier: ch1.id, date_rapport: d('2026-05-20'), redacteur: 'Kouame Jean Trinite', effectif_present: 38, meteo: 'nuageux', observations: 'Livraison acier HA 200 barres. Stockage conforme.', a_incident: false },
      { tenant_id: tid, id_chantier: ch1.id, date_rapport: d('2026-05-21'), redacteur: 'Kouame Jean Trinite', effectif_present: 32, meteo: 'pluvieux', observations: 'Arret partiel cause intemperies matin. Reprise 14h.', incidents: 'Chute materiau — aucun blesse, zone securisee', a_incident: true },
      { tenant_id: tid, id_chantier: ch1.id, date_rapport: d('2026-05-22'), redacteur: 'Kouame Jean Trinite', effectif_present: 40, meteo: 'ensoleille', observations: 'Visite controle bureau d etudes. Mise en conformite ferraillage demandee.', a_incident: false },
      { tenant_id: tid, id_chantier: ch1.id, date_rapport: d('2026-05-23'), redacteur: 'Kouame Jean Trinite', effectif_present: 42, meteo: 'ensoleille', observations: 'Coffrage plancher niveau 4 en cours. 80% realise.', a_incident: false },
    ],
  });

  console.log('  ✅ Chantier 1 (Immeuble Les Cocotiers) — complet');

  // ── CHANTIER 2 : Villa Duplex (68% avancement) ───────────────────────────
  const ch2 = await p.chantier.create({
    data: {
      tenant_id: tid,
      id_contrat: contrat2.id,
      nom_chantier: 'Villa Duplex Cocody Danga',
      localisation: 'Cocody Danga, Abidjan',
      description: 'Construction villa R+1 avec piscine et espace vert pour M. Diallo',
      date_livraison_prevue: d('2026-06-30'),
      date_demarrage_reelle: d('2025-08-05'),
      chef_chantier: 'Kouame Jean Trinite',
      avancement_global: 68,
      statut: 'en_cours',
    },
  });

  // Budget S0 chantier 2
  await p.budget.create({
    data: {
      tenant_id: tid,
      id_chantier: ch2.id,
      debourse_sec_estime: 85_000_000,
      frais_generaux:      12_000_000,
      marge_prevue:        18_000_000,
      provision_aleas:      5_000_000,
      montant_total_S0:   120_000_000,
      cout_reel_a_date:    82_000_000,
      reste_a_depenser:    38_000_000,
      ecart_budget:        -2_000_000,
    },
  });

  // Corps d'etat chantier 2
  const corpsEtat2Raw = [
    { nom: 'Fondations',        avancement: 100, part_chantier: 15, ordre_execution: 1, budget_alloue: 18_000_000,  cout_reel: 17_500_000,  statut: 'termine',  debut: '2025-08-05', fin: '2025-10-01' },
    { nom: 'Gros oeuvre',       avancement: 100, part_chantier: 28, ordre_execution: 2, budget_alloue: 33_600_000,  cout_reel: 32_000_000,  statut: 'termine',  debut: '2025-10-01', fin: '2026-01-15' },
    { nom: 'Couverture',        avancement: 80,  part_chantier: 10, ordre_execution: 3, budget_alloue: 12_000_000,  cout_reel: 10_000_000,  statut: 'en_cours', debut: '2026-01-15', fin: '2026-03-01' },
    { nom: 'Plomberie',         avancement: 60,  part_chantier: 10, ordre_execution: 4, budget_alloue: 12_000_000,  cout_reel: 7_200_000,   statut: 'en_cours', debut: '2026-02-01', fin: '2026-05-01' },
    { nom: 'Electricite',       avancement: 55,  part_chantier: 8,  ordre_execution: 5, budget_alloue: 9_600_000,   cout_reel: 5_280_000,   statut: 'en_cours', debut: '2026-02-01', fin: '2026-05-01' },
    { nom: 'Finitions',         avancement: 25,  part_chantier: 15, ordre_execution: 6, budget_alloue: 18_000_000,  cout_reel: 4_500_000,   statut: 'en_cours', debut: '2026-04-01', fin: '2026-06-30' },
    { nom: 'Piscine et espaces',avancement: 10,  part_chantier: 14, ordre_execution: 7, budget_alloue: 16_800_000,  cout_reel: 1_680_000,   statut: 'en_cours', debut: '2026-04-15', fin: '2026-06-30' },
  ];

  await p.corpsEtat.createMany({
    data: corpsEtat2Raw.map(c => ({
      tenant_id: tid, id_chantier: ch2.id,
      nom: c.nom, avancement: c.avancement,
      part_chantier: c.part_chantier, ordre_execution: c.ordre_execution,
      budget_alloue: c.budget_alloue, cout_reel: c.cout_reel, statut: c.statut,
      date_debut_prevue: d(c.debut), date_fin_prevue: d(c.fin),
    })),
  });

  const corps2 = await p.corpsEtat.findMany({ where: { id_chantier: ch2.id }, orderBy: { ordre_execution: 'asc' } });

  // Intervenants chantier 2
  await p.intervenant.createMany({
    data: [
      {
        tenant_id: tid, id_chantier: ch2.id, id_corps_etat: corps2[1].id,
        type_intervenant: 'entreprise', nom: 'CONFORT HABITAT CI',
        raison_sociale: 'Confort Habitat SARL',
        telephone: '+225 27 22 68 44 11', email: 'ch@conforthab.ci',
        montant_contrat: 60_000_000, assurance: true,
        numero_agrement: 'AGR-2025-0011',
        date_expiration_agrement: d('2027-12-31'),
        actif: true,
      },
      {
        tenant_id: tid, id_chantier: ch2.id, id_corps_etat: corps2[3].id,
        type_intervenant: 'artisan', nom: 'COULIBALY Bakary',
        telephone: '+225 05 34 77 20 09',
        montant_contrat: 12_000_000, assurance: false, actif: true,
      },
      {
        tenant_id: tid, id_chantier: ch2.id, id_corps_etat: corps2[6].id,
        type_intervenant: 'entreprise', nom: 'AQUA POOL CI',
        raison_sociale: 'Aqua Pool International',
        telephone: '+225 27 22 01 50 80', email: 'contact@aquapool.ci',
        montant_contrat: 16_000_000, assurance: true,
        numero_agrement: 'AGR-2024-0330',
        date_expiration_agrement: d('2026-09-30'),
        actif: true,
      },
    ],
  });

  // Planning chantier 2
  await addPlanningToChantier(tid, ch2.id, '2025-08-05', '2026-06-30', [
    { nom: 'Fin fondations',       prevue: '2025-10-01', reelle: '2025-10-04', statut: 'manque',     ecart: 3  },
    { nom: 'Fin gros oeuvre',      prevue: '2026-01-15', reelle: '2026-01-15', statut: 'atteint',    ecart: 0  },
    { nom: 'Mise hors eau',        prevue: '2026-03-01', reelle: '2026-03-08', statut: 'manque',     ecart: 7  },
    { nom: 'Fin plomberie',        prevue: '2026-05-01', reelle: null,          statut: 'en_attente', ecart: 0  },
    { nom: 'Livraison provisoire', prevue: '2026-06-15', reelle: null,          statut: 'en_attente', ecart: 0  },
    { nom: 'Livraison definitive', prevue: '2026-06-30', reelle: null,          statut: 'en_attente', ecart: 0  },
  ]);

  // Situations chantier 2
  const sit2_1 = await p.situation.create({
    data: {
      tenant_id: tid, id_chantier: ch2.id,
      numero_situation: 1,
      date_emission: d('2025-12-01'), date_echeance: d('2026-01-01'),
      montant_ht: 40_000_000, taux_tva: 18,
      montant_ttc: 47_200_000,
      retenue_garantie: 2_360_000, montant_net: 44_840_000,
      montant_encaisse: 44_840_000,
      reste_a_facturer: 0,
      avancement_facture: 35,
      statut: 'payee',
    },
  });
  await p.paiement.create({
    data: {
      tenant_id: tid, id_situation: sit2_1.id,
      montant: 44_840_000, date_paiement: d('2025-12-28'),
      reference: 'VIR-2025-1201', mode_paiement: 'virement',
    },
  });

  const sit2_2 = await p.situation.create({
    data: {
      tenant_id: tid, id_chantier: ch2.id,
      numero_situation: 2,
      date_emission: d('2026-03-15'), date_echeance: d('2026-04-15'),
      montant_ht: 45_000_000, taux_tva: 18,
      montant_ttc: 53_100_000,
      retenue_garantie: 2_655_000, montant_net: 50_445_000,
      montant_encaisse: 50_445_000,
      reste_a_facturer: 0,
      avancement_facture: 68,
      statut: 'payee',
    },
  });
  await p.paiement.create({
    data: {
      tenant_id: tid, id_situation: sit2_2.id,
      montant: 50_445_000, date_paiement: d('2026-04-10'),
      reference: 'VIR-2026-0401', mode_paiement: 'virement',
    },
  });

  // Rapports terrain chantier 2
  await p.rapportTerrain.createMany({
    data: [
      { tenant_id: tid, id_chantier: ch2.id, date_rapport: d('2026-05-19'), redacteur: 'Kouame Jean Trinite', effectif_present: 12, meteo: 'ensoleille', observations: 'Pose carrelage salle de bain R+1. 60% du lot realise.', a_incident: false },
      { tenant_id: tid, id_chantier: ch2.id, date_rapport: d('2026-05-20'), redacteur: 'Kouame Jean Trinite', effectif_present: 14, meteo: 'ensoleille', observations: 'Electricien finit passages gaines RDC. Debut R+1 demain.', a_incident: false },
      { tenant_id: tid, id_chantier: ch2.id, date_rapport: d('2026-05-22'), redacteur: 'Kouame Jean Trinite', effectif_present: 10, meteo: 'nuageux', observations: 'Excavation piscine demarree. Terrassement 50%.', a_incident: false },
    ],
  });

  // FactureST chantier 2
  await p.factureST.createMany({
    data: [
      {
        tenant_id: tid, id_chantier: ch2.id,
        numero: 'FST-2026-001', intervenant: 'CONFORT HABITAT CI', corps_etat: 'Gros oeuvre',
        date_facture: d('2026-01-31'), montant_ht: 32_000_000, taux_tva: 18,
        montant_tva: 5_760_000, montant_ttc: 37_760_000, statut: 'validee',
      },
      {
        tenant_id: tid, id_chantier: ch2.id,
        numero: 'FST-2026-002', intervenant: 'COULIBALY Bakary', corps_etat: 'Plomberie',
        date_facture: d('2026-05-05'), montant_ht: 7_200_000, taux_tva: 18,
        montant_tva: 1_296_000, montant_ttc: 8_496_000, statut: 'en_attente',
      },
    ],
  });

  console.log('  ✅ Chantier 2 (Villa Duplex Cocody Danga) — complet');

  // Avenant contrat2
  const avenants = await p.modification.findMany({ where: { id_contrat: contrat2.id } });
  if (avenants.length === 0) {
    await p.modification.create({
      data: {
        tenant_id: tid,
        id_contrat: contrat2.id,
        numero_modification: 1,
        motif: 'Ajout piscine et amenagement exterieur non prevu au marche initial',
        montant_supplementaire: 8_000_000,
        delai_supplementaire: 30,
        statut: 'signe',
      },
    });
    console.log('  ✅ Avenant +8M signe pour Villa Duplex');
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seed demo — chantier & planning\n');

  await enrichirTenantDemo();
  await alimenterTenantUser();

  console.log('\n🎉 Seed termine avec succes !');
  console.log('\n📋 Comptes de test :');
  console.log('   admin@btp-abi.ci           | Buildflow2026!  (Admin — tenant demo)');
  console.log('   conducteur@btp-abi.ci      | Buildflow2026!  (Conducteur — tenant demo)');
  console.log('   chef@btp-abi.ci            | Buildflow2026!  (Chef chantier — tenant demo)');
  console.log('   compta@btp-abi.ci          | Buildflow2026!  (Comptable — tenant demo)');
  console.log('   kouamejeantrinite@gmail.com| buildflow       (Admin — buildpro SA)');
}

main()
  .catch(e => { console.error('\n❌ Erreur :', e.message); process.exit(1); })
  .finally(() => p.$disconnect());
