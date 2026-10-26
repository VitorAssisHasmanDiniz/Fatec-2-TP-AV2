import { Router } from "express";
import { StatusRastreamento } from "../../generated/prisma/client.js";
import ServicoRelatorio from "../services/ServicoRelatorio.js";
import autenticar from "../middlewares/autenticar.js";
import autorizar from "../middlewares/autorizar.js";
import AppError from "../errors/AppError.js";
const router = Router();
const servico = new ServicoRelatorio();
router.use(autenticar, autorizar("ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"));
function dataQuery(valor, campo) {
    if (typeof valor !== "string" || !valor.trim())
        throw new AppError(`Informe ${campo} no formato ISO.`, 400, "DADOS_INVALIDOS");
    const data = new Date(valor);
    if (Number.isNaN(data.getTime()))
        throw new AppError(`Data inválida em ${campo}.`, 400, "DATA_INVALIDA");
    return data;
}
router.get("/organizacao", async (req, res, next) => {
    try {
        if (typeof req.query.organizacaoId !== "string")
            throw new AppError("Informe organizacaoId.", 400, "DADOS_INVALIDOS");
        const dados = await servico.porOrganizacao(req.query.organizacaoId, dataQuery(req.query.inicio, "inicio"), dataQuery(req.query.fim, "fim"));
        return res.json({ nivel: "SUCESSO", mensagem: "Relatório da organização gerado com sucesso.", dados });
    }
    catch (erro) {
        next(erro);
    }
});
router.get("/status", async (req, res, next) => {
    try {
        if (typeof req.query.status !== "string" || !Object.values(StatusRastreamento).includes(req.query.status))
            throw new AppError("Informe um status de rastreamento válido.", 400, "STATUS_INVALIDO");
        const dados = await servico.porStatus(req.query.status);
        return res.json({ nivel: "SUCESSO", mensagem: "Relatório por status gerado com sucesso.", dados });
    }
    catch (erro) {
        next(erro);
    }
});
router.get("/financeiro", async (req, res, next) => {
    try {
        const dados = await servico.financeiro(dataQuery(req.query.inicio, "inicio"), dataQuery(req.query.fim, "fim"));
        return res.json({ nivel: "SUCESSO", mensagem: "Relatório financeiro gerado com sucesso.", dados });
    }
    catch (erro) {
        next(erro);
    }
});
router.get("/rastreamento/:id", async (req, res, next) => {
    try {
        const dados = await servico.rastreamento(req.params.id);
        return res.json({ nivel: "SUCESSO", mensagem: "Relatório de rastreamento gerado com sucesso.", dados });
    }
    catch (erro) {
        next(erro);
    }
});
router.get("/journal", autorizar("ADMINISTRADOR", "AUDITOR"), async (req, res, next) => {
    try {
        const limite = req.query.limite === undefined ? 100 : Number(req.query.limite);
        if (!Number.isInteger(limite) || limite < 1 || limite > 500)
            throw new AppError("limite deve ser um inteiro entre 1 e 500.", 400, "LIMITE_INVALIDO");
        const dados = await servico.journal({
            inicio: req.query.inicio === undefined ? undefined : dataQuery(req.query.inicio, "inicio"),
            fim: req.query.fim === undefined ? undefined : dataQuery(req.query.fim, "fim"),
            entidade: typeof req.query.entidade === "string" ? req.query.entidade : undefined,
            acao: typeof req.query.acao === "string" ? req.query.acao : undefined,
            limite
        });
        return res.json({ nivel: "SUCESSO", mensagem: "Journal consultado com sucesso.", dados });
    }
    catch (erro) {
        next(erro);
    }
});
export default router;
