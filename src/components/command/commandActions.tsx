/**
 * commandActions — Definição centralizada das ações do CommandBar
 */
import {
  Package,
  FileText,
  Calculator,
  Settings,
  Home,
  Palette,
  Layers,
  Box,
  Calendar,
  Zap,
  BarChart3,
  Filter,
  PlusCircle,
  RefreshCw,
  Download,
  Printer,
  HelpCircle,
  Moon,
  Sun,
  BookOpen,
  Grid,
  Activity,
} from 'lucide-react';
import type { ReactNode } from 'react';

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: ReactNode;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
  category: 'navigation' | 'action' | 'recent' | 'quick' | 'settings' | 'help';
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  /**
   * Path da rota associada (quando aplicável). Permite que
   * `filterByRoutePermission` esconda a ação para usuários que não
   * podem navegar até a rota (ver `RBAC_ROUTES`).
   */
  path?: string;
}

export interface RecentItem {
  id: string;
  type: 'product' | 'client' | 'quote' | 'page';
  label: string;
  path: string;
  timestamp: number;
}

export const RECENT_ITEMS_KEY = 'command-bar-recent';

interface BuildActionsParams {
  goTo: (path: string, label: string, type?: RecentItem['type']) => void;
  actualTheme: string;
  setTheme: (t: string) => void;
  setOpen: (v: boolean) => void;
}

