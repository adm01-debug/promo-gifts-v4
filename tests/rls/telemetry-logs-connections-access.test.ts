/**
 * RLS — Acesso a Telemetria, Logs e Conexões por Role
 *
 * Valida, após a migration que substituiu `has_role(...,'admin')` por
 * `is_supervisor_or_above(...)` e que tornou `is_admin()` um alias dela,
 * que:
 *   - dev tem acesso de leitura (e gestão, quando aplicável) a telemetria,
 *     logs e conexões.
 *   - agente (vendedor) é bloqueado nessas áreas.
 *
 * O teste opera em duas camadas:
 *   1. Simulação determinística das funções gate (`is_dev`,
 *      `is_supervisor_or_above`, `is_admin`) por role — espelho 1:1 das
 *      definições em produção.
 *   2. Matriz de policies dessas tabelas (espelho de pg_policies) —
 *      cada policy é mapeada à função gate que ela usa, e a expectativa
 *      por role é validada.
 *
 * Caso uma policy do banco mude para um gate diferente, atualize a matriz
 * abaixo. O teste falhará se a expectativa por role divergir.
 */
import { describe, it, expect } from 'vitest';

// ---------- Roles ----------
type Role = 'dev' | 'supervisor' | 'admin' | 'manager' | 'agente' | 'anon';

const ROLES: Role[] = ['dev', 'supervisor', 'admin', 'manager', 'agente', 'anon'];

// ---------- Gate functions (espelho do BD) ----------
// public.is_supervisor_or_above(_user_id) → role IN (dev, supervisor, admin, manager)
const isSupervisorOrAbove = (r: Role) =>
  r === 'dev' || r === 'supervisor' || r === 'admin' || r === 'manager';

// public.is_admin() / is_admin(_user_id) → SELECT is_supervisor_or_above(...)
const isAdmin = (r: Role) => isSupervisorOrAbove(r);

// public.is_dev(_user_id) → role = 'dev'
const isDev = (r: Role) => r === 'dev';

// ---------- Helpers semânticos (espelho 1:1 das funções no BD) ----------
// Aliases bem-nomeados que devem ser preferidos em novas policies, em vez
// de `has_role(...,'admin')` ou checagens diretas de papel.
const canViewAuditLogs   = (r: Role) => isDev(r);
const canViewTelemetry   = (r: Role) => isSupervisorOrAbove(r);
const canViewConnections = (r: Role) => isSupervisorOrAbove(r);
const canManageConnections = (r: Role) => isSupervisorOrAbove(r);

// ---------- Matriz de policies (telemetria / logs / conexões) ----------
type Gate =
  | 'is_admin'
  | 'is_supervisor_or_above'
  | 'is_dev'
  | 'public_select'
  | 'can_view_audit_logs'
  | 'can_view_telemetry'
  | 'can_view_connections'
  | 'can_manage_connections';

interface PolicyRow {
  table: string;
  policy: string;
  cmd: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  gate: Gate;
}

// Espelho do retorno de pg_policies para o subconjunto telemetria/logs/conexões.
const POLICIES: PolicyRow[] = [
  // admin_audit_log
  { table: 'admin_audit_log', policy: 'Devs can read audit logs', cmd: 'SELECT', gate: 'is_dev' },
  { table: 'admin_audit_log', policy: 'Supervisors can insert audit entries', cmd: 'INSERT', gate: 'is_supervisor_or_above' },

  // ai_usage_logs
  { table: 'ai_usage_logs', policy: 'Admins can view all AI usage logs', cmd: 'SELECT', gate: 'is_admin' },

  // ai_usage_quotas
  { table: 'ai_usage_quotas', policy: 'Admins can manage quotas', cmd: 'ALL', gate: 'is_admin' },

  // bot_detection_log
  { table: 'bot_detection_log', policy: 'Admins can read bot log', cmd: 'SELECT', gate: 'is_admin' },

  // external_connections_sync_log
  { table: 'external_connections_sync_log', policy: 'Admins read external_connections_sync_log', cmd: 'SELECT', gate: 'is_admin' },

  // integration_credentials
  { table: 'integration_credentials', policy: 'Admins can view integration credentials', cmd: 'SELECT', gate: 'is_admin' },
  { table: 'integration_credentials', policy: 'Admins can insert integration credentials', cmd: 'INSERT', gate: 'is_admin' },
  { table: 'integration_credentials', policy: 'Admins can update integration credentials', cmd: 'UPDATE', gate: 'is_admin' },
  { table: 'integration_credentials', policy: 'Admins can delete integration credentials', cmd: 'DELETE', gate: 'is_admin' },

  // inbound_webhook_endpoints
  { table: 'inbound_webhook_endpoints', policy: 'Admins manage inbound_webhook_endpoints', cmd: 'ALL', gate: 'is_admin' },

  // inbound_webhook_events
  { table: 'inbound_webhook_events', policy: 'Admins read inbound_webhook_events', cmd: 'SELECT', gate: 'is_admin' },
  { table: 'inbound_webhook_events', policy: 'Admins delete inbound_webhook_events', cmd: 'DELETE', gate: 'is_admin' },

  // ip_access_control
  { table: 'ip_access_control', policy: 'Admins can manage ip_access_control', cmd: 'ALL', gate: 'is_admin' },
];

// ---------- Avaliador ----------
function evaluateGate(gate: Gate, role: Role): boolean {
  if (role === 'anon') return false;
  switch (gate) {
    case 'is_dev': return isDev(role);
    case 'is_supervisor_or_above': return isSupervisorOrAbove(role);
    case 'is_admin': return isAdmin(role);
    case 'can_view_audit_logs': return canViewAuditLogs(role);
    case 'can_view_telemetry': return canViewTelemetry(role);
    case 'can_view_connections': return canViewConnections(role);
    case 'can_manage_connections': return canManageConnections(role);
    case 'public_select': return true;
  }
}

