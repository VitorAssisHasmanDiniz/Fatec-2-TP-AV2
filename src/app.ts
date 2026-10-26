import "dotenv/config";
import express from "express";
import helmet from "helmet";
import AppError from "./errors/AppError.js";
import errorHandler from "./middlewares/errorHandler.js";
import path from "path";
import authRouter from "./routes/auth.js";
import usuariosRouter from "./routes/usuarios.js";
import rotasOrganizacoes from "./routes/organizacoes.js";
import lotesRouter from "./routes/lotes.js";
import rotasEquipamentos from "./routes/equipamento.js";
import configuracaoRouter from "./routes/configuracao.js";
import auditoriaRouter from "./routes/auditoria.js";
import contratosRouter from "./routes/contratos.js";
import relatoriosRouter from "./routes/relatorios.js";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import openapi from "./docs/openapi.js";

const app = express();

app.use(helmet());

app.get("/api-docs.json", (_req, res) => {
    res.json(openapi);
});

app.get("/api-docs", (_req, res) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self' http: https:; font-src 'self' data: https://cdn.jsdelivr.net");
    res.type("html").send(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Greencode API — Swagger</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>body{margin:0}#swagger-ui{max-width:1440px;margin:auto}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = () => SwaggerUIBundle({url:'/api-docs.json',dom_id:'#swagger-ui',deepLinking:true,presets:[SwaggerUIBundle.presets.apis,SwaggerUIStandalonePreset],layout:'StandaloneLayout',persistAuthorization:true});
  </script>
</body>
</html>`);
});

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

app.use("/organizacoes", rotasOrganizacoes);
app.use("/clientes", rotasOrganizacoes);

app.get("/paysandu", (req, res) => {
    if (req.query.easteregg === "active") {
        res.setHeader("Content-Type", "image/jpeg");
        const imagePath = path.resolve("src", "errors", "graphicsError.jpeg");
        return res.sendFile(imagePath);
    }
    res.json({ message: "Paysandu" });
});

app.use("/lotes", lotesRouter);

app.use("/equipamentos", rotasEquipamentos);

app.use("/configuracao", configuracaoRouter);

app.use("/auditoria", auditoriaRouter);

app.use("/contratos", contratosRouter);

app.use("/relatorios", relatoriosRouter);

app.use((_req, _res, next) => {
    next(new AppError("Rota não encontrada", 404, "ROTA_NAO_ENCONTRADA"));
});

app.use(errorHandler);

export default app;