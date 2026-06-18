/**
 * Testes unitários — useUnsavedChangesGuard
 *
 * Previne perda de dados ao navegar com alterações não salvas.
 * Dois mecanismos: beforeunload (aba/refresh) + dialog in-app.
 *
 * Cobertura:
 *   - guardNavigation: ação direta quando sem alterações
 *   - guardNavigation: abre dialog e enfileira ação quando com alterações
 *   - confirmLeave: executa pendingAction e fecha dialog
 *   - cancelLeave: fecha dialog sem executar action
 *   - beforeunload: listener adicionado/removido conforme hasUnsavedChanges
 *   - mensagem padrão e customizada
 *   - múltiplas guardNavigation sequenciais (última ação wins)
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUnsavedChangesGuard } from '../useUnsavedChangesGuard';

// ── Setup: interceptar addEventListener no window ──────────────────────────────
const addEventSpy = vi.spyOn(window, 'addEventListener');
const removeEventSpy = vi.spyOn(window, 'removeEventListener');

beforeEach(() => {
  addEventSpy.mockClear();
  removeEventSpy.mockClear();
});
afterEach(() => {
  vi.clearAllMocks();
});

// ── Estado inicial ────────────────────────────────────────────────────────────
describe('estado inicial', () => {
  it('showDialog=false, nenhuma ação pendente', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ hasUnsavedChanges: false }));
    expect(result.current.showDialog).toBe(false);
  });

  it('message padrão em PT-BR', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ hasUnsavedChanges: false }));
    expect(result.current.message).toContain('alterações não salvas');
  });

  it('message customizada respeitada', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ hasUnsavedChanges: false, message: 'Perderá dados!' }));
    expect(result.current.message).toBe('Perderá dados!');
  });
});

// ── guardNavigation sem alterações ────────────────────────────────────────────
describe('guardNavigation sem alterações pendentes', () => {
  it('executa ação imediatamente (sem abrir dialog)', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ hasUnsavedChanges: false }));
    const action = vi.fn();
    act(() => { result.current.guardNavigation(action); });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.showDialog).toBe(false);
  });

  it('não enfileira ação (dialog permanece fechado)', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ hasUnsavedChanges: false }));
    act(() => { result.current.guardNavigation(() => {}); });
    expect(result.current.showDialog).toBe(false);
  });
});

// ── guardNavigation com alterações ───────────────────────────────────────────
describe('guardNavigation com alterações não salvas', () => {
  it('abre dialog sem executar a ação', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ hasUnsavedChanges: true }));
    const action = vi.fn();
    act(() => { result.current.guardNavigation(action); });
    expect(result.current.showDialog).toBe(true);
    expect(action).not.toHaveBeenCalled();
  });

  it('segunda chamada substitui a ação pendente (last wins)', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ hasUnsavedChanges: true }));
    const action1 = vi.fn();
    const action2 = vi.fn();
    act(() => { result.current.guardNavigation(action1); });
    act(() => { result.current.guardNavigation(action2); });
    act(() => { result.current.confirmLeave(); });
    expect(action1).not.toHaveBeenCalled();
    expect(action2).toHaveBeenCalledTimes(1);
  });
});

// ── confirmLeave ──────────────────────────────────────────────────────────────
describe('confirmLeave', () => {
  it('executa pendingAction e fecha dialog', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ hasUnsavedChanges: true }));
    const action = vi.fn();
    act(() => { result.current.guardNavigation(action); });
    expect(result.current.showDialog).toBe(true);
    act(() => { result.current.confirmLeave(); });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.showDialog).toBe(false);
  });

  it('sem pendingAction: fecha dialog sem crash', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ hasUnsavedChanges: true }));
    // Abre dialog manualmente sem action
    act(() => { result.current.guardNavigation(() => {}); });
    act(() => { result.current.confirmLeave(); });
    expect(result.current.showDialog).toBe(false);
  });
});

// ── cancelLeave ───────────────────────────────────────────────────────────────
describe('cancelLeave', () => {
  it('fecha dialog sem executar ação', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ hasUnsavedChanges: true }));
    const action = vi.fn();
    act(() => { result.current.guardNavigation(action); });
    act(() => { result.current.cancelLeave(); });
    expect(result.current.showDialog).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('após cancelLeave, nova guardNavigation funciona corretamente', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ hasUnsavedChanges: true }));
    const action = vi.fn();
    act(() => { result.current.guardNavigation(action); });
    act(() => { result.current.cancelLeave(); });
    // Nova chamada — deve abrir dialog novamente
    act(() => { result.current.guardNavigation(action); });
    expect(result.current.showDialog).toBe(true);
  });
});

// ── beforeunload ──────────────────────────────────────────────────────────────
describe('beforeunload event listener', () => {
  it('adiciona listener quando hasUnsavedChanges=true', () => {
    renderHook(() => useUnsavedChangesGuard({ hasUnsavedChanges: true }));
    const calls = addEventSpy.mock.calls.filter(([ev]) => ev === 'beforeunload');
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it('não adiciona listener quando hasUnsavedChanges=false', () => {
    renderHook(() => useUnsavedChangesGuard({ hasUnsavedChanges: false }));
    const calls = addEventSpy.mock.calls.filter(([ev]) => ev === 'beforeunload');
    expect(calls.length).toBe(0);
  });

  it('remove listener ao desmontar com hasUnsavedChanges=true', () => {
    const { unmount } = renderHook(() =>
      useUnsavedChangesGuard({ hasUnsavedChanges: true }));
    unmount();
    const removeCalls = removeEventSpy.mock.calls.filter(([ev]) => ev === 'beforeunload');
    expect(removeCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('remove listener quando hasUnsavedChanges muda de true → false', () => {
    const { rerender } = renderHook(
      ({ has }: { has: boolean }) => useUnsavedChangesGuard({ hasUnsavedChanges: has }),
      { initialProps: { has: true } }
    );
    rerender({ has: false });
    const removeCalls = removeEventSpy.mock.calls.filter(([ev]) => ev === 'beforeunload');
    expect(removeCalls.length).toBeGreaterThanOrEqual(1);
  });
});
