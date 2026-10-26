import test from "node:test";
import assert from "node:assert/strict";
import { TipoEquipamento } from "../generated/prisma/client.js";
import AppError from "../src/errors/AppError.js";
import { gerarCodigoBarrasSequencial } from "../src/utils/codigoBarras.js";

test("gera código de barras para todos os tipos de equipamento", () => {
    const casos = [
        [TipoEquipamento.COMPUTADOR_MESA, "CMP"],
        [TipoEquipamento.NOTEBOOK, "NTB"],
        [TipoEquipamento.MONITOR, "MON"],
        [TipoEquipamento.IMPRESSORA, "IMP"],
        [TipoEquipamento.SERVIDOR, "SRV"],
        [TipoEquipamento.ROTEADOR, "RTR"],
        [TipoEquipamento.CABO_ESTRUTURADO, "CAB"],
        [TipoEquipamento.FONTE_ALIMENTACAO, "FNT"],
    ] as const;

    for (const [tipo, prefixo] of casos) {
        assert.equal(gerarCodigoBarrasSequencial(tipo, 7, 2026), `${prefixo}-26-000007`);
    }
});

test("preenche a sequência com zeros à esquerda", () => {
    assert.equal(gerarCodigoBarrasSequencial(TipoEquipamento.NOTEBOOK, 1, 2026), "NTB-26-000001");
});

test("usa o ano atual quando o ano não é informado", () => {
    const ano = new Date().getFullYear();
    assert.equal(gerarCodigoBarrasSequencial(TipoEquipamento.MONITOR, 12), `MON-${String(ano).slice(-2)}-000012`);
});

test("aceita anos de outros séculos usando os dois últimos dígitos", () => {
    assert.equal(gerarCodigoBarrasSequencial(TipoEquipamento.COMPUTADOR_MESA, 1, 2004), "CMP-04-000001");
});

test("não trunca sequências maiores que seis dígitos", () => {
    assert.equal(gerarCodigoBarrasSequencial(TipoEquipamento.SERVIDOR, 1234567, 2026), "SRV-26-1234567");
});

test("rejeita tipo de equipamento inválido", () => {
    assert.throws(
        () => gerarCodigoBarrasSequencial("TIPO_INVALIDO" as TipoEquipamento, 1, 2026),
        (erro: unknown) => erro instanceof AppError && erro.statusCode === 400 && erro.codigo === "TIPO_INVALIDO",
    );
});

test("rejeita sequência zero ou negativa", () => {
    for (const sequencia of [0, -1]) {
        assert.throws(
            () => gerarCodigoBarrasSequencial(TipoEquipamento.NOTEBOOK, sequencia, 2026),
            (erro: unknown) => erro instanceof AppError && erro.statusCode === 400 && erro.codigo === "SEQUENCIA_INVALIDA",
        );
    }
});

test("rejeita sequência fracionária, NaN e infinito", () => {
    for (const sequencia of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(
            () => gerarCodigoBarrasSequencial(TipoEquipamento.NOTEBOOK, sequencia, 2026),
            (erro: unknown) => erro instanceof AppError && erro.statusCode === 400 && erro.codigo === "SEQUENCIA_INVALIDA",
        );
    }
});
