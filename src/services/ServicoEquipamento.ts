import crypto from "node:crypto";
import {
    EstadoFisico,
    Prisma,
    StatusRastreamento,
    TipoEquipamento
} from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export interface DadosEquipamento {
    tipo: TipoEquipamento;
    marca?: string;
    modelo?: string;
    anoFabricacao: number;
    estadoFisico?: EstadoFisico;
    pesoQuilogramas?: number;
    loteId: string;
    posicaoNoLote?: number;
}

export interface DadosEdicaoEquipamento {
    marca?: string;
    modelo?: string;
    anoFabricacao?: number;
    pesoQuilogramas?: number;
    posicaoNoLote?: number;
}

export interface FiltrosEquipamento {
    loteId?: string;
    tipo?: TipoEquipamento;
    estadoFisico?: EstadoFisico;
    statusRastreamento?: StatusRastreamento;
}

export default class ServicoEquipamento {
    private prefixos: Record<TipoEquipamento, string> = {
        COMPUTADOR_MESA: "CMP",
        NOTEBOOK: "NTB",
        MONITOR: "MON",
        IMPRESSORA: "IMP",
        SERVIDOR: "SRV",
        ROTEADOR: "RTR",
        CABO_ESTRUTURADO: "CAB",
        FONTE_ALIMENTACAO: "FNT"
    };

    private estadosFisicos: EstadoFisico[] = [
        EstadoFisico.NOVO,
        EstadoFisico.BOM_ESTADO,
        EstadoFisico.USADO_LEVE,
        EstadoFisico.USADO_MODERADO,
        EstadoFisico.DANIFICADO_LEVE,
        EstadoFisico.DANIFICADO_GRAVE,
        EstadoFisico.INSERVIVEL
    ];

    private validarTexto(valor: string | undefined, campo: string, obrigatorio = false): string | undefined {
        if (valor === undefined) return undefined;

        const texto = valor.trim();

        if (obrigatorio && !texto) {
            throw new AppError(`O campo ${campo} é obrigatório.`, 400, "CAMPO_OBRIGATORIO");
        }

        return texto;
    }

    private validarAno(ano: number): void {
        if (!Number.isInteger(ano) || ano < 1900 || ano > new Date().getFullYear()) {
            throw new AppError("Ano de fabricação inválido.", 400, "ANO_INVALIDO");
        }
    }

    private validarPeso(peso: number): void {
        if (!Number.isFinite(peso) || peso < 0) {
            throw new AppError("Peso deve ser um número maior ou igual a zero.", 400, "PESO_INVALIDO");
        }
    }

    private validarPosicao(posicao: number): void {
        if (!Number.isInteger(posicao) || posicao < 0) {
            throw new AppError("Posição no lote deve ser um inteiro maior ou igual a zero.", 400, "POSICAO_INVALIDA");
        }
    }

