import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

async function main() {
    const nome = process.env.ADM_NOME?.trim();
    const usuario = process.env.ADM_LOGIN?.trim();
    const senha = process.env.ADM_SENHA;

    if (!usuario || !senha || !nome) {
        throw new Error(
            "Defina ADM_NOME, ADM_LOGIN e ADM_SENHA no arquivo .env."
        );
    }

    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(usuario)) {
        throw new Error(
            "ADM_LOGIN deve ter de 3 a 40 caracteres válidos."
        );
    }

    if (senha.length < 8) {
        throw new Error(
            "ADM_SENHA deve ter pelo menos 8 caracteres."
        );
    }

    const existente = await prisma.usuario.findUnique({
        where: { usuario },
    });

    if (existente) {
        console.log(
            `O usuário "${usuario}" já existe. Nenhum dado foi alterado.`
        );
        return;
    }

    const senhaHash = await bcrypt.hash(senha, 12);

    await prisma.usuario.create({
        data: {
            nome,
            usuario,
            senhaHash,
            papel: "ADMINISTRADOR",
        },
    });

    console.log(
        `Administrador "${nome}" criado com sucesso.`
    );
}

main()
    .catch((erro) => {
        console.error("Erro ao criar administrador:", erro);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
