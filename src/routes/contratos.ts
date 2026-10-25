
import { Router } from "express";
import ServicoContrato from "../services/ServicoContrato.js";
import autenticar from "../middlewares/autenticar.js"
import autorizar from "../middlewares/autorizar.js";
import { PapelUsuario } from "../../generated/prisma/enums.js";
import { type RequisicaoAutenticada } from "../middlewares/autenticar.js";

const router = Router();
const servicoContrato = new ServicoContrato();

router.use(autenticar);

const leitura = autorizar(
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.OPERADOR_CADASTRO,
    PapelUsuario.AUDITOR
);

const escrita = autorizar(
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.OPERADOR_CADASTRO
);

router.get(
    "/",
    leitura,
    async (_req, res, next) => {
        try {
            const contratos = await servicoContrato.listarContratos();
            res.status(200).json(contratos);
        } catch (erro) {
            next(erro);
        }
    }
);

router.get(
    "/organizacao/:organizacaoId",
    leitura,
    async (req, res, next) => {
        try {
            const contrato =
                await servicoContrato.buscarContratoPorOrganizacao(
                    String(req.params.organizacaoId)
                );

            res.status(200).json(contrato);
        } catch (erro) {
            next(erro);
        }
    }
);

router.get(
    "/:id",
    leitura,
    async (req, res, next) => {
        try {
            const contrato = await servicoContrato.buscarContratoPorId(
                String(req.params.id)
            );

            res.status(200).json(contrato);
        } catch (erro) {
            next(erro);
        }
    }
);

router.post(
    "/",
    escrita,
    async (req: RequisicaoAutenticada, res, next) => {
        try {
            const contrato = await servicoContrato.criarContrato(
                req.body,
                req.usuario!.id
            );

            res.status(201).json(contrato);
        } catch (erro) {
            next(erro);
        }
    }
);

router.put(
    "/:id",
    escrita,
    async (req: RequisicaoAutenticada, res, next) => {
        try {
            const contrato = await servicoContrato.atualizarContrato(
                String(req.params.id),
                req.body,
                req.usuario!.id
            );

            res.status(200).json(contrato);
        } catch (erro) {
            next(erro);
        }
    }
);

router.delete(
    "/:id",
    escrita,
    async (req: RequisicaoAutenticada, res, next) => {
        try {
            const resultado = await servicoContrato.excluirContrato(
                String(req.params.id),
                req.usuario!.id
            );

            res.status(200).json(resultado);
        } catch (erro) {
            next(erro);
        }
    }
);

export default router;
