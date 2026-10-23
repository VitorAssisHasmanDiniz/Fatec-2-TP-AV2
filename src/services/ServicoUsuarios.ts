
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import type { PapelUsuario } from "../types/Autenticacao.js";

export default class ServicoUsuarios {
    async criar(
        usuario: string,
        senha: string,
        papel: PapelUsuario
    ) {
        const nomeUsuario = usuario.trim();

        if (!/^[a-zA-Z0-9._-]{3,40}$/.test(nomeUsuario)) {
            throw new AppError(
                "O usuário deve ter de 3 a 40 caracteres válidos",
                400,
                "USUARIO_INVALIDO"
            );
        }

        if (senha.length < 12) {
            throw new AppError(
                "A senha deve ter pelo menos 12 caracteres",
                400,
                "SENHA_INVALIDA"
            );
        }

        const papeisValidos: PapelUsuario[] = [
            "ADMINISTRADOR",
            "OPERADOR_CADASTRO",
            "GESTOR_ALMOXARIFADO",
            "AUDITOR",
        ];

        if (!papeisValidos.includes(papel)) {
            throw new AppError(
                "Papel de usuário inválido",
                400,
                "PAPEL_INVALIDO"
            );
        }

        const existente = await prisma.usuario.findUnique({
            where: { usuario: nomeUsuario },
        });

        if (existente) {
            throw new AppError(
                "Já existe um usuário com esse login",
                409,
                "USUARIO_EXISTENTE"
            );
        }

        const senhaHash = await bcrypt.hash(senha, 12);

        const novoUsuario = await prisma.usuario.create({
            data: {
                usuario: nomeUsuario,
                senhaHash,
                papel,
            },
            select: {
                id: true,
                usuario: true,
                papel: true,
                ativo: true,
                criadoEm: true,
            },
        });

        return novoUsuario;
    }

    async listar() {
        return prisma.usuario.findMany({
            where: {
                ativo: true
            },
            select: {
                id: true,
                usuario: true,
                papel: true,
                ativo: true,
                ultimoAcesso: true,
                criadoEm: true,
                atualizadoEm: true,
            },
            orderBy: {
                criadoEm: "desc",
            },
        });
    }

    async listarInativos() {
        return prisma.usuario.findMany({
            where: {
                ativo: false
            },
            select: {
                id: true,
                usuario: true,
                papel: true,
                ativo: true,
                ultimoAcesso: true,
                criadoEm: true,
                atualizadoEm: true
            },
            orderBy: {
                criadoEm: "desc"
            }
        });
    }

    async buscarPorId(id: string) {
        const usuario = await prisma.usuario.findUnique({
            where: { id },
            select: {
                id: true,
                usuario: true,
                papel: true,
                ativo: true,
                ultimoAcesso: true,
                criadoEm: true,
                atualizadoEm: true
            }
        });

        if (!usuario) {
            throw new AppError(
                "Usuário não encontrado",
                404,
                "USUARIO_NAO_ENCONTRADO"
            );
        }

        return usuario;
    }

    async atualizar(
        id: string,
        dados: {
            usuario?: string;
            senha?: string;
            papel?: PapelUsuario;
        }
    ) {
        const existente = await prisma.usuario.findUnique({
            where: { id }
        });

        if (!existente) {
            throw new AppError(
                "Usuário não encontrado",
                404,
                "USUARIO_NAO_ENCONTRADO"
            );
        }

        const atualizacao: {
            usuario?: string;
            senhaHash?: string;
            papel?: PapelUsuario;
        } = {};

        if (dados.usuario !== undefined) {
            const nomeUsuario = dados.usuario.trim();

            if (!/^[a-zA-Z0-9._-]{3,40}$/.test(nomeUsuario)) {
                throw new AppError(
                    "O usuário deve ter de 3 a 40 caracteres válidos",
                    400,
                    "USUARIO_INVALIDO"
                );
            }

            const usuarioExistente = await prisma.usuario.findUnique({
                where: { usuario: nomeUsuario }
            });

            if (usuarioExistente && usuarioExistente.id !== id) {
                throw new AppError(
                    "Já existe um usuário com esse login",
                    409,
                    "USUARIO_EXISTENTE"
                );
            }

            atualizacao.usuario = nomeUsuario;
        }

        if (dados.senha !== undefined) {
            if (dados.senha.length < 8) {
                throw new AppError(
                    "A senha deve ter pelo menos 8 caracteres",
                    400,
                    "SENHA_INVALIDA"
                );
            }

            atualizacao.senhaHash = await bcrypt.hash(dados.senha, 12);
        }

        if (dados.papel !== undefined) {
            const papeisValidos: PapelUsuario[] = [
                "ADMINISTRADOR",
                "OPERADOR_CADASTRO",
                "GESTOR_ALMOXARIFADO",
                "AUDITOR"
            ];

            if (!papeisValidos.includes(dados.papel)) {
                throw new AppError(
                    "Papel de usuário inválido",
                    400,
                    "PAPEL_INVALIDO"
                );
            }

            atualizacao.papel = dados.papel;
        }

        if (Object.keys(atualizacao).length === 0) {
            throw new AppError(
                "Informe pelo menos um campo para atualizar",
                400,
                "DADOS_INVALIDOS"
            );
        }

        return prisma.usuario.update({
            where: { id },
            data: atualizacao,
            select: {
                id: true,
                usuario: true,
                papel: true,
                ativo: true,
                ultimoAcesso: true,
                criadoEm: true,
                atualizadoEm: true
            }
        });
    }

    async alterarStatus(id: string, ativo: boolean) {
        const existente = await prisma.usuario.findUnique({
            where: { id }
        });

        if (!existente) {
            throw new AppError(
                "Usuário não encontrado",
                404,
                "USUARIO_NAO_ENCONTRADO"
            );
        }

        return prisma.usuario.update({
            where: { id },
            data: { ativo },
            select: {
                id: true,
                usuario: true,
                papel: true,
                ativo: true,
                ultimoAcesso: true,
                criadoEm: true,
                atualizadoEm: true
            }
        });
    }

    async excluir(id: string, idAdministrador: string) {
        if (id === idAdministrador) {
            throw new AppError(
                "Você não pode excluir sua própria conta",
                400,
                "EXCLUSAO_PROPRIA_NEGADA"
            );
        }

        const existente = await prisma.usuario.findUnique({
            where: { id }
        });

        if (!existente) {
            throw new AppError(
                "Usuário não encontrado",
                404,
                "USUARIO_NAO_ENCONTRADO"
            );
        }

        await prisma.usuario.delete({
            where: { id }
        });

        return {
            id: existente.id,
            usuario: existente.usuario
        };
    }
}