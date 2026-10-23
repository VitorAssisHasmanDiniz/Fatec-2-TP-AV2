
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import type { PapelUsuario } from "../types/Autenticacao.js";

const papeisValidos: PapelUsuario[] = [
    "ADMINISTRADOR",
    "OPERADOR_CADASTRO",
    "GESTOR_ALMOXARIFADO",
    "AUDITOR",
];

function validarNome(nome: string): string {
    const nomeFormatado = nome.trim();

    if (!nomeFormatado || nomeFormatado.length > 120) {
        throw new AppError(
            "O nome deve ter de 1 a 120 caracteres",
            400,
            "NOME_INVALIDO"
        );
    }

    return nomeFormatado;
}

function validarUsuario(usuario: string): string {
    const nomeUsuario = usuario.trim();

    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(nomeUsuario)) {
        throw new AppError(
            "O usuário deve ter de 3 a 40 caracteres válidos",
            400,
            "USUARIO_INVALIDO"
        );
    }

    return nomeUsuario;
}

function validarSenha(senha: string): void {
    if (senha.length < 8) {
        throw new AppError(
            "A senha deve ter pelo menos 8 caracteres",
            400,
            "SENHA_INVALIDA"
        );
    }
}

function validarPapel(papel: PapelUsuario): void {
    if (!papeisValidos.includes(papel)) {
        throw new AppError(
            "Papel de usuário inválido",
            400,
            "PAPEL_INVALIDO"
        );
    }
}

export default class ServicoUsuarios {
    async criar(
        nome: string,
        usuario: string,
        senha: string,
        papel: PapelUsuario
    ) {
        const nomeFormatado = validarNome(nome);
        const nomeUsuario = validarUsuario(usuario);

        validarSenha(senha);
        validarPapel(papel);

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

        return prisma.usuario.create({
            data: {
                nome: nomeFormatado,
                usuario: nomeUsuario,
                senhaHash,
                papel,
            },
            select: {
                id: true,
                nome: true,
                usuario: true,
                papel: true,
                ativo: true,
                criadoEm: true,
            },
        });
    }

    async listar() {
        return prisma.usuario.findMany({
            where: { ativo: true },
            select: {
                id: true,
                nome: true,
                usuario: true,
                papel: true,
                ativo: true,
                ultimoAcesso: true,
                criadoEm: true,
                atualizadoEm: true,
            },
            orderBy: { criadoEm: "desc" },
        });
    }

    async listarInativos() {
        return prisma.usuario.findMany({
            where: { ativo: false },
            select: {
                id: true,
                nome: true,
                usuario: true,
                papel: true,
                ativo: true,
                ultimoAcesso: true,
                criadoEm: true,
                atualizadoEm: true,
            },
            orderBy: { criadoEm: "desc" },
        });
    }

    async buscarPorId(id: string) {
        const usuario = await prisma.usuario.findUnique({
            where: { id },
            select: {
                id: true,
                nome: true,
                usuario: true,
                papel: true,
                ativo: true,
                ultimoAcesso: true,
                criadoEm: true,
                atualizadoEm: true,
            },
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
            nome?: string;
            usuario?: string;
            senha?: string;
            papel?: PapelUsuario;
        }
    ) {
        const existente = await prisma.usuario.findUnique({
            where: { id },
        });

        if (!existente) {
            throw new AppError(
                "Usuário não encontrado",
                404,
                "USUARIO_NAO_ENCONTRADO"
            );
        }

        const atualizacao: {
            nome?: string;
            usuario?: string;
            senhaHash?: string;
            papel?: PapelUsuario;
        } = {};

        if (dados.nome !== undefined) {
            atualizacao.nome = validarNome(dados.nome);
        }

        if (dados.usuario !== undefined) {
            const nomeUsuario = validarUsuario(dados.usuario);

            const usuarioExistente = await prisma.usuario.findUnique({
                where: { usuario: nomeUsuario },
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
            validarSenha(dados.senha);
            atualizacao.senhaHash = await bcrypt.hash(dados.senha, 12);
        }

        if (dados.papel !== undefined) {
            validarPapel(dados.papel);
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
                nome: true,
                usuario: true,
                papel: true,
                ativo: true,
                ultimoAcesso: true,
                criadoEm: true,
                atualizadoEm: true,
            },
        });
    }

    async alterarStatus(id: string, ativo: boolean) {
        const existente = await prisma.usuario.findUnique({
            where: { id },
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
                nome: true,
                usuario: true,
                papel: true,
                ativo: true,
                ultimoAcesso: true,
                criadoEm: true,
                atualizadoEm: true,
            },
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
            where: { id },
        });

        if (!existente) {
            throw new AppError(
                "Usuário não encontrado",
                404,
                "USUARIO_NAO_ENCONTRADO"
            );
        }

        await prisma.usuario.delete({
            where: { id },
        });

        return {
            id: existente.id,
            nome: existente.nome,
            usuario: existente.usuario,
        };
    }
}
