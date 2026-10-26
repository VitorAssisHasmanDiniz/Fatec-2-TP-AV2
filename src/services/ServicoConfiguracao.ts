import { prisma } from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export interface DadosConfiguracao {
    aliquotaImposto?: number;
    coeficienteDepreciacao?: number;
}

export default class ServicoConfiguracao {
    async consultarConfiguracao() {
        const configuracao = await prisma.configuracao.findUnique({
            where: { id: 1 }
        });

        if (!configuracao) {
            return {
                id: 1,
                aliquotaImposto: 0,
                coeficienteDepreciacao: 0
            };
        }

        return configuracao;
    }

    async atualizarConfiguracao(
        dados: DadosConfiguracao,
        usuarioId: string | null = null
    ) {
        if (dados.aliquotaImposto === undefined && dados.coeficienteDepreciacao === undefined) {
            throw new AppError("Informe aliquotaImposto ou coeficienteDepreciacao.", 400, "DADOS_INVALIDOS");
        }
        if (dados.aliquotaImposto !== undefined && (!Number.isFinite(dados.aliquotaImposto) || dados.aliquotaImposto < 0 || dados.aliquotaImposto > 1)) {
            throw new AppError("A alíquota de imposto deve estar entre 0 e 1.", 400, "ALIQUOTA_INVALIDA");
        }
        if (dados.coeficienteDepreciacao !== undefined && (!Number.isFinite(dados.coeficienteDepreciacao) || dados.coeficienteDepreciacao < 0 || dados.coeficienteDepreciacao > 1)) {
            throw new AppError("O coeficiente de depreciação deve estar entre 0 e 1.", 400, "COEFICIENTE_DEPRECIACAO_INVALIDO");
        }

        return prisma.$transaction(async (tx) => {
            const anterior = await tx.configuracao.findUnique({ where: { id: 1 } });
            const valores = {
                aliquotaImposto: dados.aliquotaImposto ?? anterior?.aliquotaImposto ?? 0,
                coeficienteDepreciacao: dados.coeficienteDepreciacao ?? anterior?.coeficienteDepreciacao ?? 0
            };
            const configuracao = await tx.configuracao.upsert({
                where: { id: 1 },
                create: { id: 1, ...valores },
                update: valores
            });
            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: anterior ? "EDITAR" : "CRIAR",
                    entidade: "Configuracao",
                    entidadeId: "1",
                    detalhes: {
                        camposAlterados: Object.keys(dados),
                        valoresAnteriores: anterior ? { aliquotaImposto: anterior.aliquotaImposto, coeficienteDepreciacao: anterior.coeficienteDepreciacao } : null,
                        valoresNovos: valores
                    }
                }
            });
            return configuracao;
        });
    }
}
