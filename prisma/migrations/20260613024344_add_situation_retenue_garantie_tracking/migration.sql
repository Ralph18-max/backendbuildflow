-- CreateEnum
CREATE TYPE "StatutRetenue" AS ENUM ('a_liberer', 'liberee');

-- AlterTable
ALTER TABLE "situations" ADD COLUMN     "date_liberation_retenue" TIMESTAMP(3),
ADD COLUMN     "statut_retenue" "StatutRetenue" NOT NULL DEFAULT 'a_liberer';
