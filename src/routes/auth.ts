import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import ServicoAutenticacao from "../services/ServicoAutenticacao.js";
import AppError from "../errors/AppError.js";

const router = Router();
const servicoAutenticacao = new ServicoAutenticacao();

const limiteLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
        next(
            new AppError(
                "Você errou a senha muitas vezes, vai ter q esperar paizão",
                429,
                "LIMITE_LOGIN_EXCEDIDO"
            )
        );
    },
});

router.post("/login", limiteLogin, async (req, res, next) => {
    try {
        const { usuario, senha } = req.body;

        if (
            typeof usuario !== "string" ||
            typeof senha !== "string" ||
            !usuario.trim() ||
            !senha
        ) {
            throw new AppError(
                "Informe usuário e senha.",
                400,
                "DADOS_INVALIDOS"
            );
        }

        const resultado = await servicoAutenticacao.autenticar(
            usuario.trim(),
            senha
        );

        res.json({
            nivel: "SUCESSO",
            mensagem: `Bem vindo ${resultado.usuario.usuario}!`,
            dados: resultado,
        });
    } catch (erro) {
        next(erro);
    }
});

export default router;
