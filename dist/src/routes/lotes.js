import { Router } from "express";
import ServicoLote from "../services/ServicoLote.js";
import autenticar from "../middlewares/autenticar.js";
import autorizar from "../middlewares/autorizar.js";
import AppError from "../errors/AppError.js";
const router = Router();
const servico = new ServicoLote();
router.use(autenticar, autorizar("ADMINISTRADOR", "GESTOR_ALMOXARIFADO"));
router.get("/", async (req, res, next) => {
    try {
        const { status, dataInicio, dataFim, nf } = req.query;
        const statusPermitidos = [
            "RECEBIDO",
            "EM_TRIAGEM",
            "TRIAGEM_CONCLUIDA",
            "ENCAMINHADO",
            "FINALIZADO",
            "CANCELADO"
        ];
        let statusFiltro;
        if (status !== undefined) {
            if (typeof status !== "string" ||
                !statusPermitidos.includes(status)) {
                throw new AppError("Status inválido.", 400, "STATUS_INVALIDO");
            }
            statusFiltro = status;
        }
        if ((dataInicio !== undefined && typeof dataInicio !== "string") ||
            (dataFim !== undefined && typeof dataFim !== "string")) {
            throw new AppError("As datas devem ser informadas no formato ISO.", 400, "PERIODO_INVALIDO");
        }
        const inicio = typeof dataInicio === "string"
            ? new Date(dataInicio)
            : undefined;
        const fim = typeof dataFim === "string"
            ? new Date(dataFim)
            : undefined;
        if ((inicio && Number.isNaN(inicio.getTime())) ||
            (fim && Number.isNaN(fim.getTime()))) {
            throw new AppError("Informe datas válidas para o período.", 400, "PERIODO_INVALIDO");
        }
        if (inicio && fim && inicio.getTime() > fim.getTime()) {
            throw new AppError("A data inicial não pode ser posterior à data final.", 400, "PERIODO_INVALIDO");
        }
        if (nf !== undefined && (typeof nf !== "string" || !nf.trim())) {
            throw new AppError("O filtro nf deve ser um texto não vazio.", 400, "FILTRO_INVALIDO");
        }
        const lotes = await servico.listarLotes({
            status: statusFiltro,
            dataInicio: inicio,
            dataFim: fim,
            notaFiscal: typeof nf === "string" ? nf.trim() : undefined
        });
        return res.status(200).json({
            nivel: "SUCESSO",
            mensagem: "Lotes consultados com sucesso.",
            dados: lotes
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.get("/:id", async (req, res, next) => {
    try {
        const lote = await servico.buscarLote(req.params.id);
        return res.status(200).json({
            nivel: "SUCESSO",
            mensagem: "Lote consultado com sucesso.",
            dados: lote
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.post("/", async (req, res, next) => {
    try {
        const { org, nf, transp, dataEntrada, observacoes } = req.body;
        if (typeof org !== "string" ||
            typeof nf !== "string" ||
            typeof transp !== "string") {
            throw new AppError("Informe org, nf e transp como textos.", 400, "CORPO_INVALIDO");
        }
        if (dataEntrada !== undefined &&
            typeof dataEntrada !== "string") {
            throw new AppError("dataEntrada deve ser uma data em formato ISO.", 400, "CORPO_INVALIDO");
        }
        if (observacoes !== undefined &&
            typeof observacoes !== "string") {
            throw new AppError("observacoes deve ser um texto.", 400, "CORPO_INVALIDO");
        }
        const requisicao = req;
        const lote = await servico.criarLote({
            org,
            nf,
            transp,
            dataEntrada: dataEntrada === undefined
                ? undefined
                : new Date(dataEntrada),
            observacoes
        }, requisicao.usuario.id);
        return res.status(201).json({
            nivel: "SUCESSO",
            mensagem: "Lote cadastrado com sucesso.",
            dados: lote
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.post("/:id/triagem", async (req, res, next) => {
    try {
        const requisicao = req;
        const lote = await servico.processarTriagem(req.params.id, requisicao.usuario.id);
        return res.status(200).json({ nivel: "SUCESSO", mensagem: "Triagem do lote concluída com sucesso.", dados: lote });
    }
    catch (erro) {
        next(erro);
    }
});
router.delete("/:id", autorizar("ADMINISTRADOR"), async (req, res, next) => {
    try {
        const requisicao = req;
        const lote = await servico.excluirLote(String(req.params.id), requisicao.usuario.id);
        return res.status(200).json({ nivel: "SUCESSO", mensagem: "Lote excluído com sucesso.", dados: lote });
    }
    catch (erro) {
        next(erro);
    }
});
router.patch("/:id/cancelar", async (req, res, next) => {
    try {
        const requisicao = req;
        const lote = await servico.cancelarLote(req.params.id, requisicao.usuario.id);
        return res.status(200).json({
            nivel: "SUCESSO",
            mensagem: "Lote cancelado com sucesso.",
            dados: lote
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.patch("/:id", async (req, res, next) => {
    try {
        const { org, nf, transp, dataEntrada, observacoes } = req.body;
        if ((org !== undefined && typeof org !== "string") ||
            (nf !== undefined && typeof nf !== "string") ||
            (transp !== undefined && typeof transp !== "string") ||
            (dataEntrada !== undefined && typeof dataEntrada !== "string") ||
            (observacoes !== undefined && typeof observacoes !== "string")) {
            throw new AppError("Os campos enviados possuem tipos inválidos.", 400, "CORPO_INVALIDO");
        }
        const dados = {
            org,
            nf,
            transp,
            dataEntrada: dataEntrada === undefined
                ? undefined
                : new Date(dataEntrada),
            observacoes
        };
        const requisicao = req;
        const lote = await servico.editarLote(req.params.id, dados, requisicao.usuario.id);
        return res.status(200).json({
            nivel: "SUCESSO",
            mensagem: "Lote atualizado com sucesso.",
            dados: lote
        });
    }
    catch (erro) {
        next(erro);
    }
});
export default router;
