import crypto from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
export default class ServicoLote {
    async criarLote(dados, usuarioId = null) {
        const organizacaoId = dados.org.trim();
        const notaFiscal = dados.nf.trim();
        const transportadora = dados.transp.trim();
        const dataEntrada = dados.dataEntrada ?? new Date();
        const observacoes = dados.observacoes?.trim() ?? "";
        if (!organizacaoId || !notaFiscal || !transportadora) {
            throw new AppError("Organização, nota fiscal e transportadora são obrigatórias.", 400, "DADOS_OBRIGATORIOS");
        }
        if (!(dataEntrada instanceof Date) ||
            Number.isNaN(dataEntrada.getTime())) {
            throw new AppError("Data de entrada inválida.", 400, "DATA_ENTRADA_INVALIDA");
        }
        const agora = Date.now();
        const limite = agora - 90 * 24 * 60 * 60 * 1000;
        if (dataEntrada.getTime() > agora ||
            dataEntrada.getTime() < limite) {
            throw new AppError("A data de entrada deve estar entre hoje e os últimos 90 dias.", 400, "DATA_ENTRADA_FORA_DO_PERIODO");
        }
        const organizacao = await prisma.organizacao.findUnique({
            where: { id: organizacaoId },
            select: { id: true }
        });
        if (!organizacao) {
            throw new AppError("Organização não encontrada.", 404, "ORGANIZACAO_NAO_ENCONTRADA");
        }
        const dataFormatada = dataEntrada
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "");
        const id = `LOT-${dataFormatada}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        try {
            return await prisma.$transaction(async (tx) => {
                const lote = await tx.lote.create({
                    data: {
                        id,
                        organizacaoId,
                        notaFiscal,
                        transportadora,
                        dataEntrada,
                        observacoes,
                        statusProcessamento: "RECEBIDO"
                    },
                    include: {
                        organizacao: true
                    }
                });
                await tx.registroAuditoria.create({
                    data: {
                        usuarioId,
                        acao: "CRIAR",
                        entidade: "Lote",
                        entidadeId: lote.id,
                        detalhes: {
                            organizacaoId: lote.organizacaoId,
                            notaFiscal: lote.notaFiscal,
                            transportadora: lote.transportadora,
                            status: lote.statusProcessamento
                        }
                    }
                });
                return lote;
            });
        }
        catch (erro) {
            if (erro instanceof Prisma.PrismaClientKnownRequestError &&
                erro.code === "P2002") {
                throw new AppError("Não foi possível gerar um identificador único para o lote. Tente novamente.", 409, "LOTE_DUPLICADO");
            }
            throw erro;
        }
    }
    async listarLotes(filtros = {}) {
        const where = {};
        if (filtros.status !== undefined) {
            where.statusProcessamento = filtros.status;
        }
        if (filtros.notaFiscal)
            where.notaFiscal = { contains: filtros.notaFiscal, mode: "insensitive" };
        if (filtros.dataInicio || filtros.dataFim) {
            where.dataEntrada = {
                ...(filtros.dataInicio
                    ? { gte: filtros.dataInicio }
                    : {}),
                ...(filtros.dataFim
                    ? { lte: filtros.dataFim }
                    : {})
            };
        }
        return prisma.lote.findMany({
            where,
            include: {
                organizacao: true
            },
            orderBy: {
                dataEntrada: "desc"
            }
        });
    }
    async buscarLote(id) {
        const lote = await prisma.lote.findUnique({
            where: { id },
            include: {
                organizacao: true
            }
        });
        if (!lote) {
            throw new AppError("Lote não encontrado.", 404, "LOTE_NAO_ENCONTRADO");
        }
        return lote;
    }
    async consultarLotesPorPeriodo(dataInicio, dataFim) {
        if (Number.isNaN(dataInicio.getTime()) ||
            Number.isNaN(dataFim.getTime())) {
            throw new AppError("Informe datas válidas para o período.", 400, "PERIODO_INVALIDO");
        }
        if (dataInicio.getTime() > dataFim.getTime()) {
            throw new AppError("A data inicial não pode ser posterior à data final.", 400, "PERIODO_INVALIDO");
        }
        return prisma.lote.findMany({
            where: {
                dataEntrada: {
                    gte: dataInicio,
                    lte: dataFim
                }
            },
            include: {
                organizacao: true
            },
            orderBy: {
                dataEntrada: "desc"
            }
        });
    }
    async editarLote(id, dados, usuarioId = null) {
        return prisma.$transaction(async (tx) => {
            const lote = await tx.lote.findUnique({
                where: { id },
                select: {
                    id: true,
                    statusProcessamento: true,
                    organizacaoId: true,
                    notaFiscal: true,
                    transportadora: true,
                    dataEntrada: true,
                    observacoes: true
                }
            });
            if (!lote) {
                throw new AppError("Lote não encontrado.", 404, "LOTE_NAO_ENCONTRADO");
            }
            if (lote.statusProcessamento !== "RECEBIDO") {
                throw new AppError("Somente lotes com status RECEBIDO podem ser editados.", 409, "LOTE_NAO_EDITAVEL");
            }
            const atualizacao = {};
            if (dados.org !== undefined) {
                const organizacaoId = dados.org.trim();
                if (!organizacaoId) {
                    throw new AppError("A organização não pode ser vazia.", 400, "ORGANIZACAO_INVALIDA");
                }
                const organizacao = await tx.organizacao.findUnique({
                    where: { id: organizacaoId },
                    select: { id: true }
                });
                if (!organizacao) {
                    throw new AppError("Organização não encontrada.", 404, "ORGANIZACAO_NAO_ENCONTRADA");
                }
                atualizacao.organizacao = {
                    connect: { id: organizacaoId }
                };
            }
            if (dados.nf !== undefined) {
                if (!dados.nf.trim()) {
                    throw new AppError("A nota fiscal é obrigatória.", 400, "NOTA_FISCAL_INVALIDA");
                }
                atualizacao.notaFiscal = dados.nf.trim();
            }
            if (dados.transp !== undefined) {
                if (!dados.transp.trim()) {
                    throw new AppError("A transportadora é obrigatória.", 400, "TRANSPORTADORA_INVALIDA");
                }
                atualizacao.transportadora = dados.transp.trim();
            }
            if (dados.dataEntrada !== undefined) {
                if (Number.isNaN(dados.dataEntrada.getTime()) ||
                    dados.dataEntrada.getTime() > Date.now() ||
                    dados.dataEntrada.getTime() <
                        Date.now() - 90 * 24 * 60 * 60 * 1000) {
                    throw new AppError("A data de entrada deve estar entre hoje e os últimos 90 dias.", 400, "DATA_ENTRADA_FORA_DO_PERIODO");
                }
                atualizacao.dataEntrada = dados.dataEntrada;
            }
            if (dados.observacoes !== undefined) {
                atualizacao.observacoes = dados.observacoes.trim();
            }
            if (Object.keys(atualizacao).length === 0) {
                throw new AppError("Informe pelo menos um campo para editar.", 400, "NENHUM_CAMPO_INFORMADO");
            }
            const loteAtualizado = await tx.lote.update({
                where: { id },
                data: atualizacao,
                include: {
                    organizacao: true
                }
            });
            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: "EDITAR",
                    entidade: "Lote",
                    entidadeId: id,
                    detalhes: {
                        camposAlterados: Object.keys(dados),
                        statusAnterior: lote.statusProcessamento
                    }
                }
            });
            return loteAtualizado;
        });
    }
    async processarTriagem(id, usuarioId = null) {
        return prisma.$transaction(async (tx) => {
            const lote = await tx.lote.findUnique({
                where: { id },
                include: { equipamentos: true }
            });
            if (!lote)
                throw new AppError("Lote não encontrado.", 404, "LOTE_NAO_ENCONTRADO");
            if (lote.statusProcessamento !== "RECEBIDO" && lote.statusProcessamento !== "EM_TRIAGEM") {
                throw new AppError("Somente lotes recebidos ou em triagem podem ser processados.", 409, "LOTE_NAO_TRIAVEL");
            }
            if (lote.equipamentos.length === 0)
                throw new AppError("O lote não possui equipamentos.", 409, "LOTE_SEM_EQUIPAMENTOS");
            await tx.lote.update({ where: { id }, data: { statusProcessamento: "EM_TRIAGEM" } });
            for (const equipamento of lote.equipamentos) {
                if (equipamento.statusRastreamento !== "AGUARDANDO_TRIAGEM" && equipamento.statusRastreamento !== "EM_TRIAGEM") {
                    throw new AppError(`O equipamento ${equipamento.codigoBarrasInterno} não pode entrar em triagem a partir do status ${equipamento.statusRastreamento}.`, 409, "TRANSICAO_STATUS_INVALIDA");
                }
                if (equipamento.statusRastreamento === "AGUARDANDO_TRIAGEM") {
                    await tx.equipamento.update({ where: { id: equipamento.id }, data: { statusRastreamento: "EM_TRIAGEM" } });
                    await tx.movimentacao.create({ data: { equipamentoId: equipamento.id, origem: equipamento.statusRastreamento, destino: "EM_TRIAGEM", responsavel: "SISTEMA_TRIAGEM", observacao: `Triagem iniciada para o lote ${id}.` } });
                }
            }
            for (const equipamento of lote.equipamentos) {
                if (equipamento.estadoFisico === "INSERVIVEL") {
                    await tx.equipamento.update({ where: { id: equipamento.id }, data: { statusRastreamento: "AGUARDANDO_DESMONTE" } });
                    await tx.movimentacao.create({ data: { equipamentoId: equipamento.id, origem: "EM_TRIAGEM", destino: "AGUARDANDO_DESMONTE", responsavel: "SISTEMA_TRIAGEM", observacao: `Encaminhado após triagem do lote ${id}.` } });
                }
                else {
                    await tx.equipamento.update({ where: { id: equipamento.id }, data: { statusRastreamento: "AGUARDANDO_DESMONTE" } });
                    await tx.movimentacao.create({ data: { equipamentoId: equipamento.id, origem: "EM_TRIAGEM", destino: "AGUARDANDO_DESMONTE", responsavel: "SISTEMA_TRIAGEM", observacao: `Triagem concluída para o lote ${id}.` } });
                }
            }
            const atualizado = await tx.lote.update({ where: { id }, data: { statusProcessamento: "TRIAGEM_CONCLUIDA" }, include: { organizacao: true, equipamentos: { include: { historicoMovimentacao: { orderBy: { dataHora: "desc" } } } } } });
            await tx.registroAuditoria.create({ data: { usuarioId, acao: "TRIAGEM_CONCLUIDA", entidade: "Lote", entidadeId: id, detalhes: { quantidadeEquipamentos: lote.equipamentos.length, statusAnterior: lote.statusProcessamento, statusNovo: "TRIAGEM_CONCLUIDA" } } });
            return atualizado;
        });
    }
    async excluirLote(id, usuarioId = null) {
        return prisma.$transaction(async (tx) => {
            const lote = await tx.lote.findUnique({ where: { id }, include: { _count: { select: { equipamentos: true } } } });
            if (!lote)
                throw new AppError("Lote não encontrado.", 404, "LOTE_NAO_ENCONTRADO");
            if (lote._count.equipamentos > 0)
                throw new AppError("Não é possível excluir lote com equipamentos vinculados.", 409, "LOTE_COM_EQUIPAMENTOS");
            await tx.registroAuditoria.create({ data: { usuarioId, acao: "EXCLUIR", entidade: "Lote", entidadeId: id, detalhes: { organizacaoId: lote.organizacaoId, status: lote.statusProcessamento } } });
            await tx.lote.delete({ where: { id } });
            return { id };
        });
    }
    async cancelarLote(id, usuarioId = null) {
        return prisma.$transaction(async (tx) => {
            const lote = await tx.lote.findUnique({
                where: { id },
                select: {
                    id: true,
                    statusProcessamento: true
                }
            });
            if (!lote) {
                throw new AppError("Lote não encontrado.", 404, "LOTE_NAO_ENCONTRADO");
            }
            if (lote.statusProcessamento === "CANCELADO") {
                throw new AppError("O lote já está cancelado.", 409, "LOTE_JA_CANCELADO");
            }
            if (lote.statusProcessamento !== "RECEBIDO") {
                throw new AppError("Somente lotes com status RECEBIDO podem ser cancelados.", 409, "STATUS_NAO_PERMITE_CANCELAMENTO");
            }
            const loteCancelado = await tx.lote.update({
                where: { id },
                data: {
                    statusProcessamento: "CANCELADO"
                },
                include: {
                    organizacao: true
                }
            });
            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: "CANCELAR",
                    entidade: "Lote",
                    entidadeId: id,
                    detalhes: {
                        statusAnterior: lote.statusProcessamento,
                        statusNovo: "CANCELADO"
                    }
                }
            });
            return loteCancelado;
        });
    }
}
