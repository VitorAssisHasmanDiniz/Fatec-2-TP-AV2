import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
export default class ServicoAutenticacao {
    async autenticar(usuario, senha, ip, userAgent) {
        const registro = await prisma.usuario.findUnique({
            where: { usuario },
        });
        if (!registro || !registro.ativo) {
            await prisma.registroAuditoria.create({
                data: {
                    acao: "LOGIN_FALHOU",
                    entidade: "Autenticacao",
                    entidadeId: usuario,
                    detalhes: {
                        motivo: "USUARIO_INEXISTENTE_OU_INATIVO",
                    },
                    ip: ip ?? null,
                    userAgent: userAgent ?? null,
                },
            });
            throw new AppError("Usuário ou senha inválidos", 401, "CREDENCIAIS_INVALIDAS");
        }
        const senhaValida = await bcrypt.compare(senha, registro.senhaHash);
        if (!senhaValida) {
            await prisma.registroAuditoria.create({
                data: {
                    usuarioId: registro.id,
                    acao: "LOGIN_FALHOU",
                    entidade: "Autenticacao",
                    entidadeId: registro.id,
                    detalhes: {
                        motivo: "SENHA_INVALIDA",
                    },
                    ip: ip ?? null,
                    userAgent: userAgent ?? null,
                },
            });
            throw new AppError("Usuário ou senha inválidos", 401, "CREDENCIAIS_INVALIDAS");
        }
        const segredo = process.env.JWT_SECRET;
        if (!segredo) {
            throw new AppError("Configuração de autenticação indisponível", 500, "ERRO_CONFIGURACAO");
        }
        const token = jwt.sign({ papel: registro.papel }, segredo, {
            subject: registro.id,
            expiresIn: "30m",
        });
        await prisma.$transaction(async (tx) => {
            await tx.usuario.update({
                where: { id: registro.id },
                data: { ultimoAcesso: new Date() },
            });
            await tx.registroAuditoria.create({
                data: {
                    usuarioId: registro.id,
                    acao: "LOGIN",
                    entidade: "Autenticacao",
                    entidadeId: registro.id,
                    detalhes: {
                        papel: registro.papel,
                    },
                    ip: ip ?? null,
                    userAgent: userAgent ?? null,
                },
            });
        });
        return {
            token,
            usuario: {
                id: registro.id,
                nome: registro.nome,
                usuario: registro.usuario,
                papel: registro.papel,
            },
        };
    }
}
