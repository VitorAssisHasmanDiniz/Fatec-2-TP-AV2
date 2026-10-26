import { TipoEquipamento } from "../../generated/prisma/client.js";
import AppError from "../errors/AppError.js";

const prefixos: Record<TipoEquipamento, string> = {
    COMPUTADOR_MESA: "CMP",
    NOTEBOOK: "NTB",
    MONITOR: "MON",
    IMPRESSORA: "IMP",
    SERVIDOR: "SRV",
    ROTEADOR: "RTR",
    CABO_ESTRUTURADO: "CAB",
    FONTE_ALIMENTACAO: "FNT"
};

export function gerarCodigoBarrasSequencial(tipo: TipoEquipamento, sequencia: number, ano = new Date().getFullYear()): string {
    const prefixo = prefixos[tipo];
    if (!prefixo) throw new AppError("Tipo de equipamento inválido.", 400, "TIPO_INVALIDO");
    if (!Number.isInteger(sequencia) || sequencia < 1) throw new AppError("Sequência deve ser um inteiro positivo.", 400, "SEQUENCIA_INVALIDA");
    return `${prefixo}-${String(ano).slice(-2)}-${String(sequencia).padStart(6, "0")}`;
}
