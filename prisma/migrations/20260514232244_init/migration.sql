-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'conducteur', 'chef_chantier', 'comptable');

-- CreateEnum
CREATE TYPE "TypeClient" AS ENUM ('particulier', 'societe');

-- CreateEnum
CREATE TYPE "StatutContrat" AS ENUM ('en_cours', 'termine', 'resilie', 'suspendu');

-- CreateEnum
CREATE TYPE "StatutModification" AS ENUM ('signe', 'en_attente', 'refuse');

-- CreateEnum
CREATE TYPE "StatutChantier" AS ENUM ('en_cours', 'termine', 'suspendu', 'cloture');

-- CreateEnum
CREATE TYPE "StatutJalon" AS ENUM ('atteint', 'manque', 'en_attente');

-- CreateEnum
CREATE TYPE "TypeRessource" AS ENUM ('humaine', 'materiel', 'materiau');

-- CreateEnum
CREATE TYPE "Meteo" AS ENUM ('ensoleille', 'nuageux', 'pluvieux', 'orageux', 'venteux');

-- CreateEnum
CREATE TYPE "StatutSituation" AS ENUM ('payee', 'en_attente', 'en_retard');

-- CreateEnum
CREATE TYPE "CategorieDocument" AS ENUM ('contrat', 'plan', 'pv', 'facture', 'photo', 'divers');

-- CreateEnum
CREATE TYPE "StatutCloture" AS ENUM ('en_cours', 'bilan_valide', 'cloture');

