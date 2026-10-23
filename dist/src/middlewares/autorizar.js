import AppError from "../errors/AppError.js";
export default function autorizar(...papeisPermitidos) {
    return (req, _res, next) => {
        if (!req.usuario) {
            return next(new AppError("Autenticação necessária", 401, "NAO_AUTENTICADO"));
        }
        if (!papeisPermitidos.includes(req.usuario.papel)) {
            return next(new AppError("Você não tem permissão para executar esta operação", 403, "PERMISSAO_NEGADA"));
        }
        next();
    };
}
