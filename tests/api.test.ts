import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import type { PapelUsuario } from "../src/types/Autenticacao.js";

const segredoTeste = "segredo-exclusivo-dos-testes-greencode-api";
process.env.JWT_SECRET = segredoTeste;

let servidor: Server;
let baseUrl: string;

before(async () => {
    // Importação dinâmica garante que o segredo de teste exista antes da API carregar.
    const { default: app } = await import("../src/app.js");
    servidor = app.listen(0);
    await new Promise<void>((resolve, reject) => {
        servidor.once("listening", resolve);
        servidor.once("error", reject);
    });
    const endereco = servidor.address();
    if (!endereco || typeof endereco === "string") throw new Error("Não foi possível obter a porta de teste da API.");
    baseUrl = `http://127.0.0.1:${endereco.port}`;
});

after(async () => {
    if (servidor) {
        await new Promise<void>((resolve, reject) => {
            servidor.close((erro) => erro ? reject(erro) : resolve());
        });
    }
});

function token(papel: PapelUsuario): string {
    return jwt.sign({ papel }, segredoTeste, {
        subject: "00000000-0000-4000-8000-000000000001",
        expiresIn: "5m",
    });
}

async function requisitar(caminho: string, opcoes: { metodo?: string; papel?: PapelUsuario; corpo?: unknown } = {}) {
    const headers: Record<string, string> = {};
    if (opcoes.papel) headers.authorization = `Bearer ${token(opcoes.papel)}`;
    if (opcoes.corpo !== undefined) headers["content-type"] = "application/json";
    const resposta = await fetch(`${baseUrl}${caminho}`, {
        method: opcoes.metodo ?? "GET",
        headers,
        body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    });
    const tipoConteudo = resposta.headers.get("content-type") ?? "";
    const corpo = tipoConteudo.includes("application/json")
        ? await resposta.json() as Record<string, any>
        : await resposta.text();
    return { resposta, corpo };
}

test("GET / responde com a mensagem de serviço disponível", async () => {
    const { resposta, corpo } = await requisitar("/");
    assert.equal(resposta.status, 200);
    assert.equal((corpo as Record<string, unknown>).message, "Servidor Paysandu rodando normalmente");
});

test("rota protegida sem token retorna 401 e TOKEN_AUSENTE", async () => {
    const { resposta, corpo } = await requisitar("/organizacoes");
    assert.equal(resposta.status, 401);
    assert.equal((corpo as Record<string, unknown>).nivel, "ERRO");
    assert.equal((corpo as Record<string, unknown>).codigo, "TOKEN_AUSENTE");
});

test("alias /clientes também exige autenticação", async () => {
    const { resposta, corpo } = await requisitar("/clientes");
    assert.equal(resposta.status, 401);
    assert.equal((corpo as Record<string, unknown>).codigo, "TOKEN_AUSENTE");
});

test("login sem credenciais retorna 400", async () => {
    const { resposta, corpo } = await requisitar("/auth/login", { metodo: "POST", corpo: {} });
    assert.equal(resposta.status, 400);
    assert.equal((corpo as Record<string, unknown>).codigo, "DADOS_INVALIDOS");
});

test("login com usuário em branco retorna 400", async () => {
    const { resposta, corpo } = await requisitar("/auth/login", {
        metodo: "POST", corpo: { usuario: "   ", senha: "senha-valida" },
    });
    assert.equal(resposta.status, 400);
    assert.equal((corpo as Record<string, unknown>).codigo, "DADOS_INVALIDOS");
});

test("token assinado com segredo incorreto é rejeitado", async () => {
    const tokenInvalido = jwt.sign({ papel: "ADMINISTRADOR" }, "outro-segredo", {
        subject: "00000000-0000-4000-8000-000000000001",
    });
    const resposta = await fetch(`${baseUrl}/organizacoes`, { headers: { authorization: `Bearer ${tokenInvalido}` } });
    const corpo = await resposta.json() as Record<string, unknown>;
    assert.equal(resposta.status, 401);
    assert.equal(corpo.codigo, "TOKEN_INVALIDO");
});

test("operador não pode listar usuários", async () => {
    const { resposta, corpo } = await requisitar("/usuarios", { papel: "OPERADOR_CADASTRO" });
    assert.equal(resposta.status, 403);
    assert.equal((corpo as Record<string, unknown>).codigo, "PERMISSAO_NEGADA");
});

test("auditor não pode consultar a configuração administrativa", async () => {
    const { resposta, corpo } = await requisitar("/configuracao", { papel: "AUDITOR" });
    assert.equal(resposta.status, 403);
    assert.equal((corpo as Record<string, unknown>).codigo, "PERMISSAO_NEGADA");
});

test("auditor não pode acessar o CRUD de organizações", async () => {
    const { resposta, corpo } = await requisitar("/organizacoes", { papel: "AUDITOR" });
    assert.equal(resposta.status, 403);
    assert.equal((corpo as Record<string, unknown>).codigo, "PERMISSAO_NEGADA");
});

