import { prisma } from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export interface DadosConfiguracao {
    aliquotaImposto: number;
    coeficienteDepreciacao: number;
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
        if (
            !Number.isFinite(dados.aliquotaImposto) ||
            dados.aliquotaImposto < 0 ||
            dados.aliquotaImposto > 1
        ) {
            throw new AppError(
                "A alíquota de imposto deve estar entre 0 e 1.",
                400,
                "ALIQUOTA_INVALIDA"
            );
        }

        if (
            !Number.isFinite(dados.coeficienteDepreciacao) ||
            dados.coeficienteDepreciacao < 0 ||
            dados.coeficienteDepreciacao > 1
        ) {
            throw new AppError(
                "O coeficiente de depreciação deve estar entre 0 e 1.",
                400,
                "COEFICIENTE_DEPRECIACAO_INVALIDO"
            );
        }

        return prisma.$transaction(async (tx) => {
            const anterior = await tx.configuracao.findUnique({
                where: { id: 1 }
            });

            const configuracao = await tx.configuracao.upsert({
                where: { id: 1 },
                create: {
                    id: 1,
                    aliquotaImposto: dados.aliquotaImposto,
                    coeficienteDepreciacao: dados.coeficienteDepreciacao
                },
                update: {
                    aliquotaImposto: dados.aliquotaImposto,
                    coeficienteDepreciacao: dados.coeficienteDepreciacao
                }
            });

            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: anterior ? "EDITAR" : "CRIAR",
                    entidade: "Configuracao",
                    entidadeId: "1",
                    detalhes: {
                        valoresAnteriores: anterior
                            ? {
                                aliquotaImposto: anterior.aliquotaImposto,
                                coeficienteDepreciacao:
                                    anterior.coeficienteDepreciacao
                            }
                            : null,
                        valoresNovos: {
                            aliquotaImposto: configuracao.aliquotaImposto,
                            coeficienteDepreciacao:
                                configuracao.coeficienteDepreciacao
                        }
                    }
                }
            });

            return configuracao;
        });
    }
}