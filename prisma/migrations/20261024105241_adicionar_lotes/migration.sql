-- CreateEnum
CREATE TYPE "StatusLote" AS ENUM ('RECEBIDO', 'EM_TRIAGEM', 'TRIAGEM_CONCLUIDA', 'ENCAMINHADO', 'FINALIZADO');

-- CreateTable
CREATE TABLE "lotes" (
    "id" VARCHAR(40) NOT NULL,
    "dataEntrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizacaoId" VARCHAR(20) NOT NULL,
    "notaFiscal" VARCHAR(100) NOT NULL,
    "transportadora" VARCHAR(120) NOT NULL,
    "statusProcessamento" "StatusLote" NOT NULL DEFAULT 'RECEBIDO',
    "observacoes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lotes_organizacaoId_idx" ON "lotes"("organizacaoId");

-- CreateIndex
CREATE INDEX "lotes_dataEntrada_idx" ON "lotes"("dataEntrada");

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
