import { prisma } from "../lib/prisma.js";
export default class ServicoAuditoria {
    async registrar(dados) {
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
    async listar(filtros) {
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
