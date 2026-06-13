-- AlterTable
ALTER TABLE "utilisateurs" ADD COLUMN     "reset_token" TEXT,
ADD COLUMN     "reset_token_expires" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_reset_token_key" ON "utilisateurs"("reset_token");
