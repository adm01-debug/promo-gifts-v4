/**
 * Testes do atalho "s" para alternar modo seleção em /estoque.
 */
import { renderHook, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useSelectionShortcut } from '../useSelectionShortcut';

function press(key: string, opts: Partial<KeyboardEventInit & { target?: EventTarget }> = {}) {
  const target = opts.target ?? document.body;
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  target.dispatchEvent(ev);
  return ev;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useSelectionShortcut', () => {
  it('dispara onToggle ao pressionar "s" no body', () => {
    const onToggle = vi.fn();
    renderHook(() => useSelectionShortcut(onToggle));
    press('s');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('aceita "S" maiúsculo (sem shift)', () => {
    const onToggle = vi.fn();
    renderHook(() => useSelectionShortcut(onToggle));
    press('S');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('ignora quando há modifier (Ctrl/Cmd/Alt/Shift)', () => {
    const onToggle = vi.fn();
    renderHook(() => useSelectionShortcut(onToggle));
    press('s', { ctrlKey: true });
    press('s', { metaKey: true });
    press('s', { altKey: true });
    press('s', { shiftKey: true });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('ignora quando foco está em <input>', () => {
    const onToggle = vi.fn();
    renderHook(() => useSelectionShortcut(onToggle));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 's' });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('ignora quando foco está em <textarea>', () => {
    const onToggle = vi.fn();
    renderHook(() => useSelectionShortcut(onToggle));
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    fireEvent.keyDown(ta, { key: 's' });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('ignora contenteditable', () => {
    const onToggle = vi.fn();
    renderHook(() => useSelectionShortcut(onToggle));
    const div = document.createElement('div');
    // jsdom não computa isContentEditable a partir do atributo — definimos manualmente.
    Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true });
    document.body.appendChild(div);
    fireEvent.keyDown(div, { key: 's' });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('não escuta quando enabled=false', () => {
    const onToggle = vi.fn();
    renderHook(() => useSelectionShortcut(onToggle, false));
    press('s');
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('faz cleanup do listener no unmount', () => {
    const onToggle = vi.fn();
    const { unmount } = renderHook(() => useSelectionShortcut(onToggle));
    unmount();
    press('s');
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('chama preventDefault no evento válido', () => {
    renderHook(() => useSelectionShortcut(() => {}));
    const ev = press('s');
    expect(ev.defaultPrevented).toBe(true);
  });
});
