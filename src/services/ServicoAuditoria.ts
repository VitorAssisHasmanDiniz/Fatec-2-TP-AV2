import { prisma } from "../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";

export interface DadosAuditoria {
    usuarioId?: string | null;
    acao: string;
    entidade: string;
    entidadeId?: string | null;
    detalhes?: Prisma.InputJsonValue | null;
    ip?: string | null;
    userAgent?: string | null;
}

export default class ServicoAuditoria {
    async registrar(dados: DadosAuditoria) {
        return prisma.registroAuditoria.create({
            data: {
                usuarioId: dados.usuarioId ?? null,
                acao: dados.acao,
                entidade: dados.entidade,
                entidadeId: dados.entidadeId ?? null,
                detalhes: dados.detalhes ?? undefined,
                ip: dados.ip ?? null,
                userAgent: dados.userAgent ?? null
            }
        });
    }

    async listar(filtros?: {
        usuarioId?: string;
        entidade?: string;
        entidadeId?: string;
        limite?: number;
    }) {
        return prisma.registroAuditoria.findMany({
            where: {
                usuarioId: filtros?.usuarioId,
                entidade: filtros?.entidade,
                entidadeId: filtros?.entidadeId
            },
            orderBy: {
                criadoEm: "desc"
            },
            take: filtros?.limite ?? 100,
            include: {
                usuario: {
                    select: {
                        id: true,
                        nome: true,
                        usuario: true
                    }
                }
            }
        });
    }
}
