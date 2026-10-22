import type { ErrorRequestHandler } from "express";
import AppError from "../errors/AppError.js";
import { logger } from "../lib/logger.js";

const errorHandler: ErrorRequestHandler = (erro, _req, res, _next) => {
    if (erro instanceof AppError) {
        res.status(erro.statusCode).json({
            nivel: "ERRO",
            mensagem: erro.message,
            codigo: erro.codigo,
        });
        return;
    }

    logger.error({ err: erro }, "Erro interno inesperado");

    res.status(500).json({
        nivel: "ERRO",
        mensagem: "Erro interno do servidor",
        codigo: "ERRO_INTERNO",
    });
};

export default errorHandler;