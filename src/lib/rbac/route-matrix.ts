/**
 * SSOT auditável da matriz de acesso por rota.
 *
 * Esta tabela é a fonte única para a página /admin/rbac-rotas.
 * Atualize SEMPRE que adicionar/remover uma rota técnica ou trocar guard.
 *
 * Convenções:
 *  - guard:    componente real usado no roteador (App.tsx).
 *  - role:     papel mínimo necessário, na nomenclatura do app.
 *  - mfaAal2:  exige sessão AAL2 (DevRoute e AdminRoute aplicam).
 *  - rlsHelper: função SQL preferencial nas RLS policies relacionadas.
 *  - notes:    observações operacionais (histórico, escopo).
 */

export type RouteRole = 'admin' | 'authenticated' | 'dev' | 'public';
export type RouteGuard = 'AdminRoute' | 'DevRoute' | 'ProtectedRoute' | 'public';

export interface RbacRouteEntry {
  path: string;
  label: string;
  guard: RouteGuard;
  role: RouteRole;
  mfaAal2: boolean;
  rlsHelper?: string;
  notes?: string;
  category:
    | 'admin'
    | 'ai'
    | 'audit'
    | 'catalog'
    | 'connections'
    | 'ops'
    | 'public'
    | 'secrets'
    | 'telemetry'
    | 'user';
}

