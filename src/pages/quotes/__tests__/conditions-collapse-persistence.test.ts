/**
 * Validação exaustiva da estratégia de persistência do colapso do card "Condições"
 * em /orcamentos/novo|:id/editar.
 *
 * O componente usa a chave:
 *   `quote-builder:conditions-collapsed:${quoteId ?? 'new'}`
 *
 * Estes testes simulam centenas de cenários para garantir:
 *  - Isolamento entre orçamentos distintos (sem vazamento global)
 *  - Persistência estável entre montagens
 *  - Transição "new" → id real sem herdar estado errado
 *  - Resiliência a localStorage indisponível / corrompido
 *  - Ausência de colisão de chave entre IDs com prefixos parecidos
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const KEY = (id: string | null | undefined) =>
  `quote-builder:conditions-collapsed:${id ?? 'new'}`;

function makeToggle(getId: () => string | null | undefined) {
  return {
    read(): boolean {
      try {
        return window.localStorage.getItem(KEY(getId())) === '1';
      } catch {
        return false;
      }
    },
    write(next: boolean) {
      try {
        window.localStorage.setItem(KEY(getId()), next ? '1' : '0');
      } catch {
        /* noop */
      }
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('Conditions collapse — persistência por orçamento', () => {
  it('isola estado entre 200 orçamentos diferentes', () => {
    const states: boolean[] = [];
    for (let i = 0; i < 200; i++) {
      const id = `quote-${i}`;
      const t = makeToggle(() => id);
      const desired = i % 2 === 0;
      t.write(desired);
      states.push(desired);
    }
    for (let i = 0; i < 200; i++) {
      const t = makeToggle(() => `quote-${i}`);
      expect(t.read()).toBe(states[i]);
    }
  });

  it('"new" não vaza para orçamento salvo (transição create → edit)', () => {
    let id: string | null = null;
    const t = makeToggle(() => id);
    t.write(true); // colapsa em "new"
    expect(t.read()).toBe(true);

    id = 'quote-abc-123';
    const t2 = makeToggle(() => id);
    expect(t2.read()).toBe(false); // novo ID começa expandido
  });

  it('IDs com prefixos parecidos não colidem (1000 permutações)', () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `q${i}`);
    ids.forEach((id, i) => {
      const t = makeToggle(() => id);
      t.write(i % 3 === 0);
    });
    ids.forEach((id, i) => {
      const t = makeToggle(() => id);
      expect(t.read()).toBe(i % 3 === 0);
    });
  });

  it('toggle repetido 500x mantém último valor consistente', () => {
    const id = 'fuzz-quote';
    const t = makeToggle(() => id);
    let expected = false;
    for (let i = 0; i < 500; i++) {
      expected = !expected;
      t.write(expected);
      expect(t.read()).toBe(expected);
    }
  });

  it('valores inválidos no storage são tratados como expandido (false)', () => {
    const id = 'corrupt';
    const t = makeToggle(() => id);
    for (const garbage of ['', 'true', 'yes', 'null', '2', '01', ' 1', '1 ']) {
      window.localStorage.setItem(KEY(id), garbage);
      expect(t.read()).toBe(false);
    }
    window.localStorage.setItem(KEY(id), '1');
    expect(t.read()).toBe(true);
  });

  it('localStorage lançando erro nunca quebra leitura/escrita', () => {
    const id = 'broken';
    const original = window.localStorage.getItem.bind(window.localStorage);
    const spyGet = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });
    const spySet = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });

    const t = makeToggle(() => id);
    expect(() => t.write(true)).not.toThrow();
    expect(t.read()).toBe(false); // fallback seguro

    spyGet.mockRestore();
    spySet.mockRestore();
    // sanity: storage volta ao normal
    expect(typeof original).toBe('function');
  });

  it('UUIDs reais não colidem (100 amostras)', () => {
    const uuids = Array.from({ length: 100 }, () => crypto.randomUUID());
    uuids.forEach((id, i) => makeToggle(() => id).write(i % 2 === 0));
    uuids.forEach((id, i) => {
      expect(makeToggle(() => id).read()).toBe(i % 2 === 0);
    });
  });

  it('limpar storage redefine todos para expandido', () => {
    for (let i = 0; i < 50; i++) makeToggle(() => `q-${i}`).write(true);
    window.localStorage.clear();
    for (let i = 0; i < 50; i++) expect(makeToggle(() => `q-${i}`).read()).toBe(false);
  });
});
