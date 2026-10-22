export default class AppError extends Error {
    public readonly statusCode: number;
    public readonly codigo: string;

    constructor(
        mensagem: string,
        statusCode: number = 500,
        codigo: string = "ERRO_INTERNO"
    ) {
        super(mensagem);

        this.name = "AppError";
        this.statusCode = statusCode;
        this.codigo = codigo;
    }
}