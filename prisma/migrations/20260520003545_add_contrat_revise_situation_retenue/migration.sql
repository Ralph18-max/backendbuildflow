-- AlterTable
ALTER TABLE "contrats" ADD COLUMN     "montant_marche_revise" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "situations" ADD COLUMN     "date_echeance" TIMESTAMP(3),
ADD COLUMN     "montant_net" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "retenue_garantie" DOUBLE PRECISION NOT NULL DEFAULT 0;
