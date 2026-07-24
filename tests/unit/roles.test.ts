/**
 * Unit tests for src/lib/roles.ts
 *
 * getRoleLabel, getRoleVisual, ROLE_VISUAL
 */
import { describe, it, expect } from 'vitest';
import { getRoleLabel, getRoleVisual, ROLE_VISUAL } from '@/lib/roles';

// ============================================
// getRoleLabel
// ============================================

describe('getRoleLabel', () => {
  it('returns "Dev" for role "dev"', () => {
    expect(getRoleLabel('dev')).toBe('Dev');
  });

  it('returns "Supervisor" for role "supervisor"', () => {
    expect(getRoleLabel('supervisor')).toBe('Supervisor');
  });

  it('returns "Agente" for role "vendedor"', () => {
    expect(getRoleLabel('vendedor')).toBe('Agente');
  });

  it('returns "Agente" for role "agente"', () => {
    expect(getRoleLabel('agente')).toBe('Agente');
  });

  it('returns "Coordenador" for role "coordenador"', () => {
    expect(getRoleLabel('coordenador')).toBe('Coordenador');
  });

  it('returns "Supervisor" for legacy alias "admin"', () => {
    expect(getRoleLabel('admin')).toBe('Supervisor');
  });

  it('returns "Supervisor" for legacy alias "manager"', () => {
    expect(getRoleLabel('manager')).toBe('Supervisor');
  });

  it('returns "Agente" fallback for null', () => {
    expect(getRoleLabel(null)).toBe('Agente');
  });

  it('returns "Agente" fallback for undefined', () => {
    expect(getRoleLabel(undefined)).toBe('Agente');
  });

  it('returns "Agente" fallback for empty string', () => {
    expect(getRoleLabel('')).toBe('Agente');
  });

  it('returns "Agente" fallback for unknown role string', () => {
    expect(getRoleLabel('rogue-role')).toBe('Agente');
    expect(getRoleLabel('SUPERVISOR')).toBe('Agente'); // case-sensitive
  });
});

// ============================================
// getRoleVisual
// ============================================

describe('getRoleVisual', () => {
  it('returns ROLE_VISUAL.dev for "dev"', () => {
    const v = getRoleVisual('dev');
    expect(v.label).toBe('Dev');
    expect(v.variant).toBe('default');
  });

  it('returns ROLE_VISUAL.supervisor for "supervisor"', () => {
    const v = getRoleVisual('supervisor');
    expect(v.label).toBe('Supervisor');
  });

  it('returns ROLE_VISUAL.vendedor for "vendedor"', () => {
    const v = getRoleVisual('vendedor');
    expect(v.label).toBe('Agente');
    expect(v.variant).toBe('secondary');
  });

  it('admin and manager alias share Supervisor visual', () => {
    const admin = getRoleVisual('admin');
    const manager = getRoleVisual('manager');
    const supervisor = getRoleVisual('supervisor');
    expect(admin.label).toBe(supervisor.label);
    expect(manager.label).toBe(supervisor.label);
    expect(admin.className).toBe(supervisor.className);
  });

  it('returns ROLE_VISUAL.vendedor fallback for null', () => {
    const v = getRoleVisual(null);
    expect(v.label).toBe('Agente');
  });

  it('returns ROLE_VISUAL.vendedor fallback for undefined', () => {
    const v = getRoleVisual(undefined);
    expect(v.label).toBe('Agente');
  });

  it('returns ROLE_VISUAL.vendedor fallback for unknown role', () => {
    const v = getRoleVisual('unknown-role');
    expect(v.label).toBe('Agente');
    expect(v.variant).toBe('secondary');
  });

  it('every role visual has a truthy Icon', () => {
    for (const [, visual] of Object.entries(ROLE_VISUAL)) {
      expect(visual.Icon).toBeTruthy();
    }
  });

  it('every role visual has a non-empty description', () => {
    for (const [, visual] of Object.entries(ROLE_VISUAL)) {
      expect(visual.description.length).toBeGreaterThan(0);
    }
  });
});