test("cadastro de organização com tipos incorretos retorna 400 sem acessar o banco", async () => {
    const { resposta, corpo } = await requisitar("/organizacoes", {
        metodo: "POST", papel: "OPERADOR_CADASTRO", corpo: { id: 123, razaoSocial: true, cnpj: null },
    });
    assert.equal(resposta.status, 400);
    assert.equal((corpo as Record<string, unknown>).codigo, "CORPO_INVALIDO");
});

test("edição de organização sem campos permitidos retorna 400", async () => {
    const { resposta, corpo } = await requisitar("/organizacoes/ORG-TESTE", {
        metodo: "PATCH", papel: "OPERADOR_CADASTRO", corpo: {},
    });
    assert.equal(resposta.status, 400);
    assert.equal((corpo as Record<string, unknown>).codigo, "DADOS_INVALIDOS");
});

test("relatório por status rejeita enum inválido", async () => {
    const { resposta, corpo } = await requisitar("/relatorios/status?status=NAO_EXISTE", { papel: "AUDITOR" });
    assert.equal(resposta.status, 400);
    assert.equal((corpo as Record<string, unknown>).codigo, "STATUS_INVALIDO");
});

test("relatório financeiro exige data inicial e final", async () => {
    const { resposta, corpo } = await requisitar("/relatorios/financeiro", { papel: "AUDITOR" });
    assert.equal(resposta.status, 400);
    assert.equal((corpo as Record<string, unknown>).codigo, "DADOS_INVALIDOS");
});

test("journal rejeita limite acima de 500", async () => {
    const { resposta, corpo } = await requisitar("/relatorios/journal?limite=501", { papel: "AUDITOR" });
    assert.equal(resposta.status, 400);
    assert.equal((corpo as Record<string, unknown>).codigo, "LIMITE_INVALIDO");
});

test("listagem de lotes rejeita status inválido", async () => {
    const { resposta, corpo } = await requisitar("/lotes?status=NAO_EXISTE", { papel: "GESTOR_ALMOXARIFADO" });
    assert.equal(resposta.status, 400);
    assert.equal((corpo as Record<string, unknown>).codigo, "STATUS_INVALIDO");
});

test("listagem de lotes rejeita período invertido", async () => {
    const { resposta, corpo } = await requisitar(
        "/lotes?dataInicio=2026-12-31&dataFim=2026-01-01",
        { papel: "GESTOR_ALMOXARIFADO" },
    );
    assert.equal(resposta.status, 400);
    assert.equal((corpo as Record<string, unknown>).codigo, "PERIODO_INVALIDO");
});

test("operador não pode gerar código de barras reservado à gestão/administrador", async () => {
    const { resposta, corpo } = await requisitar("/equipamentos/codigo-barras", {
        metodo: "POST", papel: "OPERADOR_CADASTRO", corpo: { tipo: "NOTEBOOK", sequencia: 7 },
    });
    assert.equal(resposta.status, 403);
    assert.equal((corpo as Record<string, unknown>).codigo, "PERMISSAO_NEGADA");
});

test("código de barras válido é gerado pela API sem acessar o banco", async () => {
    const { resposta, corpo } = await requisitar("/equipamentos/codigo-barras", {
        metodo: "POST", papel: "ADMINISTRADOR", corpo: { tipo: "NOTEBOOK", sequencia: 7 },
    });
    assert.equal(resposta.status, 200);
    const dados = (corpo as Record<string, any>).dados;
    assert.equal((corpo as Record<string, unknown>).nivel, "SUCESSO");
    assert.equal(dados.tipo, "NOTEBOOK");
    assert.equal(dados.sequencia, 7);
    assert.match(dados.codigoBarrasInterno, /^NTB-\d{2}-000007$/);
});

test("código de barras rejeita tipo ou sequência inválidos", async () => {
    for (const corpoEntrada of [
        { tipo: "TIPO_INEXISTENTE", sequencia: 1 },
        { tipo: "NOTEBOOK", sequencia: 0 },
        { tipo: "NOTEBOOK", sequencia: 1.5 },
    ]) {
        const { resposta, corpo } = await requisitar("/equipamentos/codigo-barras", {
            metodo: "POST", papel: "ADMINISTRADOR", corpo: corpoEntrada,
        });
        assert.equal(resposta.status, 400);
        assert.equal((corpo as Record<string, unknown>).codigo, "DADOS_INVALIDOS");
    }
});

test("rota inexistente retorna 404 no formato padronizado", async () => {
    const { resposta, corpo } = await requisitar("/rota-que-nao-existe");
    assert.equal(resposta.status, 404);
    assert.equal((corpo as Record<string, unknown>).nivel, "ERRO");
    assert.equal((corpo as Record<string, unknown>).codigo, "ROTA_NAO_ENCONTRADA");
});
