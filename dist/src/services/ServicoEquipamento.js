import crypto from "node:crypto";
import { EstadoFisico, StatusRastreamento, TipoEquipamento } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { gerarCodigoBarrasSequencial } from "../utils/codigoBarras.js";
export default class ServicoEquipamento {
    prefixos = {
        COMPUTADOR_MESA: "CMP",
        NOTEBOOK: "NTB",
        MONITOR: "MON",
        IMPRESSORA: "IMP",
        SERVIDOR: "SRV",
        ROTEADOR: "RTR",
        CABO_ESTRUTURADO: "CAB",
        FONTE_ALIMENTACAO: "FNT"
    };
    estadosFisicos = [
        EstadoFisico.NOVO,
        EstadoFisico.BOM_ESTADO,
        EstadoFisico.USADO_LEVE,
        EstadoFisico.USADO_MODERADO,
        EstadoFisico.DANIFICADO_LEVE,
        EstadoFisico.DANIFICADO_GRAVE,
        EstadoFisico.INSERVIVEL
    ];
    validarTexto(valor, campo, obrigatorio = false) {
        if (valor === undefined)
            return undefined;
        const texto = valor.trim();
        if (obrigatorio && !texto) {
            throw new AppError(`O campo ${campo} é obrigatório.`, 400, "CAMPO_OBRIGATORIO");
        }
        return texto;
    }
    validarAno(ano) {
        if (!Number.isInteger(ano) ||
            ano < 1900 ||
            ano > new Date().getFullYear()) {
            throw new AppError("Ano de fabricação inválido.", 400, "ANO_INVALIDO");
        }
    }
    validarPeso(peso) {
        if (!Number.isFinite(peso) || peso < 0) {
            throw new AppError("Peso deve ser um número maior ou igual a zero.", 400, "PESO_INVALIDO");
        }
    }
    validarPosicao(posicao) {
        if (!Number.isInteger(posicao) || posicao < 0) {
            throw new AppError("Posição no lote deve ser um inteiro maior ou igual a zero.", 400, "POSICAO_INVALIDA");
        }
    }
    gerarCodigoBarras(tipo, sequencia) {
        const prefixo = this.prefixos[tipo];
        if (!prefixo) {
            throw new AppError("Tipo de equipamento inválido.", 400, "TIPO_INVALIDO");
        }
        if (sequencia !== undefined) {
            return gerarCodigoBarrasSequencial(tipo, sequencia);
        }
        return `${prefixo}-${new Date().getFullYear()}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
    }
    async cadastrarEquipamento(dados, usuarioId = null) {
        if (!dados.loteId?.trim()) {
            throw new AppError("O lote é obrigatório.", 400, "LOTE_OBRIGATORIO");
        }
        if (!Object.values(TipoEquipamento).includes(dados.tipo)) {
            throw new AppError("Tipo de equipamento inválido.", 400, "TIPO_INVALIDO");
        }
        const ano = dados.anoFabricacao;
        this.validarAno(ano);
        const peso = dados.pesoQuilogramas ?? 0;
        this.validarPeso(peso);
        const posicao = dados.posicaoNoLote ?? 0;
        this.validarPosicao(posicao);
        const estado = dados.estadoFisico ?? EstadoFisico.NOVO;
        if (!this.estadosFisicos.includes(estado)) {
            throw new AppError("Estado físico inválido.", 400, "ESTADO_FISICO_INVALIDO");
        }
        const lote = await prisma.lote.findUnique({
            where: { id: dados.loteId }
        });
        if (!lote) {
            throw new AppError("Lote não encontrado.", 404, "LOTE_NAO_ENCONTRADO");
        }
        if (lote.statusProcessamento === "CANCELADO" ||
            lote.statusProcessamento === "FINALIZADO") {
            throw new AppError("Não é possível cadastrar equipamentos em um lote cancelado ou finalizado.", 409, "LOTE_NAO_RECEBE_EQUIPAMENTOS");
        }
        return prisma.$transaction(async (tx) => {
            const equipamento = await tx.equipamento.create({
                data: {
                    codigoBarrasInterno: this.gerarCodigoBarras(dados.tipo),
                    tipo: dados.tipo,
                    marca: this.validarTexto(dados.marca, "marca") ?? "",
                    modelo: this.validarTexto(dados.modelo, "modelo") ?? "",
                    anoFabricacao: ano,
                    estadoFisico: estado,
                    pesoQuilogramas: peso,
                    loteId: dados.loteId,
                    posicaoNoLote: posicao,
                    statusRastreamento: StatusRastreamento.AGUARDANDO_TRIAGEM
                },
                include: {
                    lote: true,
                    historicoMovimentacao: true
                }
            });
            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: "CRIAR",
                    entidade: "Equipamento",
                    entidadeId: equipamento.id,
                    detalhes: {
                        codigoBarrasInterno: equipamento.codigoBarrasInterno,
                        tipo: equipamento.tipo,
                        loteId: equipamento.loteId,
                        marca: equipamento.marca,
                        modelo: equipamento.modelo,
                        anoFabricacao: equipamento.anoFabricacao,
                        estadoFisico: equipamento.estadoFisico,
                        statusRastreamento: equipamento.statusRastreamento
                    }
                }
            });
            return equipamento;
        });
    }
    async listarEquipamentos(filtros = {}) {
        const where = {};
        if (filtros.loteId)
            where.loteId = filtros.loteId;
        if (filtros.tipo)
            where.tipo = filtros.tipo;
        if (filtros.estadoFisico)
            where.estadoFisico = filtros.estadoFisico;
        if (filtros.statusRastreamento) {
            where.statusRastreamento = filtros.statusRastreamento;
        }
        if (filtros.busca) {
            where.OR = [
                { marca: { contains: filtros.busca, mode: "insensitive" } },
                { modelo: { contains: filtros.busca, mode: "insensitive" } },
                { codigoBarrasInterno: { contains: filtros.busca, mode: "insensitive" } }
            ];
        }
        return prisma.equipamento.findMany({
            where,
            include: {
                lote: true,
                historicoMovimentacao: {
                    orderBy: { dataHora: "desc" }
                }
            },
            orderBy: { codigoBarrasInterno: "asc" }
        });
    }
    async buscarEquipamento(id) {
        const equipamento = await prisma.equipamento.findUnique({
            where: { id },
            include: {
                lote: true,
                historicoMovimentacao: {
                    orderBy: { dataHora: "desc" }
                }
            }
        });
        if (!equipamento) {
            throw new AppError("Equipamento não encontrado.", 404, "EQUIPAMENTO_NAO_ENCONTRADO");
        }
        return equipamento;
    }
    async editarEquipamento(id, dados, usuarioId = null) {
        const equipamento = await this.buscarEquipamento(id);
        if (dados.anoFabricacao !== undefined) {
            this.validarAno(dados.anoFabricacao);
        }
        if (dados.pesoQuilogramas !== undefined) {
            this.validarPeso(dados.pesoQuilogramas);
        }
        if (dados.posicaoNoLote !== undefined) {
            this.validarPosicao(dados.posicaoNoLote);
        }
        return prisma.$transaction(async (tx) => {
            const atualizado = await tx.equipamento.update({
                where: { id },
                data: {
                    ...(dados.tipo !== undefined && { tipo: dados.tipo }),
                    ...(dados.marca !== undefined && {
                        marca: this.validarTexto(dados.marca, "marca")
                    }),
                    ...(dados.modelo !== undefined && {
                        modelo: this.validarTexto(dados.modelo, "modelo")
                    }),
                    ...(dados.anoFabricacao !== undefined && {
                        anoFabricacao: dados.anoFabricacao
                    }),
                    ...(dados.pesoQuilogramas !== undefined && {
                        pesoQuilogramas: dados.pesoQuilogramas
                    }),
                    ...(dados.posicaoNoLote !== undefined && {
                        posicaoNoLote: dados.posicaoNoLote
                    })
                },
                include: {
                    lote: true,
                    historicoMovimentacao: {
                        orderBy: { dataHora: "desc" }
                    }
                }
            });
            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: "EDITAR",
                    entidade: "Equipamento",
                    entidadeId: id,
                    detalhes: {
                        camposAlterados: Object.keys(dados),
                        antes: {
                            tipo: equipamento.tipo,
                            marca: equipamento.marca,
                            modelo: equipamento.modelo,
                            anoFabricacao: equipamento.anoFabricacao,
                            pesoQuilogramas: equipamento.pesoQuilogramas,
                            posicaoNoLote: equipamento.posicaoNoLote
                        },
                        depois: {
                            tipo: atualizado.tipo,
                            marca: atualizado.marca,
                            modelo: atualizado.modelo,
                            anoFabricacao: atualizado.anoFabricacao,
                            pesoQuilogramas: atualizado.pesoQuilogramas,
                            posicaoNoLote: atualizado.posicaoNoLote
                        }
                    }
                }
            });
            return atualizado;
        });
    }
    async atualizarEstadoFisico(id, novoEstado, observacao = "", responsavel = "SISTEMA", usuarioId = null) {
        const equipamento = await this.buscarEquipamento(id);
        if (!this.estadosFisicos.includes(novoEstado)) {
            throw new AppError("Estado físico inválido.", 400, "ESTADO_FISICO_INVALIDO");
        }
        const estadoAtual = this.estadosFisicos.indexOf(equipamento.estadoFisico);
        const estadoNovo = this.estadosFisicos.indexOf(novoEstado);
        if (estadoNovo - estadoAtual >= 2 && !observacao.trim()) {
            throw new AppError("É obrigatória uma observacao quando o estado físico piora duas ou mais categorias.", 400, "observacao_OBRIGATORIA");
        }
        if (novoEstado === EstadoFisico.INSERVIVEL &&
            equipamento.statusRastreamento !== StatusRastreamento.EM_TRIAGEM &&
            equipamento.statusRastreamento !== StatusRastreamento.AGUARDANDO_DESMONTE) {
            throw new AppError("Equipamento inservível deve estar em triagem ou aguardando desmonte.", 409, "ESTADO_FISICO_NAO_PERMITIDO");
        }
        return prisma.$transaction(async (tx) => {
            const atualizado = await tx.equipamento.update({
                where: { id },
                data: { estadoFisico: novoEstado }
            });
            const movimentacao = await tx.movimentacao.create({
                data: {
                    equipamentoId: id,
                    origem: `ESTADO_FISICO:${equipamento.estadoFisico}`,
                    destino: `ESTADO_FISICO:${novoEstado}`,
                    responsavel: responsavel.trim(),
                    observacao: observacao.trim()
                }
            });
            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: "ALTERAR_ESTADO_FISICO",
                    entidade: "Movimentacao",
                    entidadeId: movimentacao.id,
                    detalhes: {
                        estadoAnterior: equipamento.estadoFisico,
                        estadoNovo: novoEstado,
                        responsavel: responsavel.trim(),
                        observacao: observacao.trim()
                    }
                }
            });
            return atualizado;
        });
    }
    async atualizarStatus(id, novoStatus, responsavel, observacao = "", usuarioId = null) {
        const equipamento = await this.buscarEquipamento(id);
        if (!Object.values(StatusRastreamento).includes(novoStatus)) {
            throw new AppError("Status de rastreamento inválido.", 400, "STATUS_INVALIDO");
        }
        if (!responsavel.trim()) {
            throw new AppError("O responsável é obrigatório.", 400, "RESPONSAVEL_OBRIGATORIO");
        }
        if (novoStatus === StatusRastreamento.AGUARDANDO_DESMONTE &&
            equipamento.statusRastreamento !== StatusRastreamento.EM_TRIAGEM) {
            throw new AppError("O equipamento precisa passar por triagem antes de aguardar desmonte.", 409, "TRANSICAO_STATUS_INVALIDA");
        }
        if (equipamento.estadoFisico === EstadoFisico.INSERVIVEL &&
            novoStatus !== StatusRastreamento.EM_TRIAGEM &&
            novoStatus !== StatusRastreamento.AGUARDANDO_DESMONTE) {
            throw new AppError("Equipamento inservível deve estar em triagem ou aguardando desmonte.", 409, "STATUS_NAO_PERMITIDO");
        }
        return prisma.$transaction(async (tx) => {
            const atualizado = await tx.equipamento.update({
                where: { id },
                data: { statusRastreamento: novoStatus }
            });
            const movimentacao = await tx.movimentacao.create({
                data: {
                    equipamentoId: id,
                    origem: equipamento.statusRastreamento,
                    destino: novoStatus,
                    responsavel: responsavel.trim(),
                    observacao: observacao.trim()
                }
            });
            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: "ALTERAR_RASTREAMENTO",
                    entidade: "Movimentacao",
                    entidadeId: movimentacao.id,
                    detalhes: {
                        statusAnterior: equipamento.statusRastreamento,
                        statusNovo: novoStatus,
                        responsavel: responsavel.trim(),
                        observacao: observacao.trim()
                    }
                }
            });
            return atualizado;
        });
    }
    async registrarMovimentacao(id, destino, responsavel, observacao = "", usuarioId = null) {
        const equipamento = await this.buscarEquipamento(id);
        const destinoLimpo = destino.trim();
        const responsavelLimpo = responsavel.trim();
        if (!destinoLimpo || !responsavelLimpo) {
            throw new AppError("Destino e responsável são obrigatórios.", 400, "DADOS_MOVIMENTACAO_INVALIDOS");
        }
        const ultimaMovimentacao = equipamento.historicoMovimentacao[0];
        return prisma.$transaction(async (tx) => {
            const movimentacao = await tx.movimentacao.create({
                data: {
                    equipamentoId: id,
                    origem: ultimaMovimentacao?.destino ?? "RECEBIMENTO",
                    destino: destinoLimpo,
                    responsavel: responsavelLimpo,
                    observacao: observacao.trim()
                }
            });
            await tx.registroAuditoria.create({
                data: {
                    usuarioId,
                    acao: "MOVIMENTAR",
                    entidade: "Movimentacao",
                    entidadeId: movimentacao.id,
                    detalhes: {
                        equipamentoId: id,
                        origem: movimentacao.origem,
                        destino: movimentacao.destino,
                        responsavel: movimentacao.responsavel,
                        observacao: movimentacao.observacao
                    }
                }
            });
            return movimentacao;
        });
    }
    async rastrearEquipamento(id) {
        const equipamento = await this.buscarEquipamento(id);
        return {
            movimentacoes: equipamento.historicoMovimentacao
        };
    }
    async excluirEquipamento(id, usuarioId = null) {
        return prisma.$transaction(async (tx) => {
            const equipamento = await tx.equipamento.findUnique({
                where: { id }, include: { historicoMovimentacao: true }
            });
            if (!equipamento)
                throw new AppError("Equipamento não encontrado.", 404, "EQUIPAMENTO_NAO_ENCONTRADO");
            await tx.registroAuditoria.create({ data: {
                    usuarioId, acao: "EXCLUIR", entidade: "Equipamento", entidadeId: id,
                    detalhes: { codigoBarrasInterno: equipamento.codigoBarrasInterno, loteId: equipamento.loteId, movimentacoesRemovidas: equipamento.historicoMovimentacao.length }
                } });
            await tx.movimentacao.deleteMany({ where: { equipamentoId: id } });
            await tx.equipamento.delete({ where: { id } });
            return { id, codigoBarrasInterno: equipamento.codigoBarrasInterno };
        });
    }
    calcularDepreciacao(anoFabricacao, coeficiente = 0.1) {
        this.validarAno(anoFabricacao);
        if (!Number.isFinite(coeficiente) ||
            coeficiente < 0 ||
            coeficiente > 1) {
            throw new AppError("Coeficiente de depreciação deve estar entre 0 e 1.", 400, "COEFICIENTE_INVALIDO");
        }
        const idade = Math.max(0, new Date().getFullYear() - anoFabricacao);
        return Math.min(0.9, idade * coeficiente);
    }
}