/** Lista canônica e ordenada das rotas do app. */
export const RBAC_ROUTES: RbacRouteEntry[] = [
  // ─── Públicas ─────────────────────────────────────────────────────────
  {
    path: '/login',
    label: 'Login',
    guard: 'public',
    role: 'public',
    mfaAal2: false,
    category: 'public',
  },
  {
    path: '/reset-password',
    label: 'Redefinir senha',
    guard: 'public',
    role: 'public',
    mfaAal2: false,
    category: 'public',
  },
  {
    path: '/approve/:token',
    label: 'Aprovação pública de orçamento',
    guard: 'public',
    role: 'public',
    mfaAal2: false,
    category: 'public',
  },
  {
    path: '/proposta/:token',
    label: 'Proposta pública',
    guard: 'public',
    role: 'public',
    mfaAal2: false,
    category: 'public',
  },
  {
    path: '/kit/:token',
    label: 'Kit público',
    guard: 'public',
    role: 'public',
    mfaAal2: false,
    category: 'public',
  },
  {
    path: '/lista-publica/:token',
    label: 'Lista de favoritos pública',
    guard: 'public',
    role: 'public',
    mfaAal2: false,
    category: 'public',
  },
  {
    path: '/colecao-publica/:token',
    label: 'Coleção pública',
    guard: 'public',
    role: 'public',
    mfaAal2: false,
    category: 'public',
  },
  {
    path: '/comparar-publica/:token',
    label: 'Comparação pública',
    guard: 'public',
    role: 'public',
    mfaAal2: false,
    category: 'public',
  },
  {
    path: '/dossie/:token',
    label: 'Dossiê público',
    guard: 'public',
    role: 'public',
    mfaAal2: false,
    category: 'public',
  },
  {
    path: '/auth/callback',
    label: 'Callback SSO',
    guard: 'public',
    role: 'public',
    mfaAal2: false,
    category: 'public',
  },

  // ─── Autenticadas (qualquer papel logado) ────────────────────────────
  {
    path: '/',
    label: 'Início / Catálogo',
    guard: 'ProtectedRoute',
    role: 'authenticated',
    mfaAal2: false,
    category: 'catalog',
  },
  {
    path: '/dashboard',
    label: 'Dashboard pessoal',
    guard: 'ProtectedRoute',
    role: 'authenticated',
    mfaAal2: false,
    category: 'user',
  },
  {
    path: '/produtos',
    label: 'Produtos',
    guard: 'ProtectedRoute',
    role: 'authenticated',
    mfaAal2: false,
    category: 'catalog',
  },
  {
    path: '/orcamentos',
    label: 'Orçamentos',
    guard: 'ProtectedRoute',
    role: 'authenticated',
    mfaAal2: false,
    category: 'user',
  },
  {
    path: '/carrinhos',
    label: 'Carrinhos',
    guard: 'ProtectedRoute',
    role: 'authenticated',
    mfaAal2: false,
    category: 'user',
  },
  {
    path: '/favoritos',
    label: 'Favoritos',
    guard: 'ProtectedRoute',
    role: 'authenticated',
    mfaAal2: false,
    category: 'user',
  },
  {
    path: '/comparar',
    label: 'Comparador',
    guard: 'ProtectedRoute',
    role: 'authenticated',
    mfaAal2: false,
    category: 'user',
  },
  {
    path: '/colecoes',
    label: 'Coleções',
    guard: 'ProtectedRoute',
    role: 'authenticated',
    mfaAal2: false,
    category: 'user',
  },
  {
    path: '/estoque',
    label: 'Estoque',
    guard: 'ProtectedRoute',
    role: 'authenticated',
    mfaAal2: false,
    category: 'user',
  },
  {
    path: '/inteligencia-comercial',
    label: 'Inteligência Comercial',
    guard: 'ProtectedRoute',
    role: 'authenticated',
    mfaAal2: false,
    category: 'user',
  },
  {
    path: '/ferramentas/bi',
    label: 'Business Intelligence',
    guard: 'ProtectedRoute',
    role: 'authenticated',
    mfaAal2: false,
    category: 'user',
  },
  {
    path: '/tendencias',
    label: 'Tendências',
    guard: 'ProtectedRoute',
    role: 'authenticated',
    mfaAal2: false,
    category: 'catalog',
  },

  // ─── Admin (gestão funcional, exige AAL2) ─────────────────────────────
  {
    path: '/admin/usuarios',
    label: 'Usuários',
    guard: 'AdminRoute',
    role: 'admin',
    mfaAal2: true,
    rlsHelper: "is_admin / has_role(_,'admin')",
    category: 'admin',
  },
  {
    path: '/admin/usuarios/promover',
    label: 'Promover usuário',
    guard: 'AdminRoute',
    role: 'admin',
    mfaAal2: true,
    rlsHelper: 'is_admin',
    category: 'admin',
    notes: 'Step-up de segurança aplicado no diálogo.',
  },
  {
    path: '/admin/cadastros',
    label: 'Cadastros',
    guard: 'AdminRoute',
    role: 'admin',
    mfaAal2: true,
    category: 'admin',
  },
  {
    path: '/admin/permissoes',
    label: 'Permissões',
    guard: 'AdminRoute',
    role: 'admin',
    mfaAal2: true,
    rlsHelper: 'is_admin',
    category: 'admin',
  },
  {
    path: '/admin/roles',
    label: 'Papéis',
    guard: 'AdminRoute',
    role: 'admin',
    mfaAal2: true,
    rlsHelper: 'is_admin',
    category: 'admin',
  },
  {
    path: '/admin/role-permissoes',
    label: 'Permissões de Papéis',
    guard: 'AdminRoute',
    role: 'admin',
    mfaAal2: true,
    rlsHelper: 'is_admin',
    category: 'admin',
  },
  {
    path: '/admin/temas',
    label: 'Skins / Temas',
    guard: 'ProtectedRoute',
    role: 'authenticated',
    mfaAal2: false,
    category: 'admin',
    notes: 'Preferência visual local (localStorage). Disponível para qualquer usuário autenticado.',
  },
  {
    path: '/admin/kit-templates',
    label: 'Templates de Kit',
    guard: 'AdminRoute',
    role: 'admin',
    mfaAal2: true,
    category: 'admin',
  },
  {
    path: '/admin/video-variantes',
    label: 'Vídeos por variante',
    guard: 'AdminRoute',
    role: 'admin',
    mfaAal2: true,
    category: 'admin',
  },

  // ─── Dev / Técnicas (exigem AAL2 + role dev) ──────────────────────────
  {
    path: '/admin/seguranca',
    label: 'Segurança',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    rlsHelper: 'can_view_audit_logs',
    category: 'audit',
    notes: 'admin_audit_log e RLS de baixo nível.',
  },
  {
    path: '/admin/seguranca-acesso',
    label: 'Acesso & Bots',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    rlsHelper: 'can_view_audit_logs',
    category: 'audit',
    notes: 'ip_access_control, bot_detection_log, login_attempts.',
  },
  {
    path: '/admin/seguranca/chaves',
    label: 'Chaves & Secrets (MCP)',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    rlsHelper: 'is_supervisor_or_above + audit',
    category: 'secrets',
  },
  {
    path: '/admin/conexoes',
    label: 'Conexões externas',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    rlsHelper: 'can_view_connections / can_manage_connections',
    category: 'connections',
  },
  {
    path: '/admin/conexoes/status',
    label: 'Status de conexões',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    rlsHelper: 'can_view_connections',
    category: 'connections',
  },
  {
    path: '/admin/telemetria',
    label: 'Telemetria',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    rlsHelper: 'can_view_telemetry',
    category: 'telemetry',
  },
  {
    path: '/admin/external-db',
    label: 'External DB',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    rlsHelper: 'can_view_telemetry',
    category: 'ops',
  },
  {
    path: '/admin/rate-limit',
    label: 'Rate Limit',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    rlsHelper: 'can_view_telemetry',
    category: 'ops',
  },
  {
    path: '/admin/login-attempts',
    label: 'Tentativas de login',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    rlsHelper: 'can_view_audit_logs',
    category: 'audit',
  },
  {
    path: '/admin/workflows',
    label: 'Workflows IA',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    category: 'ai',
  },
  {
    path: '/admin/prompts-ia',
    label: 'Prompts IA',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    category: 'ai',
  },
  {
    path: '/admin/consumo-ia',
    label: 'Consumo de IA',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    rlsHelper: 'can_view_telemetry',
    category: 'ai',
  },
  {
    path: '/admin/validade-precos',
    label: 'Validade de preços',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    category: 'ops',
  },
  {
    path: '/status',
    label: 'Status do sistema',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    category: 'ops',
  },
  {
    path: '/external-db-test',
    label: 'Teste External DB',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    category: 'ops',
  },
  {
    path: '/admin/rbac-rotas',
    label: 'Auditoria RBAC de Rotas',
    guard: 'DevRoute',
    role: 'dev',
    mfaAal2: true,
    category: 'audit',
    notes: 'Esta página.',
  },
];

