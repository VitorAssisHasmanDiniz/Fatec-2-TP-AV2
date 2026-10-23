import { Router } from "express";
import ServicoUsuarios from "../services/ServicoUsuarios.js";
import autenticar from "../middlewares/autenticar.js";
import autorizar from "../middlewares/autorizar.js";
import AppError from "../errors/AppError.js";
const router = Router();
const servicoUsuarios = new ServicoUsuarios();
const papeisValidos = [
    "ADMINISTRADOR",
    "OPERADOR_CADASTRO",
    "GESTOR_ALMOXARIFADO",
    "AUDITOR",
];
router.use(autenticar, autorizar("ADMINISTRADOR"));
router.get("/", async (_req, res, next) => {
    try {
        const usuarios = await servicoUsuarios.listar();
        res.json({
            nivel: "SUCESSO",
            mensagem: "Usuários listados com sucesso",
            dados: usuarios,
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.get("/inativos", async (_req, res, next) => {
    try {
        const usuarios = await servicoUsuarios.listarInativos();
        res.json({
            nivel: "SUCESSO",
            mensagem: "Usuários inativos listados com sucesso",
            dados: usuarios,
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.get("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        if (typeof id !== "string") {
            throw new AppError("ID do usuário inválido", 400, "ID_INVALIDO");
        }
        const usuario = await servicoUsuarios.buscarPorId(id);
        res.json({
            nivel: "SUCESSO",
            mensagem: "Usuário encontrado com sucesso",
            dados: usuario,
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.post("/", async (req, res, next) => {
    try {
        const { nome, usuario, senha, papel } = req.body ?? {};
        if (typeof nome !== "string" ||
            typeof usuario !== "string" ||
            typeof senha !== "string" ||
            typeof papel !== "string" ||
            !nome.trim() ||
            !usuario.trim() ||
            !senha ||
            !papeisValidos.includes(papel)) {
            throw new AppError("Informe nome, usuário, senha e um papel válido", 400, "DADOS_INVALIDOS");
        }
        const novoUsuario = await servicoUsuarios.criar(nome, usuario, senha, papel);
        res.status(201).json({
            nivel: "SUCESSO",
            mensagem: "Usuário criado com sucesso",
            dados: novoUsuario,
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.put("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nome, usuario, senha, confirmarSenha, papel } = req.body ?? {};
        if (typeof id !== "string") {
            throw new AppError("ID do usuário inválido", 400, "ID_INVALIDO");
        }
        if ((nome !== undefined && typeof nome !== "string") ||
            (usuario !== undefined && typeof usuario !== "string") ||
            (senha !== undefined && typeof senha !== "string") ||
            (confirmarSenha !== undefined &&
                typeof confirmarSenha !== "string") ||
            (papel !== undefined && typeof papel !== "string")) {
            throw new AppError("Os campos enviados devem ser strings", 400, "DADOS_INVALIDOS");
        }
        if (senha !== undefined) {
            if (typeof confirmarSenha !== "string" ||
                senha !== confirmarSenha) {
                throw new AppError("As senhas não coincidem", 400, "SENHAS_DIFERENTES");
            }
        }
        if (confirmarSenha !== undefined && senha === undefined) {
            throw new AppError("Envie a senha junto com a confirmação", 400, "DADOS_INVALIDOS");
        }
        const usuarioAtualizado = await servicoUsuarios.atualizar(id, {
            nome,
            usuario,
            senha,
            papel,
        });
        res.json({
            nivel: "SUCESSO",
            mensagem: "Usuário atualizado com sucesso",
            dados: usuarioAtualizado,
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.delete("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        if (typeof id !== "string") {
            throw new AppError("ID do usuário inválido", 400, "ID_INVALIDO");
        }
        const requisicao = req;
        const usuario = await servicoUsuarios.excluir(id, requisicao.usuario.id);
        res.json({
            nivel: "SUCESSO",
            mensagem: "Usuário excluído com sucesso",
            dados: usuario,
        });
    }
    catch (erro) {
        next(erro);
    }
});
router.patch("/:id/status", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { ativo } = req.body ?? {};
        if (typeof id !== "string") {
            throw new AppError("ID do usuário inválido", 400, "ID_INVALIDO");
        }
        if (typeof ativo !== "boolean") {
            throw new AppError("O campo ativo deve ser true ou false", 400, "DADOS_INVALIDOS");
        }
        const usuario = await servicoUsuarios.alterarStatus(id, ativo);
        res.json({
            nivel: "SUCESSO",
            mensagem: ativo
                ? "Usuário ativado com sucesso"
                : "Usuário desativado com sucesso",
            dados: usuario,
        });
    }
    catch (erro) {
        next(erro);
    }
});
export default router;
