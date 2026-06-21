import { type ReactNode } from 'react';

export type Role = 'agente' | 'desconhecido' | 'dev' | 'supervisor';

export interface RoleCopy {
  badge: string;
  title: string;
  intro: ReactNode;
  hint: ReactNode;
  contextualCtaLabel: string;
  contextualCtaPath: string;
}

export const ACCESS_DENIED_STRINGS: Record<Role, RoleCopy> = {
  dev: {
    badge: 'Desenvolvedor',
    title: 'Acesso total concedido',
    intro: 'Você possui acesso de desenvolvedor e pode visualizar todas as ferramentas técnicas.',
    hint: 'Use estas ferramentas com cautela, pois elas afetam diretamente a infraestrutura.',
    contextualCtaLabel: 'Voltar ao Início',
    contextualCtaPath: '/',
  },
  supervisor: {
    badge: 'Supervisor',
    title: 'Área técnica restrita à equipe de Desenvolvimento',
    intro:
      'Como supervisor, você administra usuários, empresas e regras de negócio — mas ferramentas técnicas ficam restritas ao time de Desenvolvimento.',
    hint: 'Seus privilégios administrativos estão configurados para gestão de negócio e usuários. O acesso a ferramentas de infraestrutura e telemetria é restrito.',
    contextualCtaLabel: 'Ir para Usuários',
    contextualCtaPath: '/admin/usuarios',
  },
  agente: {
    badge: 'Agente / Vendedor',
    title: 'Esta área é exclusiva da equipe técnica',
    intro:
      'Como vendedor, você não precisa acessar páginas técnicas para o seu dia a dia. O catálogo e CRM já cobrem suas necessidades.',
    hint: 'Se acredita que precisa entrar nesta área, fale primeiro com o seu supervisor.',
    contextualCtaLabel: 'Voltar ao Catálogo',
    contextualCtaPath: '/produtos',
  },
  desconhecido: {
    badge: 'Sem permissão',
    title: 'Acesso restrito',
    intro: 'O seu papel atual não possui permissão para acessar esta página técnica.',
    hint: 'Você pode solicitar acesso ao time técnico ou voltar para a página inicial.',
    contextualCtaLabel: 'Ir para o Início',
    contextualCtaPath: '/',
  },
};
