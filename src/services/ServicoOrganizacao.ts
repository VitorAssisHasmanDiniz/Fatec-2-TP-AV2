import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import ValidadorCNPJ from "./ValidadorCNPJ.js";

export interface DadosOrganizacao {
    id: string;
    razaoSocial: string;
    cnpj: string;
    inscricaoEstadual?: string;
    enderecoCompleto?: string;
    telefone?: string;
    email?: string;
    vencimentoContrato: Date;
    valorMensal: number;
}

export default class ServicoOrganizacao {
    private validadorCNPJ = new ValidadorCNPJ();

    async cadastrarComDados(
        dados: DadosOrganizacao,
        usuarioId: string | null = null
    ) {
        const id = dados.id.trim();
        const razaoSocial = dados.razaoSocial.trim();
        const cnpj = dados.cnpj.replace(/\D/g, "");
        const vencimento = dados.vencimentoContrato;

        if (!id || !razaoSocial) {
            throw new AppError(
                "Identificador e razão social são obrigatórios.",
                400,
                "DADOS_OBRIGATORIOS"
            );
        }

        if (id.length > 20) {
            throw new AppError(
                "O identificador deve ter no máximo 20 caracteres.",
                400,
                "IDENTIFICADOR_INVALIDO"
            );
        }

        if (!this.validadorCNPJ.validar(cnpj)) {
            throw new AppError("CNPJ inválido.", 400, "CNPJ_INVALIDO");
        }

        if (
            !(vencimento instanceof Date) ||
            Number.isNaN(vencimento.getTime())
        ) {
            throw new AppError(
                "Data de vencimento do contrato inválida.",
                400,
                "VENCIMENTO_INVALIDO"
            );
        }

        if (
            !Number.isFinite(dados.valorMensal) ||
            dados.valorMensal < 0
        ) {
            throw new AppError(
                "O valor mensal deve ser um número válido e não negativo.",
                400,
                "VALOR_MENSAL_INVALIDO"
            );
        }

        try {
            return await prisma.$transaction(async (tx) => {
                const organizacao = await tx.organizacao.create({
                    data: {
                        id,
                        razaoSocial,
                        cnpj,
                        inscricaoEstadual:
                            dados.inscricaoEstadual?.trim() ?? "",
                        enderecoCompleto:
                            dados.enderecoCompleto?.trim() ?? "",
                        telefone: dados.telefone?.trim() ?? "",
                        email: dados.email?.trim() ?? "",
                        contratoVigente: {
                            create: {
                                dataVencimento: vencimento,
                                valorMensal: new Prisma.Decimal(
                                    dados.valorMensal
                                ),
                                clausulas: 0,
                                renovacaoAutomatica: true
                            }
                        }
                    },
                    include: {
                        contratoVigente: true
                    }
                });

                await tx.registroAuditoria.create({
                    data: {
                        usuarioId,
                        acao: "CRIAR",
                        entidade: "Organizacao",
                        entidadeId: organizacao.id,
                        detalhes: {
                            razaoSocial: organizacao.razaoSocial,
                            cnpj: organizacao.cnpj
                        }
                    }
                });

                return organizacao;
            });
        } catch (erro) {
            if (
                erro instanceof Prisma.PrismaClientKnownRequestError &&
                erro.code === "P2002"
            ) {
                throw new AppError(
                    "Já existe uma organização com esse identificador ou CNPJ.",
                    409,
                    "ORGANIZACAO_DUPLICADA"
                );
            }

            throw erro;
        }
    }

    async buscarOrganizacao(id: string) {
        const organizacao = await prisma.organizacao.findUnique({
            where: { id },
            include: { contratoVigente: true }
        });

        if (!organizacao) {
            throw new AppError(
                "Organização não encontrada.",
                404,
                "ORGANIZACAO_NAO_ENCONTRADA"
            );
        }

        return organizacao;
    }

    async listarOrganizacoesAtivas() {
        return prisma.organizacao.findMany({
            where: { ativo: true },
            include: { contratoVigente: true },
            orderBy: { id: "asc" }
        });
    }

