-- CreateEnum
CREATE TYPE "StatutFactureST" AS ENUM ('en_attente', 'validee', 'contestee');

-- CreateTable
CREATE TABLE "factures_st" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "id_chantier" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "intervenant" TEXT NOT NULL,
    "corps_etat" TEXT,
    "date_facture" TIMESTAMP(3) NOT NULL,
    "date_reception" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montant_ht" DOUBLE PRECISION NOT NULL,
    "taux_tva" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "montant_tva" DOUBLE PRECISION NOT NULL,
    "montant_ttc" DOUBLE PRECISION NOT NULL,
    "statut" "StatutFactureST" NOT NULL DEFAULT 'en_attente',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factures_st_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "factures_st" ADD CONSTRAINT "factures_st_id_chantier_fkey" FOREIGN KEY ("id_chantier") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
