import type { NextFunction, Response } from "express";
import AppError from "../errors/AppError.js";
import type {
    RequisicaoAutenticada,
} from "./autenticar.js";
import type { PapelUsuario } from "../types/Autenticacao.js";

export default function autorizar(...papeisPermitidos: PapelUsuario[]) {
    return (
        req: RequisicaoAutenticada,
        _res: Response,
        next: NextFunction
    ) => {
        if (!req.usuario) {
            return next(
                new AppError(
                    "Autenticação necessária",
                    401,
                    "NAO_AUTENTICADO"
                )
            );
        }

        if (!papeisPermitidos.includes(req.usuario.papel)) {
            return next(
                new AppError(
                    "Você não tem permissão para executar esta operação",
                    403,
                    "PERMISSAO_NEGADA"
                )
            );
        }

        next();
    };
}
