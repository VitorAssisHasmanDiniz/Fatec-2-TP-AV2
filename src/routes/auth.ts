import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import ServicoAutenticacao from "../services/ServicoAutenticacao.js";
import AppError from "../errors/AppError.js";
import autenticar from "../middlewares/autenticar.js";
import type { RequisicaoAutenticada } from "../middlewares/autenticar.js";
import { prisma } from "../lib/prisma.js";

const router = Router();
const servicoAutenticacao = new ServicoAutenticacao();

const limiteLogin = rateLimit({
    windowMs: 2 * 60 * 60 * 1000, // 2 Horas
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
        const { nome, usuario, senha } = req.body;

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
            mensagem: `Bem vindo ${resultado.usuario.nome}!`,
            dados: resultado,
        });
    } catch (erro) {
        next(erro);
    }
});

router.get("/me", autenticar, async (req, res, next) => {
    try {
        const requisicao = req as RequisicaoAutenticada;

        const usuario = await prisma.usuario.findUnique({
            where: { id: requisicao.usuario!.id },
            select: {
                id: true,
                usuario: true,
                papel: true,
                ativo: true,
                ultimoAcesso: true,
                criadoEm: true,
            },
        });

        if (!usuario || !usuario.ativo) {
            throw new AppError(
                "Usuário não encontrado ou inativo",
                401,
                "USUARIO_INVALIDO"
            );
        }

        res.json({
            nivel: "SUCESSO",
            mensagem: "Usuário autenticado recuperado com sucesso",
            dados: usuario,
        });
    } catch (erro) {
        next(erro);
    }
});

export default router;
