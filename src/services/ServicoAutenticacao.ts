import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default class ServicoAutenticacao {
    async autenticar(usuario: string, senha: string) {
        const registro = await prisma.usuario.findUnique({
            where: { usuario },
        });

        if (!registro || !registro.ativo) {
            throw new AppError(
                "Usuário ou senha inválidos",
                401,
                "CREDENCIAIS_INVALIDAS"
            );
        }

        const senhaValida = await bcrypt.compare(
            senha,
            registro.senhaHash
        );

        if (!senhaValida) {
            throw new AppError(
                "Usuário ou senha inválidos",
                401,
                "CREDENCIAIS_INVALIDAS"
            );
        }

        const segredo = process.env.JWT_SECRET;

        if (!segredo) {
            throw new AppError(
                "Configuração de autenticação indisponível",
                500,
                "ERRO_CONFIGURACAO"
            );
        }

        const token = jwt.sign(
            { papel: registro.papel },
            segredo,
            {
                subject: registro.id,
                expiresIn: "30m",
            }
        );

        await prisma.usuario.update({
            where: { id: registro.id },
            data: { ultimoAcesso: new Date() },
        });

        return {
            token,
            usuario: {
                id: registro.id,
                usuario: registro.usuario,
                papel: registro.papel,
            },
        };
    }
}
