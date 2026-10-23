import "dotenv/config";
import express from "express";
import helmet from "helmet";
import AppError from "./errors/AppError.js";
import errorHandler from "./middlewares/errorHandler.js";
import authRouter from "./routes/auth.js";
import usuariosRouter from "./routes/usuarios.js";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";


const app = express();

app.use(helmet());

app.use(pinoHttp({
    logger,
}));

app.use(express.json());

app.get("/", (_req, res) => {
    res.json({
        message: "Servidor Paysandu rodando normalmente"
    });
});

app.get("/health/db", async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        res.json({
            nivel: "SUCESSO",
            mensagem: "Conexão com PostgreSQL funcionando"
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            nivel: "ERRO",
            mensagem: "Falha na conexão com PostgreSQL"
        });
    }
});

app.use("/auth", authRouter);

app.use("/usuarios", usuariosRouter);

app.use((_req, _res, next) => {
    next(new AppError("Rota não encontrada", 404, "ROTA_NAO_ENCONTRADA"));
});

app.use(errorHandler);

export default app;