    private gerarCodigoBarras(tipo: TipoEquipamento): string {
        const prefixo = this.prefixos[tipo];

        if (!prefixo) {
            throw new AppError("Tipo de equipamento inválido.", 400, "TIPO_INVALIDO");
        }

        return `${prefixo}-${new Date().getFullYear()}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
    }

    async cadastrarEquipamento(dados: DadosEquipamento) {
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

        if (lote.statusProcessamento === "CANCELADO" || lote.statusProcessamento === "FINALIZADO") {
            throw new AppError("Não é possível cadastrar equipamentos em um lote cancelado ou finalizado.", 409, "LOTE_NAO_RECEBE_EQUIPAMENTOS");
        }

        const equipamento = await prisma.equipamento.create({
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

        return equipamento;
    }

    async listarEquipamentos(filtros: FiltrosEquipamento = {}) {
        const where: Prisma.EquipamentoWhereInput = {};

        if (filtros.loteId) where.loteId = filtros.loteId;
        if (filtros.tipo) where.tipo = filtros.tipo;
        if (filtros.estadoFisico) where.estadoFisico = filtros.estadoFisico;
        if (filtros.statusRastreamento) where.statusRastreamento = filtros.statusRastreamento;

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

    async buscarEquipamento(id: string) {
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

    async editarEquipamento(id: string, dados: DadosEdicaoEquipamento) {
        await this.buscarEquipamento(id);

        if (dados.anoFabricacao !== undefined) this.validarAno(dados.anoFabricacao);
        if (dados.pesoQuilogramas !== undefined) this.validarPeso(dados.pesoQuilogramas);
        if (dados.posicaoNoLote !== undefined) this.validarPosicao(dados.posicaoNoLote);

        return prisma.equipamento.update({
            where: { id },
            data: {
                ...(dados.marca !== undefined && { marca: this.validarTexto(dados.marca, "marca") }),
                ...(dados.modelo !== undefined && { modelo: this.validarTexto(dados.modelo, "modelo") }),
                ...(dados.anoFabricacao !== undefined && { anoFabricacao: dados.anoFabricacao }),
                ...(dados.pesoQuilogramas !== undefined && { pesoQuilogramas: dados.pesoQuilogramas }),
                ...(dados.posicaoNoLote !== undefined && { posicaoNoLote: dados.posicaoNoLote })
            },
            include: {
                lote: true,
                historicoMovimentacao: {
                    orderBy: { dataHora: "desc" }
                }
            }
        });
    }

    async atualizarEstadoFisico(id: string, novoEstado: EstadoFisico, observacao = "", responsavel = "SISTEMA") {
        const equipamento = await this.buscarEquipamento(id);

        if (!this.estadosFisicos.includes(novoEstado)) {
            throw new AppError("Estado físico inválido.", 400, "ESTADO_FISICO_INVALIDO");
        }

        const estadoAtual = this.estadosFisicos.indexOf(equipamento.estadoFisico);
        const estadoNovo = this.estadosFisicos.indexOf(novoEstado);

        if (estadoNovo - estadoAtual >= 2 && !observacao.trim()) {
            throw new AppError(
                "É obrigatória uma observacao quando o estado físico piora duas ou mais categorias.",
                400,
                "observacao_OBRIGATORIA"
            );
        }

        if (
            novoEstado === EstadoFisico.INSERVIVEL &&
            equipamento.statusRastreamento !== StatusRastreamento.EM_TRIAGEM &&
            equipamento.statusRastreamento !== StatusRastreamento.AGUARDANDO_DESMONTE
        ) {
            throw new AppError(
                "Equipamento inservível deve estar em triagem ou aguardando desmonte.",
                409,
                "ESTADO_FISICO_NAO_PERMITIDO"
            );
        }

        return prisma.$transaction(async (tx) => {
            const atualizado = await tx.equipamento.update({
                where: { id },
                data: { estadoFisico: novoEstado }
            });

            await tx.movimentacao.create({
                data: {
                    equipamentoId: id,
                    origem: `ESTADO_FISICO:${equipamento.estadoFisico}`,
                    destino: `ESTADO_FISICO:${novoEstado}`,
                    responsavel: responsavel.trim(),
                    observacao: observacao.trim()
                }
            });

            return atualizado;
        });
    }

    async atualizarStatus(id: string, novoStatus: StatusRastreamento, responsavel: string, observacao = "") {
        const equipamento = await this.buscarEquipamento(id);

        if (!Object.values(StatusRastreamento).includes(novoStatus)) {
            throw new AppError("Status de rastreamento inválido.", 400, "STATUS_INVALIDO");
        }

        if (!responsavel.trim()) {
            throw new AppError("O responsável é obrigatório.", 400, "RESPONSAVEL_OBRIGATORIO");
        }

        if (
            novoStatus === StatusRastreamento.AGUARDANDO_DESMONTE &&
            equipamento.statusRastreamento !== StatusRastreamento.EM_TRIAGEM
        ) {
            throw new AppError(
                "O equipamento precisa passar por triagem antes de aguardar desmonte.",
                409,
                "TRANSICAO_STATUS_INVALIDA"
            );
        }

        if (equipamento.estadoFisico === EstadoFisico.INSERVIVEL &&
            novoStatus !== StatusRastreamento.EM_TRIAGEM &&
            novoStatus !== StatusRastreamento.AGUARDANDO_DESMONTE) {
            throw new AppError(
                "Equipamento inservível deve estar em triagem ou aguardando desmonte.",
                409,
                "STATUS_NAO_PERMITIDO"
            );
        }

        return prisma.$transaction(async (tx) => {
            const atualizado = await tx.equipamento.update({
                where: { id },
                data: { statusRastreamento: novoStatus }
            });

            await tx.movimentacao.create({
                data: {
                    equipamentoId: id,
                    origem: equipamento.statusRastreamento,
                    destino: novoStatus,
                    responsavel: responsavel.trim(),
                    observacao: observacao.trim()
                }
            });

            return atualizado;
        });
    }

    async registrarMovimentacao(id: string, destino: string, responsavel: string, observacao = "") {
        const equipamento = await this.buscarEquipamento(id);
        const destinoLimpo = destino.trim();
        const responsavelLimpo = responsavel.trim();

        if (!destinoLimpo || !responsavelLimpo) {
            throw new AppError("Destino e responsável são obrigatórios.", 400, "DADOS_MOVIMENTACAO_INVALIDOS");
        }

        const ultimaMovimentacao = equipamento.historicoMovimentacao[0];

        return prisma.movimentacao.create({
            data: {
                equipamentoId: id,
                origem: ultimaMovimentacao?.destino ?? "RECEBIMENTO",
                destino: destinoLimpo,
                responsavel: responsavelLimpo,
                observacao: observacao.trim()
            }
        });
    }

    async rastrearEquipamento(id: string) {
        const equipamento = await this.buscarEquipamento(id);

        return {
            movimentacoes: equipamento.historicoMovimentacao
        };
    }

    calcularDepreciacao(anoFabricacao: number, coeficiente = 0.1) {
        this.validarAno(anoFabricacao);

        if (!Number.isFinite(coeficiente) || coeficiente < 0 || coeficiente > 1) {
            throw new AppError("Coeficiente de depreciação deve estar entre 0 e 1.", 400, "COEFICIENTE_INVALIDO");
        }

        const idade = Math.max(0, new Date().getFullYear() - anoFabricacao);
        return Math.min(0.9, idade * coeficiente);
    }
}
