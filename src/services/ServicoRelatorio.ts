import { Prisma, StatusRastreamento } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

function validarPeriodo(inicio: Date, fim: Date) {
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || inicio > fim) {
        throw new AppError("Informe um período válido: início deve ser anterior ou igual ao fim.", 400, "PERIODO_INVALIDO");
    }
}

export default class ServicoRelatorio {
    async porOrganizacao(organizacaoId: string, inicio: Date, fim: Date) {
        validarPeriodo(inicio, fim);
        const organizacao = await prisma.organizacao.findUnique({ where: { id: organizacaoId }, select: { id: true, razaoSocial: true, cnpj: true } });
        if (!organizacao) throw new AppError("Organização não encontrada.", 404, "ORGANIZACAO_NAO_ENCONTRADA");
        const lotes = await prisma.lote.findMany({ where: { organizacaoId, dataEntrada: { gte: inicio, lte: fim } }, include: { equipamentos: { include: { historicoMovimentacao: { orderBy: { dataHora: "asc" } } } } }, orderBy: { dataEntrada: "asc" } });
        const equipamentos = lotes.flatMap((lote) => lote.equipamentos);
        return { organizacao, periodo: { inicio, fim }, quantidadeLotes: lotes.length, quantidadeEquipamentos: equipamentos.length, pesoTotalKg: equipamentos.reduce((soma, item) => soma + item.pesoQuilogramas, 0), lotes };
    }

    async porStatus(status: StatusRastreamento) {
        if (!Object.values(StatusRastreamento).includes(status)) throw new AppError("Status de rastreamento inválido.", 400, "STATUS_INVALIDO");
        const equipamentos = await prisma.equipamento.findMany({ where: { statusRastreamento: status }, include: { lote: { select: { id: true, organizacaoId: true, notaFiscal: true } } }, orderBy: { codigoBarrasInterno: "asc" } });
        return { status, quantidade: equipamentos.length, equipamentos };
    }

    async financeiro(inicio: Date, fim: Date) {
        validarPeriodo(inicio, fim);
        const organizacoes = await prisma.organizacao.findMany({ where: { dataCadastro: { gte: inicio, lte: fim } }, include: { contratoVigente: true }, orderBy: { dataCadastro: "asc" } });
        const valorMensalContratado = organizacoes.reduce((soma, org) => soma + Number(org.contratoVigente?.valorMensal ?? 0), 0);
        return { periodo: { inicio, fim }, organizacoesCadastradas: organizacoes.length, valorMensalContratado, organizacoes };
    }

    async rastreamento(equipamentoId: string) {
        const equipamento = await prisma.equipamento.findUnique({ where: { id: equipamentoId }, include: { lote: true, historicoMovimentacao: { orderBy: { dataHora: "asc" } } } });
        if (!equipamento) throw new AppError("Equipamento não encontrado.", 404, "EQUIPAMENTO_NAO_ENCONTRADO");
        return equipamento;
    }

    async journal(filtros: { inicio?: Date; fim?: Date; entidade?: string; acao?: string; limite?: number }) {
        if ((filtros.inicio && Number.isNaN(filtros.inicio.getTime())) || (filtros.fim && Number.isNaN(filtros.fim.getTime())) || (filtros.inicio && filtros.fim && filtros.inicio > filtros.fim)) {
            throw new AppError("Período de auditoria inválido.", 400, "PERIODO_INVALIDO");
        }
        const where: Prisma.RegistroAuditoriaWhereInput = {
            ...(filtros.entidade ? { entidade: { contains: filtros.entidade, mode: "insensitive" } } : {}),
            ...(filtros.acao ? { acao: { contains: filtros.acao, mode: "insensitive" } } : {}),
            ...(filtros.inicio || filtros.fim ? { criadoEm: { ...(filtros.inicio ? { gte: filtros.inicio } : {}), ...(filtros.fim ? { lte: filtros.fim } : {}) } } : {})
        };
        return prisma.registroAuditoria.findMany({ where, take: Math.min(Math.max(filtros.limite ?? 100, 1), 500), include: { usuario: { select: { id: true, usuario: true, nome: true, papel: true } } }, orderBy: { criadoEm: "desc" } });
    }
}
