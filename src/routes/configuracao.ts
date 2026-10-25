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
        const { aliquotaImposto, coeficienteDepreciacao } = req.body ?? {};

        if (
            typeof aliquotaImposto !== "number" ||
            typeof coeficienteDepreciacao !== "number"
        ) {
            throw new AppError(
                "Informe aliquotaImposto e coeficienteDepreciacao como números.",
                400,
                "CORPO_INVALIDO"
            );
        }

        const configuracao = await servico.atualizarConfiguracao(
            {
                aliquotaImposto,
                coeficienteDepreciacao
            },
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
