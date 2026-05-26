import { describe, expect, it } from 'vitest';
import { EDGE_AUTHZ_MANIFEST } from '@/../supabase/functions/_shared/edge-authz-manifest';

const entry = (name: string) => EDGE_AUTHZ_MANIFEST[name];

describe('edge authz matrix — user/admin/service', () => {
  it('usuário autenticado acessa apenas recursos da categoria authenticated', () => {
    expect(entry('send-notification')?.category).toBe('authenticated');
    expect(entry('bitrix-sync')?.category).not.toBe('authenticated');
    expect(entry('sync-external-db')?.category).not.toBe('authenticated');
  });

  it('admin/supervisor fica restrito aos endpoints de supervisão (não service)', () => {
    expect(entry('bitrix-sync')?.category).toBe('supervisor');
    expect(entry('manage-users')?.category).toBe('supervisor');
    expect(entry('sync-external-db')?.category).toBe('service');
  });

  it('service role é reservada para integrações server-to-server', () => {
    expect(entry('sync-external-db')?.category).toBe('service');
    expect(entry('sync-external-db')?.rationale.toLowerCase()).toContain('server-to-server');
  });
});

describe('terceiros e escopos insuficientes', () => {
  it('recursos de terceiros ficam explícitos e não sobem privilégio por engano', () => {
    expect(entry('image-proxy')?.category).toBe('public');
    expect(entry('cnpj-lookup')?.category).toBe('public');
    expect(entry('dropbox-list')?.category).toBe('public');
  });

  it('ferramentas MCP com escopo custom permanecem na categoria scoped', () => {
    expect(entry('mcp-server')?.category).toBe('scoped');
    expect(entry('mcp-server')?.rationale.toLowerCase()).toContain('escopos');
  });

  it('bridge para CRM externo exige escopo custom (nega token sem escopo suficiente)', () => {
    expect(entry('crm-db-bridge')?.category).toBe('scoped');
    expect(entry('crm-db-bridge')?.enforcedBy).toBe('custom');
  });
});
