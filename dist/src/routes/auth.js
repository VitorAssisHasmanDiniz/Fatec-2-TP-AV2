import { Router } from "express";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import ServicoAutenticacao from "../services/ServicoAutenticacao.js";
import AppError from "../errors/AppError.js";
import autenticar from "../middlewares/autenticar.js";
import { prisma } from "../lib/prisma.js";
const router = Router();
const servicoAutenticacao = new ServicoAutenticacao();
const limiteLogin = rateLimit({
    windowMs: 2 * 60 * 60 * 1000, // 2 Horas
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: async (req, _res, next) => {
        try {
            await prisma.registroAuditoria.create({
                data: {
                    acao: "LOGIN_BLOQUEADO",
                    entidade: "Autenticacao",
                    detalhes: {
                        motivo: "LIMITE_LOGIN_EXCEDIDO"
                    },
                    ip: req.ip ?? null,
                    userAgent: req.get("user-agent") ?? null
                }
            });
        }
        catch {
            // A falha na auditoria não deve ocultar o bloqueio de segurança.
        }
        next(new AppError("Você errou a senha muitas vezes, vai ter q esperar paizão", 429, "LIMITE_LOGIN_EXCEDIDO"));
    },
});
router.post("/login", limiteLogin, async (req, res, next) => {
    try {
        const { nome, usuario, senha } = req.body;
        if (typeof usuario !== "string" ||
            typeof senha !== "string" ||
            !usuario.trim() ||
            !senha) {
            throw new AppError("Informe usuário e senha.", 400, "DADOS_INVALIDOS");
        }
        const resultado = await servicoAutenticacao.autenticar(usuario.trim(), senha, req.ip, req.get("user-agent") ?? undefined);
        res.json({
            nivel: "SUCESSO",
            mensagem: `Bem vindo ${resultado.usuario.nome}!`,
            dados: resultado,
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.patch("/senha", autenticar, async (req, res, next) => {
    try {
        const requisicao = req;
        const { senhaAtual, senhaNova, confirmarSenha } = req.body ?? {};
        if (typeof senhaAtual !== "string" || typeof senhaNova !== "string" || typeof confirmarSenha !== "string") {
            throw new AppError("Informe senhaAtual, senhaNova e confirmarSenha.", 400, "DADOS_INVALIDOS");
        }
        if (senhaNova.length < 8)
            throw new AppError("A nova senha deve ter pelo menos 8 caracteres.", 400, "SENHA_INVALIDA");
        if (senhaNova !== confirmarSenha)
            throw new AppError("A nova senha e a confirmação não coincidem.", 400, "SENHAS_DIFERENTES");
        if (senhaAtual === senhaNova)
            throw new AppError("A nova senha deve ser diferente da senha atual.", 400, "SENHA_IGUAL");
        await prisma.$transaction(async (tx) => {
            const usuario = await tx.usuario.findUnique({ where: { id: requisicao.usuario.id } });
            if (!usuario || !usuario.ativo)
                throw new AppError("Usuário não encontrado ou inativo.", 401, "USUARIO_INVALIDO");
            const confere = await bcrypt.compare(senhaAtual, usuario.senhaHash);
            if (!confere)
                throw new AppError("Senha atual inválida.", 401, "SENHA_ATUAL_INVALIDA");
            const senhaHash = await bcrypt.hash(senhaNova, 12);
            await tx.usuario.update({ where: { id: usuario.id }, data: { senhaHash } });
            await tx.registroAuditoria.create({ data: { usuarioId: usuario.id, acao: "ALTERAR_SENHA", entidade: "Usuario", entidadeId: usuario.id, detalhes: { alteradaPeloProprioUsuario: true }, ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null } });
        });
        return res.status(200).json({ nivel: "SUCESSO", mensagem: "Senha alterada com sucesso." });
    }
    catch (erro) {
        next(erro);
    }
});
router.get("/me", autenticar, async (req, res, next) => {
    try {
        const requisicao = req;
        const usuario = await prisma.usuario.findUnique({
            where: { id: requisicao.usuario.id },
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
            throw new AppError("Usuário não encontrado ou inativo", 401, "USUARIO_INVALIDO");
        }
        res.json({
            nivel: "SUCESSO",
            mensagem: "Usuário autenticado recuperado com sucesso",
            dados: usuario,
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.post("/logout", autenticar, async (req, res, next) => {
    try {
        const requisicao = req;
        await prisma.registroAuditoria.create({
            data: {
                usuarioId: requisicao.usuario.id,
                acao: "LOGOUT",
                entidade: "Autenticacao",
                entidadeId: requisicao.usuario.id,
                detalhes: {
                    motivo: "LOGOUT_SOLICITADO"
                },
                ip: req.ip ?? null,
                userAgent: req.get("user-agent") ?? null
            }
        });
        return res.status(200).json({
            nivel: "SUCESSO",
            mensagem: "Logout registrado. Descarte o token no cliente."
        });
    }
    catch (erro) {
        next(erro);
    }
});
export default router;
