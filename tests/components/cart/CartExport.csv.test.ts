import { describe, it, expect } from 'vitest';
import { csvCell, buildCartCsv, safeCartFileName } from '@/components/cart/cart-utils/CartExport';
import type { SellerCart } from '@/hooks/products';

const baseItem = {
  id: 'i1',
  cart_id: 'c1',
  product_id: 'p1',
  product_name: 'Caneta',
  product_sku: 'SKU-1',
  product_image_url: null,
  product_price: 10,
  quantity: 2,
  color_name: null,
  color_hex: null,
  notes: null,
  sort_order: 0,
  created_at: '',
  updated_at: '',
};

const makeCart = (items: Partial<typeof baseItem>[]): SellerCart =>
  ({
    id: 'c1',
    seller_id: 's1',
    company_id: 'co1',
    company_name: 'ACME',
    company_location: null,
    company_logo_url: null,
    notes: null,
    status: 'novo',
    created_at: '',
    updated_at: '',
    items: items.map((i) => ({ ...baseItem, ...i })),
  }) as SellerCart;

describe('csvCell — escaping e anti-injeção', () => {
  it('envolve valores em aspas e duplica aspas internas (RFC 4180)', () => {
    expect(csvCell('Caneta "Premium"')).toBe('"Caneta ""Premium"""');
  });

  it('preserva vírgulas e quebras de linha dentro de aspas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('linha1\nlinha2')).toBe('"linha1\nlinha2"');
  });

  it('neutraliza injeção de fórmula prefixando aspa simples', () => {
    expect(csvCell('=1+1')).toBe(`"'=1+1"`);
    expect(csvCell('+SOMA(A1)')).toBe(`"'+SOMA(A1)"`);
    expect(csvCell('-2+3')).toBe(`"'-2+3"`);
    expect(csvCell('@cmd')).toBe(`"'@cmd"`);
  });

  it('não mexe em texto comum nem em números', () => {
    expect(csvCell('Caneta')).toBe('"Caneta"');
    expect(csvCell(42)).toBe('"42"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
});

describe('buildCartCsv', () => {
  it('escapa nome de produto malicioso sem quebrar a estrutura de colunas', () => {
    const csv = buildCartCsv(
      makeCart([{ product_name: 'Produto, com vírgula e "aspas"', notes: '=HYPERLINK(1)' }]),
    );
    const lines = csv.split('\n');
    // header + 1 item + total
    expect(lines).toHaveLength(3);
    // cada linha tem exatamente 7 colunas (separadores fora das aspas)
    const itemLine = lines[1];
    expect(itemLine).toContain('"Produto, com vírgula e ""aspas"""');
    expect(itemLine).toContain(`"'=HYPERLINK(1)"`);
  });

  it('calcula o total corretamente na linha final', () => {
    const csv = buildCartCsv(
      makeCart([
        { product_price: 10, quantity: 2 },
        { id: 'i2', product_id: 'p2', product_price: 5, quantity: 3 },
      ]),
    );
    const lines = csv.split('\n');
    // 10*2 + 5*3 = 35.00
    expect(lines[lines.length - 1]).toContain('"35.00"');
  });

  it('coage preço/quantidade null/NaN para 0 sem quebrar (sem "NaN" no CSV)', () => {
    const csv = buildCartCsv(
      makeCart([
        { product_price: null as unknown as number, quantity: 2 },
        { id: 'i2', product_id: 'p2', product_price: 5, quantity: NaN as unknown as number },
      ]),
    );
    expect(csv).not.toContain('NaN');
    // ambos os subtotais viram 0.00 e o total final também
    expect(csv.split('\n').at(-1)).toContain('"0.00"');
  });
});

describe('safeCartFileName', () => {
  it('substitui caracteres inválidos de path e normaliza', () => {
    expect(safeCartFileName('A/B Ltda', 'csv')).toBe('carrinho-a-b-ltda.csv');
    expect(safeCartFileName('ACME', 'pdf')).toBe('carrinho-acme.pdf');
    expect(safeCartFileName('Foo: Bar* "Baz"?', 'csv')).toBe('carrinho-foo-bar-baz.csv');
  });

  it('usa fallback quando o nome fica vazio após sanear', () => {
    expect(safeCartFileName('', 'csv')).toBe('carrinho-sem-nome.csv');
    expect(safeCartFileName(null, 'pdf')).toBe('carrinho-sem-nome.pdf');
    expect(safeCartFileName('///', 'csv')).toBe('carrinho-sem-nome.csv');
  });
});
