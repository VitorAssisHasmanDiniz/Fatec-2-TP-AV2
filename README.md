# Greencode API

API REST do Greencode com Express, TypeScript, Prisma e PostgreSQL.

## Configuração

1. Copie `.env.example` para `.env` e configure `DATABASE_URL`, `SHADOW_DATABASE_URL` e `JWT_SECRET`.
2. Instale as dependências com `npm ci`.
3. Aplique as migrações: `npx prisma migrate deploy --schema=prisma/schema.prisma`.
4. Gere o cliente Prisma, se necessário: `npx prisma generate --schema=prisma/schema.prisma`.
5. Crie o administrador inicial com `npm run seed:admin`.
6. Inicie a API com `npm run dev`.

## Autenticação

Envie `Authorization: Bearer <token>` nas rotas protegidas. Faça login em `POST /auth/login` com `{ "usuario": "...", "senha": "..." }`.

- `GET /auth/me`: usuário da sessão.
- `POST /auth/logout`: registra o encerramento no log de auditoria; o cliente deve descartar o token.
- `PATCH /auth/senha`: altera a senha da própria conta. Corpo: `{ "senhaAtual": "...", "senhaNova": "...", "confirmarSenha": "..." }`.

## Compatibilidade e rotas complementares implementadas

| Método | Rota | Finalidade | Perfil |
|---|---|---|---|
| `GET` | `/usuarios/buscar?usuario=...` | Busca um usuário pelo login sem retornar hash de senha | Administrador |
| `GET` | `/organizacoes/buscar?nome=...` | Pesquisa de organização por razão social | Administrador, operador de cadastro |
| `PATCH` | `/organizacoes/:id` | Edita dados cadastrais da organização | Administrador, operador de cadastro |
| `DELETE` | `/organizacoes/:id` | Exclui organização sem lotes vinculados | Administrador |
| `POST` | `/lotes/:id/triagem` | Processa a triagem e registra movimentações dos equipamentos em uma transação | Administrador, gestor de almoxarifado |
| `DELETE` | `/lotes/:id` | Exclui lote sem equipamentos vinculados | Administrador |
| `GET` | `/equipamentos?busca=...` | Pesquisa por marca, modelo ou código de barras | Administrador, gestor de almoxarifado |
| `POST` | `/equipamentos/codigo-barras` | Gera código sequencial por tipo. Corpo: `{ "tipo": "NOTEBOOK", "sequencia": 7 }` | Administrador, gestor de almoxarifado |
| `DELETE` | `/equipamentos/:id` | Exclui equipamento e movimentações associadas, mantendo registro da ação na auditoria | Administrador, gestor de almoxarifado |
| `GET` | `/relatorios/organizacao?organizacaoId=BR001&inicio=2026-01-01&fim=2026-12-31` | Relatório de lotes e equipamentos por organização e período | Todos os perfis autenticados |
| `GET` | `/relatorios/status?status=AGUARDANDO_TRIAGEM` | Relatório de equipamentos por status de rastreamento | Todos os perfis autenticados |
| `GET` | `/relatorios/financeiro?inicio=2026-01-01&fim=2026-12-31` | Relatório financeiro por período | Todos os perfis autenticados |
| `GET` | `/relatorios/rastreamento/:id` | Dados e movimentações de um equipamento | Todos os perfis autenticados |
| `GET` | `/relatorios/journal?limite=100` | Consulta registros de auditoria com filtros opcionais `inicio`, `fim`, `entidade` e `acao` | Administrador, auditor |

O alias `/clientes` aponta para as mesmas rotas de `/organizacoes`, preservando o alias `cliente` do CLI. A configuração aceita atualização parcial em `PATCH /configuracao`, enviando somente `aliquotaImposto` ou somente `coeficienteDepreciacao`. A edição de equipamento também aceita `tipo`.

As exclusões de organização e lote são bloqueadas quando existem dependências que tornariam o histórico inconsistente. Equipamentos removidos têm as movimentações operacionais removidas junto, mas a ação de exclusão fica registrada na auditoria.

## Testes

- `npm test`: testes unitários das regras de geração de código de barras.
- `npm run build`: compilação TypeScript.

Os testes unitários não substituem os testes de integração contra um PostgreSQL de teste. Antes de publicar, valide também os fluxos de autenticação, autorização por perfil, CRUD, triagem, relatórios e auditoria com dados de teste.

## Popular o banco com dados de demonstração

Execute:

```bash
npm run seed:dados
```

O script é idempotente: pode ser executado novamente sem duplicar os registros de demonstração. Ele cria/atualiza usuários de teste para os quatro papéis, organizações e contratos (incluindo contrato vencido), lotes em diferentes estados, equipamentos com estados físicos e rastreamentos variados, movimentações, configuração e registros de auditoria.

Logins criados: `admin.seed`, `operador.seed`, `gestor.seed` e `auditor.seed`. Todos usam a senha definida em `SEED_DADOS_SENHA` ou, como alternativa, `ADM_SENHA`. Use apenas em ambiente de desenvolvimento/testes; a execução atualiza a senha desses logins de demonstração.