-- CreateTable
CREATE TABLE "entreprises" (
    "tenant_id" TEXT NOT NULL,
    "nom_entreprise" TEXT NOT NULL,
    "logo_url" TEXT,
    "plan_abonnement" TEXT NOT NULL DEFAULT 'starter',
    "nb_utilisateurs_max" INTEGER NOT NULL DEFAULT 10,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "date_inscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entreprises_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mot_de_passe_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'conducteur',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nom" TEXT,
    "prenom" TEXT,
    "raison_sociale" TEXT,
    "type_client" "TypeClient" NOT NULL DEFAULT 'particulier',
    "telephone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrats" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_client" INTEGER NOT NULL,
    "numero_marche" TEXT NOT NULL,
    "type_construction" TEXT NOT NULL,
    "montant_marche" DOUBLE PRECISION NOT NULL,
    "date_signature" TIMESTAMP(3) NOT NULL,
    "date_demarrage_prevue" TIMESTAMP(3) NOT NULL,
    "date_livraison_prevue" TIMESTAMP(3) NOT NULL,
    "penalites_retard" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statut" "StatutContrat" NOT NULL DEFAULT 'en_cours',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifications" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_contrat" INTEGER NOT NULL,
    "numero_modification" INTEGER NOT NULL,
    "motif" TEXT NOT NULL,
    "montant_supplementaire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "delai_supplementaire" INTEGER NOT NULL DEFAULT 0,
    "statut" "StatutModification" NOT NULL DEFAULT 'en_attente',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chantiers" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_contrat" INTEGER NOT NULL,
    "nom_chantier" TEXT NOT NULL,
    "localisation" TEXT NOT NULL,
    "description" TEXT,
    "date_demarrage_reelle" TIMESTAMP(3),
    "date_livraison_reelle" TIMESTAMP(3),
    "date_livraison_prevue" TIMESTAMP(3) NOT NULL,
    "statut" "StatutChantier" NOT NULL DEFAULT 'en_cours',
    "avancement_global" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chef_chantier" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chantiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_chantier" INTEGER NOT NULL,
    "debourse_sec_estime" DOUBLE PRECISION NOT NULL,
    "frais_generaux" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marge_prevue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "provision_aleas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montant_total_S0" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cout_reel_a_date" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reste_a_depenser" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ecart_budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plannings" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_chantier" INTEGER NOT NULL,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_debut_prevue" TIMESTAMP(3) NOT NULL,
    "date_fin_prevue" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "statut" TEXT NOT NULL DEFAULT 'actif',

    CONSTRAINT "plannings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jalons" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_planning" INTEGER NOT NULL,
    "nom_jalon" TEXT NOT NULL,
    "date_prevue" TIMESTAMP(3) NOT NULL,
    "date_reelle" TIMESTAMP(3),
    "statut" "StatutJalon" NOT NULL DEFAULT 'en_attente',
    "ecart_jours" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "jalons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corps_etat" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_chantier" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "date_debut_prevue" TIMESTAMP(3),
    "date_fin_prevue" TIMESTAMP(3),
    "avancement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "part_chantier" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordre_execution" INTEGER NOT NULL DEFAULT 1,
    "budget_alloue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cout_reel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',

    CONSTRAINT "corps_etat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervenants" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_chantier" INTEGER NOT NULL,
    "id_corps_etat" INTEGER NOT NULL,
    "type_intervenant" TEXT NOT NULL DEFAULT 'entreprise',
    "nom" TEXT NOT NULL,
    "raison_sociale" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "montant_contrat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assurance" BOOLEAN NOT NULL DEFAULT false,
    "numero_agrement" TEXT,
    "date_expiration_agrement" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "intervenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ressources" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_chantier" INTEGER NOT NULL,
    "type" "TypeRessource" NOT NULL,
    "nom" TEXT NOT NULL,
    "quantite_prevue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantite_reelle" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unite" TEXT NOT NULL,
    "cout_unitaire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "date_affectation" TIMESTAMP(3),

    CONSTRAINT "ressources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rapports_terrain" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_chantier" INTEGER NOT NULL,
    "date_rapport" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redacteur" TEXT NOT NULL,
    "effectif_present" INTEGER NOT NULL DEFAULT 0,
    "meteo" "Meteo" NOT NULL DEFAULT 'ensoleille',
    "observations" TEXT,
    "incidents" TEXT,
    "a_incident" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rapports_terrain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corps_etat_rapports" (
    "id" SERIAL NOT NULL,
    "id_rapport" INTEGER NOT NULL,
    "id_corps_etat" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "avancement_avant" DOUBLE PRECISION NOT NULL,
    "avancement_apres" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "corps_etat_rapports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pointages" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_chantier" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "effectif_prevu" INTEGER NOT NULL DEFAULT 0,
    "total_presents" INTEGER NOT NULL DEFAULT 0,
    "total_heures" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pointages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pointage_intervenants" (
    "id" SERIAL NOT NULL,
    "id_pointage" INTEGER NOT NULL,
    "id_intervenant" INTEGER NOT NULL,
    "nom_complet" TEXT NOT NULL,
    "corps_etat" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "heures" DOUBLE PRECISION NOT NULL DEFAULT 8,

    CONSTRAINT "pointage_intervenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "situations" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_chantier" INTEGER NOT NULL,
    "numero_situation" INTEGER NOT NULL,
    "date_emission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montant_ht" DOUBLE PRECISION NOT NULL,
    "taux_tva" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "montant_ttc" DOUBLE PRECISION NOT NULL,
    "montant_encaisse" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reste_a_facturer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avancement_facture" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statut" "StatutSituation" NOT NULL DEFAULT 'en_attente',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "situations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_situation" INTEGER NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "date_paiement" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "mode_paiement" TEXT NOT NULL DEFAULT 'virement',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_chantier" INTEGER NOT NULL,
    "nom_fichier" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "categorie" "CategorieDocument" NOT NULL DEFAULT 'divers',
    "taille_ko" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "url_fichier" TEXT,
    "ajoute_par" TEXT NOT NULL,
    "date_upload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clotures" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_chantier" INTEGER NOT NULL,
    "statut_bilan" "StatutCloture" NOT NULL DEFAULT 'en_cours',
    "date_validation_comptable" TIMESTAMP(3),
    "date_cloture_admin" TIMESTAMP(3),
    "marge_reelle" DOUBLE PRECISION,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clotures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_tenant_id_key" ON "utilisateurs"("email", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "chantiers_id_contrat_key" ON "chantiers"("id_contrat");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_id_chantier_key" ON "budgets"("id_chantier");

-- CreateIndex
CREATE UNIQUE INDEX "plannings_id_chantier_key" ON "plannings"("id_chantier");

-- CreateIndex
CREATE UNIQUE INDEX "clotures_id_chantier_key" ON "clotures"("id_chantier");

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "entreprises"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "entreprises"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrats" ADD CONSTRAINT "contrats_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "entreprises"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrats" ADD CONSTRAINT "contrats_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifications" ADD CONSTRAINT "modifications_id_contrat_fkey" FOREIGN KEY ("id_contrat") REFERENCES "contrats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chantiers" ADD CONSTRAINT "chantiers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "entreprises"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chantiers" ADD CONSTRAINT "chantiers_id_contrat_fkey" FOREIGN KEY ("id_contrat") REFERENCES "contrats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_id_chantier_fkey" FOREIGN KEY ("id_chantier") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_id_chantier_fkey" FOREIGN KEY ("id_chantier") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jalons" ADD CONSTRAINT "jalons_id_planning_fkey" FOREIGN KEY ("id_planning") REFERENCES "plannings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corps_etat" ADD CONSTRAINT "corps_etat_id_chantier_fkey" FOREIGN KEY ("id_chantier") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervenants" ADD CONSTRAINT "intervenants_id_chantier_fkey" FOREIGN KEY ("id_chantier") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervenants" ADD CONSTRAINT "intervenants_id_corps_etat_fkey" FOREIGN KEY ("id_corps_etat") REFERENCES "corps_etat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ressources" ADD CONSTRAINT "ressources_id_chantier_fkey" FOREIGN KEY ("id_chantier") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapports_terrain" ADD CONSTRAINT "rapports_terrain_id_chantier_fkey" FOREIGN KEY ("id_chantier") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corps_etat_rapports" ADD CONSTRAINT "corps_etat_rapports_id_rapport_fkey" FOREIGN KEY ("id_rapport") REFERENCES "rapports_terrain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_id_chantier_fkey" FOREIGN KEY ("id_chantier") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointage_intervenants" ADD CONSTRAINT "pointage_intervenants_id_pointage_fkey" FOREIGN KEY ("id_pointage") REFERENCES "pointages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "situations" ADD CONSTRAINT "situations_id_chantier_fkey" FOREIGN KEY ("id_chantier") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_id_situation_fkey" FOREIGN KEY ("id_situation") REFERENCES "situations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_id_chantier_fkey" FOREIGN KEY ("id_chantier") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clotures" ADD CONSTRAINT "clotures_id_chantier_fkey" FOREIGN KEY ("id_chantier") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
