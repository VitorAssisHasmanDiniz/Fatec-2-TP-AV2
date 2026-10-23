/*
  Warnings:

  - The primary key for the `organizacoes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `organizacoes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `inscricaoEstadual` on table `organizacoes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `enderecoCompleto` on table `organizacoes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `telefone` on table `organizacoes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `organizacoes` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "organizacoes" DROP CONSTRAINT "organizacoes_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" VARCHAR(20) NOT NULL,
ALTER COLUMN "codigo" DROP NOT NULL,
ALTER COLUMN "inscricaoEstadual" SET NOT NULL,
ALTER COLUMN "inscricaoEstadual" SET DEFAULT '',
ALTER COLUMN "enderecoCompleto" SET NOT NULL,
ALTER COLUMN "enderecoCompleto" SET DEFAULT '',
ALTER COLUMN "telefone" SET NOT NULL,
ALTER COLUMN "telefone" SET DEFAULT '',
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "email" SET DEFAULT '',
ADD CONSTRAINT "organizacoes_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "contratos" (
    "id" UUID NOT NULL,
    "organizacaoId" VARCHAR(20) NOT NULL,
    "dataAssinatura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "clausulas" INTEGER NOT NULL DEFAULT 0,
    "valorMensal" DECIMAL(12,2) NOT NULL,
    "renovacaoAutomatica" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contratos_organizacaoId_key" ON "contratos"("organizacaoId");

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
