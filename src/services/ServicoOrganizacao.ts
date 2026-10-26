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

                if (organizacao.contratoVigente) {
                    await tx.registroAuditoria.create({
                        data: {
                            usuarioId,
                            acao: "CRIAR",
                            entidade: "Contrato",
                            entidadeId: organizacao.contratoVigente.id,
                            detalhes: {
                                organizacaoId: organizacao.id,
                                dataVencimento:
                                    organizacao.contratoVigente.dataVencimento.toISOString(),
                                valorMensal:
                                    organizacao.contratoVigente.valorMensal.toString(),
                                clausulas: organizacao.contratoVigente.clausulas,
                                renovacaoAutomatica:
                                    organizacao.contratoVigente.renovacaoAutomatica
                            }
                        }
                    });
                }

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



    async buscarOrganizacoesPorNome(nome: string) {
        const termo = nome.trim();
        if (!termo) throw new AppError("Informe um nome para pesquisa.", 400, "TERMO_BUSCA_OBRIGATORIO");
        return prisma.organizacao.findMany({
            where: { razaoSocial: { contains: termo, mode: "insensitive" } },
            include: { contratoVigente: true },
            orderBy: { razaoSocial: "asc" },
            take: 100
        });
    }

    async editarOrganizacao(
        id: string,
        dados: {
            razaoSocial?: string;
            cnpj?: string;
            inscricaoEstadual?: string;
            enderecoCompleto?: string;
            telefone?: string;
            email?: string;
        },
        usuarioId: string | null = null
    ) {
        const campos = Object.keys(dados).filter((campo) =>
            (dados as Record<string, unknown>)[campo] !== undefined
        );
        if (campos.length === 0) {
            throw new AppError("Informe ao menos um campo para editar.", 400, "NENHUM_CAMPO_INFORMADO");
        }

        const atualizacao: {
            razaoSocial?: string;
            cnpj?: string;
            inscricaoEstadual?: string;
            enderecoCompleto?: string;
            telefone?: string;
            email?: string;
        } = {};

        if (dados.razaoSocial !== undefined) {
            const valor = dados.razaoSocial.trim();
            if (!valor || valor.length > 200) throw new AppError("Razão social deve ter de 1 a 200 caracteres.", 400, "RAZAO_SOCIAL_INVALIDA");
            atualizacao.razaoSocial = valor;
        }
        if (dados.cnpj !== undefined) {
            const cnpj = dados.cnpj.replace(/\D/g, "");
            if (!this.validadorCNPJ.validar(cnpj)) throw new AppError("CNPJ inválido.", 400, "CNPJ_INVALIDO");
            atualizacao.cnpj = cnpj;
        }
        if (dados.inscricaoEstadual !== undefined) atualizacao.inscricaoEstadual = dados.inscricaoEstadual.trim();
        if (dados.enderecoCompleto !== undefined) atualizacao.enderecoCompleto = dados.enderecoCompleto.trim();
        if (dados.telefone !== undefined) atualizacao.telefone = dados.telefone.trim();
        if (dados.email !== undefined) {
            const email = dados.email.trim();
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("E-mail inválido.", 400, "EMAIL_INVALIDO");
            atualizacao.email = email;
        }

        try {
            return await prisma.$transaction(async (tx) => {
                const existente = await tx.organizacao.findUnique({ where: { id } });
                if (!existente) throw new AppError("Organização não encontrada.", 404, "ORGANIZACAO_NAO_ENCONTRADA");
                const atualizada = await tx.organizacao.update({ where: { id }, data: atualizacao, include: { contratoVigente: true } });
                await tx.registroAuditoria.create({ data: {
                    usuarioId, acao: "EDITAR", entidade: "Organizacao", entidadeId: id,
                    detalhes: { camposAlterados: campos, antes: { razaoSocial: existente.razaoSocial, cnpj: existente.cnpj }, depois: { razaoSocial: atualizada.razaoSocial, cnpj: atualizada.cnpj } }
                }});
                return atualizada;
            });
        } catch (erro) {
            if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
                throw new AppError("Já existe uma organização com esse CNPJ.", 409, "ORGANIZACAO_DUPLICADA");
            }
            throw erro;
        }
    }

    async excluirOrganizacao(id: string, usuarioId: string | null = null) {
        return prisma.$transaction(async (tx) => {
            const existente = await tx.organizacao.findUnique({
                where: { id },
                include: { _count: { select: { lotes: true } }, contratoVigente: true }
            });
            if (!existente) throw new AppError("Organização não encontrada.", 404, "ORGANIZACAO_NAO_ENCONTRADA");
            if (existente._count.lotes > 0) throw new AppError("Não é possível excluir uma organização com lotes vinculados. Desative-a para preservar o histórico.", 409, "ORGANIZACAO_COM_LOTES");
            await tx.registroAuditoria.create({ data: {
                usuarioId, acao: "EXCLUIR", entidade: "Organizacao", entidadeId: id,
                detalhes: { razaoSocial: existente.razaoSocial, cnpj: existente.cnpj, contratoId: existente.contratoVigente?.id ?? null }
            }});
            await tx.organizacao.delete({ where: { id } });
            return { id, razaoSocial: existente.razaoSocial };
        });
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
                    entidade: "Contrato",
                    entidadeId: contrato.id,
                    detalhes: {
                        organizacaoId,
                        vencimentoAnterior:
                            contrato.dataVencimento.toISOString(),
                        novoVencimento:
                            contratoAtualizado.dataVencimento.toISOString()
                    }
                }
            });

            return contratoAtualizado;
        });
    }
}
