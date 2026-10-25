import { Router } from "express";
import ServicoAuditoria from "../services/ServicoAuditoria.js";
import autenticar from "../middlewares/autenticar.js";
import autorizar from "../middlewares/autorizar.js";

const router = Router();
const servico = new ServicoAuditoria();

router.use(
    autenticar,
    autorizar("ADMINISTRADOR", "AUDITOR")
);

router.get("/", async (req, res, next) => {
    try {
        const usuarioId = typeof req.query.usuarioId === "string"
            ? req.query.usuarioId
            : undefined;

        const entidade = typeof req.query.entidade === "string"
            ? req.query.entidade
            : undefined;

        const entidadeId = typeof req.query.entidadeId === "string"
            ? req.query.entidadeId
            : undefined;

        const limiteInformado = Number(req.query.limite);
        const limite = Number.isInteger(limiteInformado) && limiteInformado > 0
            ? Math.min(limiteInformado, 500)
            : 100;

        const registros = await servico.listar({
            usuarioId,
            entidade,
            entidadeId,
            limite
        });

        return res.status(200).json({
            nivel: "SUCESSO",
            mensagem: "Registros de auditoria consultados com sucesso.",
            dados: registros
        });
    } catch (erro) {
        next(erro);
    }
});

export default router;
