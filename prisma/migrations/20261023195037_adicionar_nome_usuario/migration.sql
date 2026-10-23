/*
  Warnings:

  - Added the required column `nome` to the `usuarios` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "usuarios"
ADD COLUMN "nome" VARCHAR(120);

UPDATE "usuarios"
SET "nome" = "usuario"
WHERE "nome" IS NULL;

ALTER TABLE "usuarios"
ALTER COLUMN "nome" SET NOT NULL;

-- CreateTable
CREATE TABLE "organizacoes" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "razaoSocial" VARCHAR(200) NOT NULL,
    "cnpj" VARCHAR(14) NOT NULL,
    "inscricaoEstadual" VARCHAR(30),
    "enderecoCompleto" TEXT,
    "telefone" VARCHAR(20),
    "email" VARCHAR(254),
    "dataCadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizacoes_codigo_key" ON "organizacoes"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "organizacoes_cnpj_key" ON "organizacoes"("cnpj");
