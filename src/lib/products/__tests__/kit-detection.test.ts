import { describe, expect, it } from 'vitest';
import { isProductKit } from '../kit-detection';

describe('isProductKit', () => {
  it('respeita o flag canônico isKit=true', () => {
    expect(
      isProductKit({
        isKit: true,
        name: 'Produto comum',
        category: { id: 'cat', name: 'Brindes' },
        category_name: null,
        groups: [],
      }),
    ).toBe(true);
  });

  it('detecta kits pela categoria quando o flag vem falso/ausente', () => {
    expect(
      isProductKit({
        isKit: false,
        name: 'Churrasco ref. KC0124PP',
        category: { id: 'cat', name: 'Kit Churrasco' },
        category_name: null,
        groups: [],
      }),
    ).toBe(true);
  });

  it('detecta kits pelo nome do produto apenas quando começa com Kit/Kits', () => {
    expect(
      isProductKit({
        isKit: false,
        name: 'Kit drink',
        category: { id: 'cat', name: 'Bar' },
        category_name: null,
        groups: [],
      }),
    ).toBe(true);

    expect(
      isProductKit({
        isKit: false,
        name: 'Caneta para kit executivo',
        category: { id: 'cat', name: 'Canetas' },
        category_name: null,
        groups: [],
      }),
    ).toBe(false);
  });
});