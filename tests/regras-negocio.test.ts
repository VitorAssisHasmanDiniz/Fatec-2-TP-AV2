import test from "node:test";
import assert from "node:assert/strict";
import { TipoEquipamento } from "../generated/prisma/client.js";
import { gerarCodigoBarrasSequencial } from "../src/utils/codigoBarras.js";

test("gera código de barras sequencial por tipo", () => {
    assert.equal(gerarCodigoBarrasSequencial(TipoEquipamento.NOTEBOOK, 7, 2026), "NTB-26-000007");
    assert.equal(gerarCodigoBarrasSequencial(TipoEquipamento.COMPUTADOR_MESA, 42, 2026), "CMP-26-000042");
});

test("rejeita sequência inválida para código de barras", () => {
    assert.throws(() => gerarCodigoBarrasSequencial(TipoEquipamento.NOTEBOOK, 0), /Sequência/);
    assert.throws(() => gerarCodigoBarrasSequencial(TipoEquipamento.NOTEBOOK, 1.5), /Sequência/);
});