/** Resumo agregado para cards de overview. */
export function summarizeRoutes(routes: RbacRouteEntry[] = RBAC_ROUTES) {
  const byRole = { public: 0, authenticated: 0, admin: 0, dev: 0 } as Record<RouteRole, number>;
  let mfa = 0;
  for (const r of routes) {
    byRole[r.role]++;
    if (r.mfaAal2) mfa++;
  }
  return { total: routes.length, byRole, mfa };
}

/**
 * Validação leve de consistência: rotas dev SEMPRE devem exigir AAL2
 * e usar o guard DevRoute. Retorna lista de inconsistências.
 */
export function findInconsistencies(routes: RbacRouteEntry[] = RBAC_ROUTES): string[] {
  const issues: string[] = [];
  for (const r of routes) {
    if (r.role === 'dev' && r.guard !== 'DevRoute') {
      issues.push(`${r.path}: role=dev mas guard=${r.guard}`);
    }
    if (r.role === 'dev' && !r.mfaAal2) {
      issues.push(`${r.path}: role=dev sem MFA/AAL2`);
    }
    if (r.role === 'admin' && !['AdminRoute', 'DevRoute'].includes(r.guard)) {
      issues.push(`${r.path}: role=admin mas guard=${r.guard}`);
    }
    if (r.role === 'admin' && !r.mfaAal2) {
      issues.push(`${r.path}: role=admin sem MFA/AAL2`);
    }
  }
  return issues;
}
