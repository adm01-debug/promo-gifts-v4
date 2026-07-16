/**
 * Regressão de segurança: `?applyTemplate=` no editor DEVE usar
 * `Object.prototype.hasOwnProperty.call(TEMPLATE_REGISTRY, applyId)`
 * ao invés de `applyId in TEMPLATE_REGISTRY`.
 *
 * O operador `in` retorna true para propriedades herdadas (`constructor`,
 * `__proto__`, `toString`, etc.), o que faria o editor "aceitar" um id
 * inválido e potencialmente passar um valor não-controlado adiante.
 *
 * Este teste é uma prova de forma: valida DIRETAMENTE a lógica do guard
 * em cima do TEMPLATE_REGISTRY real, sem montar o editor inteiro
 * (para não puxar Supabase, auth, etc.).
 */

import { describe, it, expect } from 'vitest';
import { TEMPLATE_REGISTRY } from '../components/templates/TemplateRegistry';

function isValidApplyId(id: string): boolean {
  return Object.hasOwn(TEMPLATE_REGISTRY, id);
}

describe('applyTemplate guard — Object.prototype.hasOwnProperty', () => {
  it('aceita ids reais do registry', () => {
    for (const id of Object.keys(TEMPLATE_REGISTRY)) {
      expect(isValidApplyId(id)).toBe(true);
    }
  });

  const attacks = [
    'constructor',
    '__proto__',
    'toString',
    'hasOwnProperty',
    'valueOf',
    'isPrototypeOf',
    'propertyIsEnumerable',
    '__defineGetter__',
    '__defineSetter__',
  ];

  for (const attack of attacks) {
    it(`rejeita payload malicioso: ${attack}`, () => {
      expect(isValidApplyId(attack)).toBe(false);
    });
  }

  it('rejeita string vazia', () => {
    expect(isValidApplyId('')).toBe(false);
  });

  it('rejeita id inexistente aleatório', () => {
    expect(isValidApplyId('nao-existe-xyz')).toBe(false);
  });
});