export function buildActions({
  goTo,
  actualTheme,
  setTheme,
  setOpen,
}: BuildActionsParams): CommandAction[] {
  return [
    // Quick Actions
    {
      id: 'new-quote',
      label: 'Novo Orçamento',
      description: 'Criar um novo orçamento rápido',
      icon: <PlusCircle className="h-4 w-4" />,
      shortcut: '⌘N',
      action: () => goTo('/orcamentos/novo', 'Novo Orçamento'),
      keywords: ['criar', 'orçamento', 'novo', 'quote'],
      category: 'quick',
      badge: 'Ação',
      badgeVariant: 'default',
    },
    {
      id: 'simulator',
      label: 'Abrir Simulador',
      description: 'Simular preços de personalização',
      icon: <Calculator className="h-4 w-4" />,
      shortcut: '⌘S',
      action: () => goTo('/simulador', 'Simulador'),
      keywords: ['simulador', 'calcular', 'preço', 'personalização'],
      category: 'quick',
      badge: 'Popular',
      badgeVariant: 'secondary',
    },
    {
      id: 'compare',
      label: 'Comparar Produtos',
      description: 'Comparar produtos lado a lado',
      icon: <Layers className="h-4 w-4" />,
      action: () => goTo('/comparar', 'Comparar Produtos'),
      keywords: ['comparar', 'produto', 'compare'],
      category: 'quick',
    },
    // Navigation
    {
      id: 'home',
      label: 'Dashboard',
      description: 'Voltar para o início',
      icon: <Home className="h-4 w-4" />,
      shortcut: '⌘H',
      action: () => goTo('/', 'Dashboard'),
      keywords: ['home', 'início', 'dashboard', 'principal'],
      category: 'navigation',
    },
    {
      id: 'products',
      label: 'Catálogo de Produtos',
      description: 'Ver todos os produtos',
      icon: <Package className="h-4 w-4" />,
      action: () => goTo('/catalogo', 'Catálogo'),
      keywords: ['produtos', 'catálogo', 'catalog', 'items'],
      category: 'navigation',
    },
    {
      id: 'novelties',
      label: 'Novidades',
      description: 'Produtos recém-adicionados',
      icon: <Zap className="h-4 w-4" />,
      action: () => goTo('/novidades', 'Novidades'),
      keywords: ['novidades', 'novo', 'lançamento', 'new'],
      category: 'navigation',
      badge: 'Novo',
      badgeVariant: 'destructive',
    },
    {
      id: 'quotes',
      label: 'Orçamentos',
      description: 'Ver todos os orçamentos',
      icon: <FileText className="h-4 w-4" />,
      action: () => goTo('/orcamentos', 'Orçamentos'),
      keywords: ['orçamentos', 'quotes', 'propostas'],
      category: 'navigation',
    },
    {
      id: 'techniques',
      label: 'Técnicas de Personalização',
      description: 'Gerenciar técnicas',
      icon: <Palette className="h-4 w-4" />,
      action: () => goTo('/tecnicas', 'Técnicas'),
      keywords: ['técnicas', 'personalização', 'gravação', 'silk'],
      category: 'navigation',
    },
    {
      id: 'collections',
      label: 'Coleções',
      description: 'Ver coleções de produtos',
      icon: <Grid className="h-4 w-4" />,
      action: () => goTo('/colecoes', 'Coleções'),
      keywords: ['coleções', 'collections', 'grupos'],
      category: 'navigation',
    },
    {
      id: 'filters',
      label: 'Filtros Avançados',
      description: 'Filtrar produtos com múltiplos critérios',
      icon: <Filter className="h-4 w-4" />,
      action: () => goTo('/filtros', 'Filtros'),
      keywords: ['filtros', 'busca', 'search', 'advanced'],
      category: 'navigation',
    },
    {
      id: 'stock',
      label: 'Controle de Estoque',
      description: 'Monitorar estoque e alertas',
      icon: <Box className="h-4 w-4" />,
      action: () => goTo('/estoque', 'Estoque'),
      keywords: ['estoque', 'stock', 'inventário', 'alertas'],
      category: 'navigation',
    },
    {
      id: 'dates',
      label: 'Datas Comemorativas',
      description: 'Calendário de datas especiais',
      icon: <Calendar className="h-4 w-4" />,
      action: () => goTo('/datas-comemorativas', 'Datas'),
      keywords: ['datas', 'comemorativas', 'calendar', 'eventos'],
      category: 'navigation',
    },
    {
      id: 'reports',
      label: 'Relatórios',
      description: 'Ver relatórios e métricas',
      icon: <BarChart3 className="h-4 w-4" />,
      action: () => goTo('/relatorios', 'Relatórios'),
      keywords: ['relatórios', 'reports', 'métricas', 'analytics'],
      category: 'navigation',
    },
    {
      id: 'performance-ux',
      label: 'Performance UX',
      description: 'Monitorar telemetria e latência',
      icon: <Activity className="h-4 w-4" />,
      action: () => goTo('/admin/performance', 'Performance UX'),
      keywords: ['performance', 'latência', 'telemetria', 'admin', 'ux'],
      category: 'navigation',
      badge: 'Admin',
      badgeVariant: 'outline',
    },
    // Actions
    {
      id: 'export-pdf',
      label: 'Exportar como PDF',
      description: 'Exportar dados para PDF',
      icon: <Download className="h-4 w-4" />,
      action: () => {
        window.dispatchEvent(new CustomEvent('export-pdf'));
        setOpen(false);
      },
      keywords: ['exportar', 'pdf', 'download', 'export'],
      category: 'action',
    },
    {
      id: 'print',
      label: 'Imprimir',
      description: 'Imprimir página atual',
      icon: <Printer className="h-4 w-4" />,
      shortcut: '⌘P',
      action: () => {
        window.print();
        setOpen(false);
      },
      keywords: ['imprimir', 'print'],
      category: 'action',
    },
    {
      id: 'refresh',
      label: 'Atualizar Dados',
      description: 'Recarregar dados da página',
      icon: <RefreshCw className="h-4 w-4" />,
      shortcut: '⌘R',
      action: () => {
        window.location.reload();
      },
      keywords: ['atualizar', 'refresh', 'reload'],
      category: 'action',
    },
    // Settings
    {
      id: 'settings',
      label: 'Configurações',
      description: 'Acessar configurações do sistema',
      icon: <Settings className="h-4 w-4" />,
      action: () => goTo('/configuracoes', 'Configurações'),
      keywords: ['configurações', 'settings', 'preferências'],
      category: 'settings',
    },
    {
      id: 'theme-toggle',
      label: actualTheme === 'dark' ? 'Modo Claro' : 'Modo Escuro',
      description: 'Alternar tema do sistema',
      icon: actualTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
      shortcut: '⌘D',
      action: () => {
        setTheme(actualTheme === 'dark' ? 'light' : 'dark');
      },
      keywords: ['tema', 'theme', 'dark', 'light', 'escuro', 'claro'],
      category: 'settings',
    },
    // Help
    {
      id: 'help',
      label: 'Central de Ajuda',
      description: 'Tutoriais e documentação',
      icon: <HelpCircle className="h-4 w-4" />,
      shortcut: '⌘/',
      action: () => goTo('/ajuda', 'Ajuda'),
      keywords: ['ajuda', 'help', 'suporte', 'tutorial'],
      category: 'help',
    },
    {
      id: 'shortcuts',
      label: 'Atalhos de Teclado',
      description: 'Ver todos os atalhos disponíveis',
      icon: <BookOpen className="h-4 w-4" />,
      action: () => {
        setOpen(false);
        window.dispatchEvent(new CustomEvent('open-shortcuts-help'));
      },
      keywords: ['atalhos', 'shortcuts', 'keyboard', 'teclado'],
      category: 'help',
    },
  ];
}