    async desativarOrganizacao(
        id: string,
        usuarioId: string | null = null
    ) {
        return prisma.$transaction(async (tx) => {
            const organizacao = await tx.organizacao.findUnique({
                where: { id },
                select: {
                    id: true,
                    ativo: true,
                    razaoSocial: true
                }
            });

            if (!organizacao) {
                throw new AppError(
                    "Organização não encontrada.",
                    404,
                    "ORGANIZACAO_NAO_ENCONTRADA"
                );
            }

            if (!organizacao.ativo) {
                throw new AppError(
                    "A organização já está desativada.",
                    409,
                    "ORGANIZACAO_JA_DESATIVADA"
                );
            }

            const atualizada = await tx.organizacao.update({
                where: { id },
                data: {
                    ativo: false,
                    versao: { increment: 1 }
                },
                include: { contratoVigente: true }
            });

            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: "DESATIVAR",
                    entidade: "Organizacao",
                    entidadeId: id,
                    detalhes: {
                        razaoSocial: organizacao.razaoSocial
                    }
                }
            });

            return atualizada;
        });
    }

    async ativarOrganizacao(
        id: string,
        usuarioId: string | null = null
    ) {
        return prisma.$transaction(async (tx) => {
            const organizacao = await tx.organizacao.findUnique({
                where: { id },
                select: {
                    id: true,
                    ativo: true,
                    razaoSocial: true
                }
            });

            if (!organizacao) {
                throw new AppError(
                    "Organização não encontrada.",
                    404,
                    "ORGANIZACAO_NAO_ENCONTRADA"
                );
            }

            if (organizacao.ativo) {
                throw new AppError(
                    "A organização já está ativa.",
                    409,
                    "ORGANIZACAO_JA_ATIVA"
                );
            }

            const atualizada = await tx.organizacao.update({
                where: { id },
                data: {
                    ativo: true,
                    versao: { increment: 1 }
                },
                include: { contratoVigente: true }
            });

            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: "ATIVAR",
                    entidade: "Organizacao",
                    entidadeId: id,
                    detalhes: {
                        razaoSocial: organizacao.razaoSocial
                    }
                }
            });

            return atualizada;
        });
    }

    async renovarContrato(
        organizacaoId: string,
        novoVencimento: Date,
        usuarioId: string | null = null
    ) {
        if (
            !(novoVencimento instanceof Date) ||
            Number.isNaN(novoVencimento.getTime())
        ) {
            throw new AppError(
                "Data de vencimento inválida.",
                400,
                "VENCIMENTO_INVALIDO"
            );
        }

        return prisma.$transaction(async (tx) => {
            const organizacao = await tx.organizacao.findUnique({
                where: { id: organizacaoId },
                include: { contratoVigente: true }
            });

            if (!organizacao) {
                throw new AppError(
                    "Organização não encontrada.",
                    404,
                    "ORGANIZACAO_NAO_ENCONTRADA"
                );
            }

            const contrato = organizacao.contratoVigente;

            if (!contrato) {
                throw new AppError(
                    "A organização não possui contrato vigente cadastrado.",
                    409,
                    "CONTRATO_NAO_ENCONTRADO"
                );
            }

            if (
                novoVencimento.getTime() <=
                contrato.dataVencimento.getTime()
            ) {
                throw new AppError(
                    "O novo vencimento deve ser posterior ao vencimento atual.",
                    400,
                    "VENCIMENTO_NAO_POSTERIOR"
                );
            }

            const contratoAtualizado = await tx.contrato.update({
                where: { id: contrato.id },
                data: {
                    dataVencimento: novoVencimento
                }
            });

            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: "RENOVAR_CONTRATO",
                    entidade: "Organizacao",
                    entidadeId: organizacaoId,
                    detalhes: {
                        contratoId: contrato.id,
                        vencimentoAnterior:
                            contrato.dataVencimento.toISOString(),
                        novoVencimento: novoVencimento.toISOString()
                    }
                }
            });

            return contratoAtualizado;
        });
    }
}