// ---------- Helpers semânticos: equivalência com gates primitivos ----------
describe('Helpers semânticos — alinhamento com gates primitivos', () => {
  ROLES.forEach((r) => {
    it(`can_view_audit_logs(${r}) === is_dev(${r})`, () => {
      expect(canViewAuditLogs(r)).toBe(isDev(r));
    });
    it(`can_view_telemetry(${r}) === is_supervisor_or_above(${r})`, () => {
      expect(canViewTelemetry(r)).toBe(isSupervisorOrAbove(r));
    });
    it(`can_view_connections(${r}) === is_supervisor_or_above(${r})`, () => {
      expect(canViewConnections(r)).toBe(isSupervisorOrAbove(r));
    });
    it(`can_manage_connections(${r}) === is_supervisor_or_above(${r})`, () => {
      expect(canManageConnections(r)).toBe(isSupervisorOrAbove(r));
    });
  });

  it('agente é bloqueado em todos os helpers', () => {
    expect(canViewAuditLogs('agente')).toBe(false);
    expect(canViewTelemetry('agente')).toBe(false);
    expect(canViewConnections('agente')).toBe(false);
    expect(canManageConnections('agente')).toBe(false);
  });

  it('dev passa em todos os helpers', () => {
    expect(canViewAuditLogs('dev')).toBe(true);
    expect(canViewTelemetry('dev')).toBe(true);
    expect(canViewConnections('dev')).toBe(true);
    expect(canManageConnections('dev')).toBe(true);
  });
});

// ---------- Sanidade dos gates ----------
describe('Gate functions — sanidade pós-migration', () => {
  it('is_supervisor_or_above inclui dev/supervisor/admin/manager e bloqueia agente/anon', () => {
    expect(isSupervisorOrAbove('dev')).toBe(true);
    expect(isSupervisorOrAbove('supervisor')).toBe(true);
    expect(isSupervisorOrAbove('admin')).toBe(true);
    expect(isSupervisorOrAbove('manager')).toBe(true);
    expect(isSupervisorOrAbove('agente')).toBe(false);
    expect(isSupervisorOrAbove('anon')).toBe(false);
  });

  it('is_admin é alias de is_supervisor_or_above (dev passa)', () => {
    expect(isAdmin('dev')).toBe(true);
    expect(isAdmin('agente')).toBe(false);
  });

  it('is_dev é restrito ao papel dev', () => {
    expect(isDev('dev')).toBe(true);
    (['supervisor', 'admin', 'manager', 'agente', 'anon'] as Role[]).forEach((r) =>
      expect(isDev(r)).toBe(false)
    );
  });
});

// ---------- DEV: deve passar em TODAS as policies de telemetria/logs/conexões ----------
describe('DEV — acesso a telemetria, logs e conexões', () => {
  POLICIES.forEach(({ table, policy, cmd, gate }) => {
    it(`${table} :: "${policy}" (${cmd}) → permite dev`, () => {
      expect(evaluateGate(gate, 'dev')).toBe(true);
    });
  });
});

// ---------- AGENTE: deve ser bloqueado em TODAS ----------
describe('AGENTE (vendedor) — bloqueado em telemetria, logs e conexões', () => {
  POLICIES.forEach(({ table, policy, cmd, gate }) => {
    it(`${table} :: "${policy}" (${cmd}) → bloqueia agente`, () => {
      expect(evaluateGate(gate, 'agente')).toBe(false);
    });
  });
});

// ---------- ANON: também bloqueado ----------
describe('ANON — bloqueado em telemetria, logs e conexões', () => {
  POLICIES.forEach(({ table, policy, cmd, gate }) => {
    it(`${table} :: "${policy}" (${cmd}) → bloqueia anon`, () => {
      expect(evaluateGate(gate, 'anon')).toBe(false);
    });
  });
});

// ---------- Regressão específica: nenhuma policy ainda usa 'admin' literal ----------
describe('Regressão pós-migration — papel "admin" literal', () => {
  it('nenhuma policy desta matriz aponta para gate inexistente "has_role admin"', () => {
    const validGates: Gate[] = [
      'is_admin', 'is_supervisor_or_above', 'is_dev', 'public_select',
      'can_view_audit_logs', 'can_view_telemetry',
      'can_view_connections', 'can_manage_connections',
    ];
    POLICIES.forEach((p) => {
      expect(validGates).toContain(p.gate);
    });
  });

  it('toda policy de leitura (SELECT/ALL) é acessível por dev', () => {
    POLICIES.filter((p) => p.cmd === 'SELECT' || p.cmd === 'ALL').forEach((p) => {
      expect(evaluateGate(p.gate, 'dev')).toBe(true);
    });
  });
});

// ---------- Matriz por role × tabela (resumo) ----------
describe('Matriz role × tabela (telemetria/logs/conexões)', () => {
  const tables = Array.from(new Set(POLICIES.map((p) => p.table)));

  ROLES.forEach((role) => {
    const expected = role !== 'agente' && role !== 'anon';
    it(`${role} → ${expected ? 'acessa' : 'NÃO acessa'} pelo menos uma policy de cada tabela`, () => {
      tables.forEach((t) => {
        const tablePolicies = POLICIES.filter((p) => p.table === t);
        const hasAccess = tablePolicies.some((p) => evaluateGate(p.gate, role));
        expect(hasAccess, `role=${role} table=${t}`).toBe(expected);
      });
    });
  });
});
