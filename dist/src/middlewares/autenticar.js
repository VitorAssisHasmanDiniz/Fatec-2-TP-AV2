import jwt from "jsonwebtoken";
import AppError from "../errors/AppError.js";
const papeisValidos = [
    "ADMINISTRADOR",
    "OPERADOR_CADASTRO",
    "GESTOR_ALMOXARIFADO",
    "AUDITOR",
];
export default function autenticar(req, _res, next) {
    const autorizacao = req.headers.authorization;
    const token = autorizacao?.startsWith("Bearer ")
        ? autorizacao.slice(7)
        : null;
    if (!token) {
        return next(new AppError("Token de autenticação não informado", 401, "TOKEN_AUSENTE"));
    }
    const segredo = process.env.JWT_SECRET;
    if (!segredo) {
        return next(new AppError("Configuração de autenticação indisponível", 500, "ERRO_CONFIGURACAO"));
    }
    try {
        const payload = jwt.verify(token, segredo);
        if (typeof payload === "string" ||
            typeof payload.sub !== "string" ||
            typeof payload.papel !== "string" ||
            !papeisValidos.includes(payload.papel)) {
            return next(new AppError("Token de autenticação inválido", 401, "TOKEN_INVALIDO"));
        }
        req.usuario = {
            id: payload.sub,
            papel: payload.papel,
        };
        next();
    }
    catch {
        return next(new AppError("Token inválido ou expirado", 401, "TOKEN_INVALIDO"));
    }
}
