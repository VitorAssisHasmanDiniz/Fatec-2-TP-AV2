export type PapelUsuario =
    | "ADMINISTRADOR"
    | "OPERADOR_CADASTRO"
    | "GESTOR_ALMOXARIFADO"
    | "AUDITOR";

export interface UsuarioAutenticado {
    id: string;
    papel: PapelUsuario;
}
