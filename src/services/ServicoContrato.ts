
import { prisma } from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

interface DadosContrato {
    organizacaoId: string;
    dataAssinatura?: string | Date;
    dataVencimento: string | Date;
    clausulas?: number;
    valorMensal: number;
    renovacaoAutomatica?: boolean;
}

interface DadosAtualizacaoContrato {
    dataAssinatura?: string | Date;
    dataVencimento?: string | Date;
    clausulas?: number;
    valorMensal?: number;
    renovacaoAutomatica?: boolean;
}

export default class ServicoContrato {
    private validarDatas(
        dataAssinatura: string | Date,
        dataVencimento: string | Date
    ) {
        const assinatura = new Date(dataAssinatura);
        const vencimento = new Date(dataVencimento);

        if (
            Number.isNaN(assinatura.getTime()) ||
            Number.isNaN(vencimento.getTime())
        ) {
            throw new AppError("Data de contrato inválida.", 400);
        }

        if (vencimento <= assinatura) {
            throw new AppError(
                "A data de vencimento deve ser posterior à data de assinatura.",
                400
            );
        }
    }

    private validarValor(valor: number) {
        if (!Number.isFinite(valor) || valor < 0) {
            throw new AppError(
                "O valor mensal deve ser um número válido e não negativo.",
                400
            );
        }
    }

    private validarClausulas(clausulas: number | undefined) {
        if (
            clausulas !== undefined &&
            (!Number.isInteger(clausulas) || clausulas < 0)
        ) {
            throw new AppError(
                "A quantidade de cláusulas deve ser um inteiro não negativo.",
                400
            );
        }
    }

    async criarContrato(dados: DadosContrato, usuarioId: string) {
        const dataAssinatura = dados.dataAssinatura ?? new Date();
        const dataVencimento = dados.dataVencimento;

        this.validarDatas(dataAssinatura, dataVencimento);
        this.validarValor(dados.valorMensal);
        this.validarClausulas(dados.clausulas);

        const organizacao = await prisma.organizacao.findUnique({
            where: { id: dados.organizacaoId }
        });

        if (!organizacao) {
            throw new AppError("Organização não encontrada.", 404);
        }

        const contratoExistente = await prisma.contrato.findUnique({
            where: { organizacaoId: dados.organizacaoId }
        });

        if (contratoExistente) {
            throw new AppError(
                "Esta organização já possui um contrato cadastrado.",
                409
            );
        }

        return prisma.$transaction(async (tx) => {
            const contrato = await tx.contrato.create({
                data: {
                    organizacaoId: dados.organizacaoId,
                    dataAssinatura: new Date(dataAssinatura),
                    dataVencimento: new Date(dataVencimento),
                    clausulas: dados.clausulas ?? 0,
                    valorMensal: dados.valorMensal,
                    renovacaoAutomatica: dados.renovacaoAutomatica ?? false
                },
                include: {
                    organizacao: {
                        select: {
                            id: true,
                            razaoSocial: true,
                            cnpj: true
                        }
                    }
                }
            });

            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: "CRIAR",
                    entidade: "Contrato",
                    entidadeId: contrato.id,
                    detalhes: {
                        organizacaoId: contrato.organizacaoId,
                        valorMensal: Number(contrato.valorMensal),
                        dataVencimento: contrato.dataVencimento.toISOString()
                    }
                }
            });

            return contrato;
        });
    }

    async listarContratos() {
        return prisma.contrato.findMany({
            orderBy: { dataVencimento: "asc" },
            include: {
                organizacao: {
                    select: {
                        id: true,
                        razaoSocial: true,
                        cnpj: true,
                        ativo: true
                    }
                }
            }
        });
    }

    async buscarContratoPorId(id: string) {
        const contrato = await prisma.contrato.findUnique({
            where: { id },
            include: {
                organizacao: {
                    select: {
                        id: true,
                        razaoSocial: true,
                        cnpj: true,
                        ativo: true
                    }
                }
            }
        });

        if (!contrato) {
            throw new AppError("Contrato não encontrado.", 404);
        }

        return contrato;
    }

    async buscarContratoPorOrganizacao(organizacaoId: string) {
        const organizacao = await prisma.organizacao.findUnique({
            where: { id: organizacaoId },
            select: {
                id: true,
                razaoSocial: true,
                cnpj: true
            }
        });

        if (!organizacao) {
            throw new AppError("Organização não encontrada.", 404);
        }

        const contrato = await prisma.contrato.findUnique({
            where: { organizacaoId },
            include: {
                organizacao: {
                    select: {
                        id: true,
                        razaoSocial: true,
                        cnpj: true,
                        ativo: true
                    }
                }
            }
        });

        return contrato;
    }

    async atualizarContrato(
        id: string,
        dados: DadosAtualizacaoContrato,
        usuarioId: string
    ) {
        const contratoAtual = await prisma.contrato.findUnique({
            where: { id }
        });

        if (!contratoAtual) {
            throw new AppError("Contrato não encontrado.", 404);
        }

        const dataAssinatura =
            dados.dataAssinatura ?? contratoAtual.dataAssinatura;

        const dataVencimento =
            dados.dataVencimento ?? contratoAtual.dataVencimento;

        const valorMensal =
            dados.valorMensal ?? Number(contratoAtual.valorMensal);

        this.validarDatas(dataAssinatura, dataVencimento);
        this.validarValor(valorMensal);
        this.validarClausulas(dados.clausulas);

        return prisma.$transaction(async (tx) => {
            const contrato = await tx.contrato.update({
                where: { id },
                data: {
                    ...(dados.dataAssinatura !== undefined && {
                        dataAssinatura: new Date(dados.dataAssinatura)
                    }),
                    ...(dados.dataVencimento !== undefined && {
                        dataVencimento: new Date(dados.dataVencimento)
                    }),
                    ...(dados.clausulas !== undefined && {
                        clausulas: dados.clausulas
                    }),
                    ...(dados.valorMensal !== undefined && {
                        valorMensal: dados.valorMensal
                    }),
                    ...(dados.renovacaoAutomatica !== undefined && {
                        renovacaoAutomatica: dados.renovacaoAutomatica
                    })
                },
                include: {
                    organizacao: {
                        select: {
                            id: true,
                            razaoSocial: true,
                            cnpj: true
                        }
                    }
                }
            });

            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: "EDITAR",
                    entidade: "Contrato",
                    entidadeId: contrato.id,
                    detalhes: {
                        camposAlterados: Object.keys(dados),
                        valorMensalAnterior: Number(contratoAtual.valorMensal),
                        valorMensalAtual: Number(contrato.valorMensal),
                        vencimentoAnterior:
                            contratoAtual.dataVencimento.toISOString(),
                        vencimentoAtual: contrato.dataVencimento.toISOString()
                    }
                }
            });

            return contrato;
        });
    }

    async excluirContrato(id: string, usuarioId: string) {
        const contratoAtual = await prisma.contrato.findUnique({
            where: { id }
        });

        if (!contratoAtual) {
            throw new AppError("Contrato não encontrado.", 404);
        }

        return prisma.$transaction(async (tx) => {
            await tx.contrato.delete({
                where: { id }
            });

            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: "EXCLUIR",
                    entidade: "Contrato",
                    entidadeId: contratoAtual.id,
                    detalhes: {
                        organizacaoId: contratoAtual.organizacaoId,
                        valorMensal: Number(contratoAtual.valorMensal),
                        dataVencimento:
                            contratoAtual.dataVencimento.toISOString()
                    }
                }
            });

            return {
                mensagem: "Contrato excluído com sucesso."
            };
        });
    }
}
