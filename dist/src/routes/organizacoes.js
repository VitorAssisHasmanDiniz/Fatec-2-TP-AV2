import { Router } from "express";
import ServicoOrganizacao from "../services/ServicoOrganizacao.js";
import autenticar from "../middlewares/autenticar.js";
import autorizar from "../middlewares/autorizar.js";
import AppError from "../errors/AppError.js";
const router = Router();
const servico = new ServicoOrganizacao();
router.use(autenticar, autorizar("ADMINISTRADOR", "OPERADOR_CADASTRO"));
router.get("/", async (_req, res, next) => {
    try {
        const organizacoes = await servico.listarOrganizacoesAtivas();
        return res.status(200).json({
            nivel: "SUCESSO",
            mensagem: "Organizações ativas consultadas com sucesso.",
            dados: organizacoes
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.get("/buscar", async (req, res, next) => {
    try {
        if (typeof req.query.nome !== "string")
            throw new AppError("Informe o parâmetro nome.", 400, "TERMO_BUSCA_OBRIGATORIO");
        const dados = await servico.buscarOrganizacoesPorNome(req.query.nome);
        return res.status(200).json({ nivel: "SUCESSO", mensagem: "Pesquisa de organizações concluída.", dados });
    }
    catch (erro) {
        next(erro);
    }
});
router.get("/:id", async (req, res, next) => {
    try {
        const organizacao = await servico.buscarOrganizacao(req.params.id);
        return res.status(200).json({
            nivel: "SUCESSO",
            mensagem: "Organização consultada com sucesso.",
            dados: organizacao
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.post("/", async (req, res, next) => {
    try {
        const { id, razaoSocial, cnpj, inscricaoEstadual, enderecoCompleto, telefone, email, vencimentoContrato, valorMensal } = req.body;
        if (typeof id !== "string" ||
            typeof razaoSocial !== "string" ||
            typeof cnpj !== "string" ||
            typeof vencimentoContrato !== "string" ||
            typeof valorMensal !== "number") {
            throw new AppError("Informe id, razaoSocial, cnpj, vencimentoContrato e valorMensal com os tipos corretos.", 400, "CORPO_INVALIDO");
        }
        const requisicao = req;
        const organizacao = await servico.cadastrarComDados({
            id,
            razaoSocial,
            cnpj,
            inscricaoEstadual,
            enderecoCompleto,
            telefone,
            email,
            vencimentoContrato: new Date(vencimentoContrato),
            valorMensal
        }, requisicao.usuario.id);
        return res.status(201).json({
            nivel: "SUCESSO",
            mensagem: "Organização cadastrada com sucesso.",
            dados: organizacao
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.patch("/:id", async (req, res, next) => {
    try {
        const corpo = req.body;
        if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
            throw new AppError("O corpo deve ser um objeto JSON.", 400, "CORPO_INVALIDO");
        }
        const permitidos = ["razaoSocial", "cnpj", "inscricaoEstadual", "enderecoCompleto", "telefone", "email"];
        const campos = Object.keys(corpo);
        if (!campos.length || campos.some((campo) => !permitidos.includes(campo))) {
            throw new AppError("Informe ao menos um campo permitido para edição.", 400, "DADOS_INVALIDOS");
        }
        for (const campo of campos) {
            if (typeof corpo[campo] !== "string")
                throw new AppError(`O campo ${campo} deve ser texto.`, 400, "DADOS_INVALIDOS");
        }
        const requisicao = req;
        const organizacao = await servico.editarOrganizacao(req.params.id, corpo, requisicao.usuario.id);
        return res.status(200).json({ nivel: "SUCESSO", mensagem: "Organização atualizada com sucesso.", dados: organizacao });
    }
    catch (erro) {
        next(erro);
    }
});
router.delete("/:id", autorizar("ADMINISTRADOR"), async (req, res, next) => {
    try {
        const requisicao = req;
        const organizacao = await servico.excluirOrganizacao(String(req.params.id), requisicao.usuario.id);
        return res.status(200).json({ nivel: "SUCESSO", mensagem: "Organização excluída com sucesso.", dados: organizacao });
    }
    catch (erro) {
        next(erro);
    }
});
router.patch("/:id/desativar", async (req, res, next) => {
    try {
        const requisicao = req;
        const organizacao = await servico.desativarOrganizacao(req.params.id, requisicao.usuario.id);
        return res.status(200).json({
            nivel: "SUCESSO",
            mensagem: "Organização desativada com sucesso.",
            dados: organizacao
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.patch("/:id/ativar", async (req, res, next) => {
    try {
        const requisicao = req;
        const organizacao = await servico.ativarOrganizacao(req.params.id, requisicao.usuario.id);
        return res.status(200).json({
            nivel: "SUCESSO",
            mensagem: "Organização ativada com sucesso.",
            dados: organizacao
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.patch("/:id/contrato/renovar", async (req, res, next) => {
    try {
        const { novoVencimento } = req.body;
        if (typeof novoVencimento !== "string") {
            throw new AppError("Informe novoVencimento como uma data em formato ISO.", 400, "CORPO_INVALIDO");
        }
        const requisicao = req;
        const contrato = await servico.renovarContrato(req.params.id, new Date(novoVencimento), requisicao.usuario.id);
        return res.status(200).json({
            nivel: "SUCESSO",
            mensagem: "Contrato renovado com sucesso.",
            dados: contrato
        });
    }
    catch (erro) {
        next(erro);
    }
});
export default router;
