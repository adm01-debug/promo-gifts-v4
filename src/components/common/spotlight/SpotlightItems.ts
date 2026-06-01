/**
 * Spotlight navigation items definition — extracted from EnhancedSpotlight
 *
 * Cada item declara `path` quando aponta para uma rota; isso permite que
 * `filterByRoutePermission` esconda itens restritos para usuários sem o
 * papel exigido (defesa em profundidade — DevRoute/AdminRoute também
 * bloqueiam o acesso direto pela URL).
 */
import React from 'react';
import {
  Package,
  FileText,
  Users,
  Settings,
  BarChart3,
  Wand2,
  Sparkles,
  Plus,
  Heart,
  Calculator,
  TrendingUp,
  FolderOpen,
  GitCompare,
  ShoppingCart,
  Activity,
  Plug,
  ShieldCheck,
  Workflow,
  PlayCircle,
} from 'lucide-react';

export interface SpotlightItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  shortcut?: string;
  isQuickAction?: boolean;
  /**
   * Path da rota associada (quando aplicável). Usado por
   * `filterByRoutePermission` para esconder o item de usuários sem
   * permissão. Ações puramente locais (toggle de tema, abrir help) podem
   * omitir.
   */
  path?: string;
}

export function buildSpotlightItems(
  navigate: (path: string) => void,
  onRestartTour?: () => void,
): SpotlightItem[] {
  const nav = (path: string) => () => navigate(path);
  return [
    // Help & Onboarding
    {
      id: 'restart-tour',
      title: 'Reiniciar Tour do Sistema',
      description: 'Ver o guia passo-a-passo novamente',
      icon: React.createElement(PlayCircle, { className: 'h-4 w-4' }),
      action: onRestartTour || (() => {}),
      category: 'Ajuda',
      shortcut: '?',
      isQuickAction: true,
    },
    // Quick Actions
    {
      id: 'new-quote',
      title: 'Novo Orçamento',
      description: 'Criar orçamento rapidamente',
      icon: React.createElement(Plus, { className: 'h-4 w-4' }),
      action: nav('/orcamentos/novo'),
      path: '/orcamentos/novo',
      category: 'Ações Rápidas',
      shortcut: 'N',
      isQuickAction: true,
    },
    {
      id: 'mockup-quick',
      title: 'Gerar Mockup',
      description: 'Criar mockup com logo',
      icon: React.createElement(Wand2, { className: 'h-4 w-4' }),
      action: nav('/mockup-generator'),
      path: '/mockup-generator',
      category: 'Ações Rápidas',
      shortcut: 'M',
      isQuickAction: true,
    },
    // Navigation
    {
      id: 'products',
      title: 'Catálogo de Produtos',
      description: 'Navegar pelo catálogo completo',
      icon: React.createElement(Package, { className: 'h-4 w-4' }),
      action: nav('/'),
      path: '/',
      category: 'Navegação',
    },
    {
      id: 'quotes',
      title: 'Orçamentos',
      description: 'Gerenciar todos os orçamentos',
      icon: React.createElement(FileText, { className: 'h-4 w-4' }),
      action: nav('/orcamentos'),
      path: '/orcamentos',
      category: 'Navegação',
    },
    {
      id: 'collections',
      title: 'Coleções',
      description: 'Ver suas coleções',
      icon: React.createElement(FolderOpen, { className: 'h-4 w-4' }),
      action: nav('/colecoes'),
      path: '/colecoes',
      category: 'Navegação',
    },
    {
      id: 'kit-library',
      title: 'Biblioteca de Kits',
      description: 'Meus kits + sugeridos (G K)',
      icon: React.createElement(Package, { className: 'h-4 w-4' }),
      action: nav('/meus-kits'),
      path: '/meus-kits',
      category: 'Navegação',
      shortcut: 'G K',
    },
    {
      id: 'kit-builder',
      title: 'Montar novo kit',
      description: 'Abrir Kit Maker',
      icon: React.createElement(Plus, { className: 'h-4 w-4' }),
      action: nav('/montar-kit'),
      path: '/montar-kit',
      category: 'Navegação',
    },
    {
      id: 'favorites',
      title: 'Favoritos',
      description: 'Produtos favoritos',
      icon: React.createElement(Heart, { className: 'h-4 w-4' }),
      action: nav('/favoritos'),
      path: '/favoritos',
      category: 'Navegação',
    },
    {
      id: 'seller-carts',
      title: 'Carrinhos',
      description: 'Gerenciar carrinhos de orçamento',
      icon: React.createElement(ShoppingCart, { className: 'h-4 w-4' }),
      action: nav('/carrinhos'),
      path: '/carrinhos',
      category: 'Navegação',
    },
    {
      id: 'compare',
      title: 'Comparar Produtos',
      description: 'Comparação lado a lado',
      icon: React.createElement(GitCompare, { className: 'h-4 w-4' }),
      action: nav('/comparar'),
      path: '/comparar',
      category: 'Navegação',
    },
    // Tools
    {
      id: 'simulator',
      title: 'Simulador de Custos',
      description: 'Calcular personalização',
      icon: React.createElement(Calculator, { className: 'h-4 w-4' }),
      action: nav('/simulador'),
      path: '/simulador',
      category: 'Ferramentas',
    },
    {
      id: 'mockup',
      title: 'Gerador de Mockup',
      description: 'Mockups profissionais',
      icon: React.createElement(Wand2, { className: 'h-4 w-4' }),
      action: nav('/mockup-generator'),
      path: '/mockup-generator',
      category: 'Ferramentas',
    },
    {
      id: 'magic-up',
      title: 'Magic Up',
      description: 'IA para edição de imagens',
      icon: React.createElement(Sparkles, { className: 'h-4 w-4' }),
      action: nav('/magic-up'),
      path: '/magic-up',
      category: 'Ferramentas',
    },
    {
      id: 'commercial-intelligence',
      title: 'Inteligência Comercial',
      description: 'Insights estratégicos de vendas',
      icon: React.createElement(BarChart3, { className: 'h-4 w-4' }),
      action: nav('/inteligencia-comercial'),
      path: '/inteligencia-comercial',
      category: 'Ferramentas',
    },
    // Analytics
    {
      id: 'trends',
      title: 'Tendências',
      description: 'Análise de tendências',
      icon: React.createElement(TrendingUp, { className: 'h-4 w-4' }),
      action: nav('/tendencias'),
      path: '/tendencias',
      category: 'Analytics',
    },
    // Admin (visível apenas a admin/dev — filtrado em runtime)
    {
      id: 'users-admin',
      title: 'Gestão de Usuários',
      description: 'Gerenciar usuários e perfis',
      icon: React.createElement(Users, { className: 'h-4 w-4' }),
      action: nav('/admin/usuarios'),
      path: '/admin/usuarios',
      category: 'Admin',
    },
    {
      id: 'admin-cadastros',
      title: 'Cadastros',
      description: 'Produtos, fornecedores, gravação',
      icon: React.createElement(Settings, { className: 'h-4 w-4' }),
      action: nav('/admin/cadastros'),
      path: '/admin/cadastros',
      category: 'Admin',
    },
    // Dev / Técnico (visível apenas a dev — filtrado em runtime)
    {
      id: 'dev-telemetria',
      title: 'Telemetria',
      description: 'Métricas e logs de edge functions',
      icon: React.createElement(Activity, { className: 'h-4 w-4' }),
      action: nav('/admin/telemetria'),
      path: '/admin/telemetria',
      category: 'Dev',
    },
    {
      id: 'dev-conexoes',
      title: 'Conexões externas',
      description: 'Bitrix, n8n, MCP, webhooks',
      icon: React.createElement(Plug, { className: 'h-4 w-4' }),
      action: nav('/admin/conexoes'),
      path: '/admin/conexoes',
      category: 'Dev',
    },
    {
      id: 'dev-seguranca',
      title: 'Segurança',
      description: 'Audit log e RLS',
      icon: React.createElement(ShieldCheck, { className: 'h-4 w-4' }),
      action: nav('/admin/seguranca'),
      path: '/admin/seguranca',
      category: 'Dev',
    },
    {
      id: 'dev-workflows',
      title: 'Workflows IA',
      description: 'Pipelines automáticos',
      icon: React.createElement(Workflow, { className: 'h-4 w-4' }),
      action: nav('/admin/workflows'),
      path: '/admin/workflows',
      category: 'Dev',
    },
    {
      id: 'dev-rbac',
      title: 'Auditoria RBAC de Rotas',
      description: 'Matriz de papéis × rotas',
      icon: React.createElement(ShieldCheck, { className: 'h-4 w-4' }),
      action: nav('/admin/rbac-rotas'),
      path: '/admin/rbac-rotas',
      category: 'Dev',
    },
  ];
}
