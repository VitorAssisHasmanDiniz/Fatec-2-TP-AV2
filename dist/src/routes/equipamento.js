import { Router } from "express";
import { EstadoFisico, StatusRastreamento, TipoEquipamento } from "../../generated/prisma/client.js";
import ServicoEquipamento from "../services/ServicoEquipamento.js";
import autenticar from "../middlewares/autenticar.js";
import autorizar from "../middlewares/autorizar.js";
const router = Router();
const servico = new ServicoEquipamento();
router.use(autenticar);
function validarObjeto(valor) {
    return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}
function validarEnum(enumeracao, valor) {
    return typeof valor === "string" && Object.values(enumeracao).includes(valor);
}
function validarTexto(valor) {
    return typeof valor === "string" && valor.trim().length > 0;
}
function validarNumero(valor) {
    return typeof valor === "number" && Number.isFinite(valor);
}
function responderErroEntrada(res, mensagem) {
    return res.status(400).json({
        nivel: "ERRO",
        mensagem,
        codigo: "DADOS_INVALIDOS"
    });
}
function obterId(req, res) {
    const id = req.params.id;
    if (typeof id !== "string" || !id.trim()) {
        responderErroEntrada(res, "ID do equipamento inválido.");
        return null;
    }
    return id;
}
// Listar equipamentos
router.get("/", autorizar("ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"), async (req, res) => {
    const filtros = {};
    if (req.query.loteId !== undefined) {
        if (!validarTexto(req.query.loteId)) {
            return responderErroEntrada(res, "O filtro loteId deve ser um texto.");
        }
        filtros.loteId = req.query.loteId;
    }
    if (req.query.tipo !== undefined) {
        if (!validarEnum(TipoEquipamento, req.query.tipo)) {
            return responderErroEntrada(res, "Filtro tipo inválido.");
        }
        filtros.tipo = req.query.tipo;
    }
    if (req.query.estadoFisico !== undefined) {
        if (!validarEnum(EstadoFisico, req.query.estadoFisico)) {
            return responderErroEntrada(res, "Filtro estadoFisico inválido.");
        }
        filtros.estadoFisico = req.query.estadoFisico;
    }
    if (req.query.statusRastreamento !== undefined) {
        if (!validarEnum(StatusRastreamento, req.query.statusRastreamento)) {
            return responderErroEntrada(res, "Filtro statusRastreamento inválido.");
        }
        filtros.statusRastreamento = req.query.statusRastreamento;
    }
    const equipamentos = await servico.listarEquipamentos(filtros);
    return res.status(200).json({
        nivel: "SUCESSO",
        mensagem: "Equipamentos consultados com sucesso.",
        dados: equipamentos
    });
});
// Buscar histórico do equipamento
router.get("/:id/rastreamento", autorizar("ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"), async (req, res) => {
    const id = obterId(req, res);
    if (id === null)
        return;
    const historico = await servico.rastrearEquipamento(id);
    return res.status(200).json({
        nivel: "SUCESSO",
        mensagem: "Rastreamento consultado com sucesso.",
        dados: historico
    });
});
// Calcular depreciação do equipamento
router.get("/:id/depreciacao", autorizar("ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"), async (req, res) => {
    const id = obterId(req, res);
    if (id === null)
        return;
    const equipamento = await servico.buscarEquipamento(id);
    const depreciacao = servico.calcularDepreciacao(equipamento.anoFabricacao);
    return res.status(200).json({
        nivel: "SUCESSO",
        mensagem: "Depreciação calculada com sucesso.",
        dados: {
            equipamentoId: equipamento.id,
            codigoBarrasInterno: equipamento.codigoBarrasInterno,
            anoFabricacao: equipamento.anoFabricacao,
            depreciacao,
            percentualDepreciacao: depreciacao * 100
        }
    });
});
// Buscar equipamento por ID
router.get("/:id", autorizar("ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"), async (req, res) => {
    const id = obterId(req, res);
    if (id === null)
        return;
    const equipamento = await servico.buscarEquipamento(id);
    return res.status(200).json({
        nivel: "SUCESSO",
        mensagem: "Equipamento consultado com sucesso.",
        dados: equipamento
    });
});
// Cadastrar equipamento
router.post("/", autorizar("ADMINISTRADOR", "OPERADOR_CADASTRO"), async (req, res) => {
    if (!validarObjeto(req.body)) {
        return responderErroEntrada(res, "O corpo da requisição deve ser um objeto JSON.");
    }
    const dados = req.body;
    if (!validarEnum(TipoEquipamento, dados.tipo)) {
        return responderErroEntrada(res, "Tipo de equipamento inválido.");
    }
    if (!validarTexto(dados.loteId)) {
        return responderErroEntrada(res, "O lote é obrigatório.");
    }
    if (!validarNumero(dados.anoFabricacao)) {
        return responderErroEntrada(res, "Ano de fabricação deve ser um número.");
    }
    if (dados.marca !== undefined && typeof dados.marca !== "string") {
        return responderErroEntrada(res, "Marca deve ser um texto.");
    }
    if (dados.modelo !== undefined && typeof dados.modelo !== "string") {
        return responderErroEntrada(res, "Modelo deve ser um texto.");
    }
    if (dados.estadoFisico !== undefined && !validarEnum(EstadoFisico, dados.estadoFisico)) {
        return responderErroEntrada(res, "Estado físico inválido.");
    }
    if (dados.pesoQuilogramas !== undefined && !validarNumero(dados.pesoQuilogramas)) {
        return responderErroEntrada(res, "Peso deve ser um número.");
    }
    if (dados.posicaoNoLote !== undefined && !validarNumero(dados.posicaoNoLote)) {
        return responderErroEntrada(res, "Posição no lote deve ser um número.");
    }
    const dadosEquipamento = {
        tipo: dados.tipo,
        loteId: dados.loteId,
        anoFabricacao: dados.anoFabricacao,
        ...(typeof dados.marca === "string" && { marca: dados.marca }),
        ...(typeof dados.modelo === "string" && { modelo: dados.modelo }),
        ...(validarEnum(EstadoFisico, dados.estadoFisico) && { estadoFisico: dados.estadoFisico }),
        ...(typeof dados.pesoQuilogramas === "number" && { pesoQuilogramas: dados.pesoQuilogramas }),
        ...(typeof dados.posicaoNoLote === "number" && { posicaoNoLote: dados.posicaoNoLote })
    };
    const equipamento = await servico.cadastrarEquipamento(dadosEquipamento);
    return res.status(201).json({
        nivel: "SUCESSO",
        mensagem: "Equipamento cadastrado com sucesso.",
        dados: equipamento
    });
});
// Registrar movimentação do equipamento
router.post("/:id/movimentacoes", autorizar("ADMINISTRADOR", "GESTOR_ALMOXARIFADO"), async (req, res) => {
    const id = obterId(req, res);
    if (id === null)
        return;
    if (!validarObjeto(req.body) ||
        !validarTexto(req.body.destino) ||
        !validarTexto(req.body.responsavel)) {
        return responderErroEntrada(res, "Destino e responsável são obrigatórios.");
    }
    if (req.body.observacao !== undefined && typeof req.body.observacao !== "string") {
        return responderErroEntrada(res, "Observação deve ser um texto.");
    }
    const movimentacao = await servico.registrarMovimentacao(id, req.body.destino, req.body.responsavel, typeof req.body.observacao === "string" ? req.body.observacao : "");
    return res.status(201).json({
        nivel: "SUCESSO",
        mensagem: "Movimentação registrada com sucesso.",
        dados: movimentacao
    });
});
// Atualizar dados básicos
router.patch("/:id", autorizar("ADMINISTRADOR", "OPERADOR_CADASTRO"), async (req, res) => {
    const id = obterId(req, res);
    if (id === null)
        return;
    if (!validarObjeto(req.body)) {
        return responderErroEntrada(res, "O corpo da requisição deve ser um objeto JSON.");
    }
    const dados = req.body;
    const permitidos = ["marca", "modelo", "anoFabricacao", "pesoQuilogramas", "posicaoNoLote"];
    const campos = Object.keys(dados);
    if (campos.length === 0 || campos.some((campo) => !permitidos.includes(campo))) {
        return responderErroEntrada(res, "Informe ao menos um campo permitido para edição.");
    }
    if (dados.marca !== undefined && typeof dados.marca !== "string") {
        return responderErroEntrada(res, "Marca deve ser um texto.");
    }
    if (dados.modelo !== undefined && typeof dados.modelo !== "string") {
        return responderErroEntrada(res, "Modelo deve ser um texto.");
    }
    if (dados.anoFabricacao !== undefined && !validarNumero(dados.anoFabricacao)) {
        return responderErroEntrada(res, "Ano de fabricação deve ser um número.");
    }
    if (dados.pesoQuilogramas !== undefined && !validarNumero(dados.pesoQuilogramas)) {
        return responderErroEntrada(res, "Peso deve ser um número.");
    }
    if (dados.posicaoNoLote !== undefined && !validarNumero(dados.posicaoNoLote)) {
        return responderErroEntrada(res, "Posição no lote deve ser um número.");
    }
    const dadosEdicao = {
        ...(typeof dados.marca === "string" && { marca: dados.marca }),
        ...(typeof dados.modelo === "string" && { modelo: dados.modelo }),
        ...(typeof dados.anoFabricacao === "number" && { anoFabricacao: dados.anoFabricacao }),
        ...(typeof dados.pesoQuilogramas === "number" && { pesoQuilogramas: dados.pesoQuilogramas }),
        ...(typeof dados.posicaoNoLote === "number" && { posicaoNoLote: dados.posicaoNoLote })
    };
    const equipamento = await servico.editarEquipamento(id, dadosEdicao);
    return res.status(200).json({
        nivel: "SUCESSO",
        mensagem: "Equipamento atualizado com sucesso.",
        dados: equipamento
    });
});
// Atualizar estado físico
router.patch("/:id/estado-fisico", autorizar("ADMINISTRADOR", "GESTOR_ALMOXARIFADO"), async (req, res) => {
    const id = obterId(req, res);
    if (id === null)
        return;
    if (!validarObjeto(req.body) || !validarEnum(EstadoFisico, req.body.novoEstado)) {
        return responderErroEntrada(res, "Informe um novoEstado válido.");
    }
    if (req.body.justificativa !== undefined && typeof req.body.justificativa !== "string") {
        return responderErroEntrada(res, "Justificativa deve ser um texto.");
    }
    if (!validarTexto(req.body.responsavel)) {
        return responderErroEntrada(res, "Responsável é obrigatório.");
    }
    const equipamento = await servico.atualizarEstadoFisico(id, req.body.novoEstado, typeof req.body.justificativa === "string" ? req.body.justificativa : "", req.body.responsavel);
    return res.status(200).json({
        nivel: "SUCESSO",
        mensagem: "Estado físico atualizado com sucesso.",
        dados: equipamento
    });
});
// Atualizar status de rastreamento
router.patch("/:id/rastreamento", autorizar("ADMINISTRADOR", "GESTOR_ALMOXARIFADO"), async (req, res) => {
    const id = obterId(req, res);
    if (id === null)
        return;
    if (!validarObjeto(req.body) || !validarEnum(StatusRastreamento, req.body.novoStatus)) {
        return responderErroEntrada(res, "Informe um novoStatus válido.");
    }
    if (!validarTexto(req.body.responsavel)) {
        return responderErroEntrada(res, "Responsável é obrigatório.");
    }
    if (req.body.justificativa !== undefined && typeof req.body.justificativa !== "string") {
        return responderErroEntrada(res, "Justificativa deve ser um texto.");
    }
    const equipamento = await servico.atualizarStatus(id, req.body.novoStatus, req.body.responsavel, typeof req.body.justificativa === "string" ? req.body.justificativa : "");
    return res.status(200).json({
        nivel: "SUCESSO",
        mensagem: "Status de rastreamento atualizado com sucesso.",
        dados: equipamento
    });
});
export default router;
