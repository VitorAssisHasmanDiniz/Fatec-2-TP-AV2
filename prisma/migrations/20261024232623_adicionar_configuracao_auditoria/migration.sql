-- CreateTable
CREATE TABLE "configuracao" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "aliquotaImposto" DOUBLE PRECISION NOT NULL,
    "coeficienteDepreciacao" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_auditoria" (
    "id" UUID NOT NULL,
    "usuarioId" UUID,
    "acao" VARCHAR(100) NOT NULL,
    "entidade" VARCHAR(100) NOT NULL,
    "entidadeId" VARCHAR(100),
    "detalhes" JSONB,
    "ip" VARCHAR(45),
    "userAgent" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registros_auditoria_usuarioId_criadoEm_idx" ON "registros_auditoria"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "registros_auditoria_entidade_entidadeId_idx" ON "registros_auditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "registros_auditoria_criadoEm_idx" ON "registros_auditoria"("criadoEm");

-- AddForeignKey
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
