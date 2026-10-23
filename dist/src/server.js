import "dotenv/config";
import app from "./app.js";
import { prisma } from "./lib/prisma.js";
const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
let encerrando = false;
async function encerrarServidor(sinal) {
    if (encerrando)
        return;
    encerrando = true;
    console.log(`\n${sinal} recebido. Encerrando servidor...`);
    const timeout = setTimeout(() => {
        console.error("Tempo limite excedido durante o encerramento.");
        process.exit(1);
    }, 10000);
    try {
        await new Promise((resolve, reject) => {
            server.close((erro) => {
                if (erro)
                    reject(erro);
                else
                    resolve();
            });
        });
        await prisma.$disconnect();
        clearTimeout(timeout);
        console.log("Servidor e banco encerrados com sucesso.");
        process.exit(0);
    }
    catch (erro) {
        clearTimeout(timeout);
        console.error("Erro ao encerrar:", erro);
        process.exit(1);
    }
}
process.on("SIGINT", () => void encerrarServidor("SIGINT"));
process.on("SIGTERM", () => void encerrarServidor("SIGTERM"));
