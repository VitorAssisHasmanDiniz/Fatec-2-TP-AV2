import type { RequisicaoAutenticada } from "../middlewares/autenticar.js";
import { Router } from "express";
import ServicoConfiguracao from "../services/ServicoConfiguracao.js";
import autenticar from "../middlewares/autenticar.js";
import autorizar from "../middlewares/autorizar.js";
import AppError from "../errors/AppError.js";

const router = Router();
const servico = new ServicoConfiguracao();

router.use(
    autenticar,
    autorizar("ADMINISTRADOR")
);

router.get("/", async (_req, res, next) => {
    try {
        const configuracao = await servico.consultarConfiguracao();

        return res.status(200).json({
            nivel: "SUCESSO",
            mensagem: "Configuração consultada com sucesso.",
            dados: configuracao
        });
    } catch (erro) {
        next(erro);
    }
});

router.patch("/", async (req, res, next) => {
    try {
        const requisicao = req as RequisicaoAutenticada;
        const corpo = req.body ?? {};
        const permitidos = ["aliquotaImposto", "coeficienteDepreciacao"];
        if (typeof corpo !== "object" || Array.isArray(corpo) || Object.keys(corpo).length === 0 || Object.keys(corpo).some((campo) => !permitidos.includes(campo))) {
            throw new AppError("Informe aliquotaImposto e/ou coeficienteDepreciacao.", 400, "CORPO_INVALIDO");
        }
        if (corpo.aliquotaImposto !== undefined && typeof corpo.aliquotaImposto !== "number") throw new AppError("aliquotaImposto deve ser número.", 400, "CORPO_INVALIDO");
        if (corpo.coeficienteDepreciacao !== undefined && typeof corpo.coeficienteDepreciacao !== "number") throw new AppError("coeficienteDepreciacao deve ser número.", 400, "CORPO_INVALIDO");

        const configuracao = await servico.atualizarConfiguracao(
            { aliquotaImposto: corpo.aliquotaImposto, coeficienteDepreciacao: corpo.coeficienteDepreciacao },
            requisicao.usuario!.id
        );


        return res.status(200).json({
            nivel: "SUCESSO",
            mensagem: "Configuração atualizada com sucesso.",
            dados: configuracao
        });
    } catch (erro) {
        next(erro);
    }
});

export default router;
