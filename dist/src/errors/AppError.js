export default class AppError extends Error {
    statusCode;
    codigo;
    constructor(mensagem, statusCode = 500, codigo = "ERRO_INTERNO") {
        super(mensagem);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.codigo = codigo;
    }
}
