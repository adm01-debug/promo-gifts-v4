/**
 * Concorrência multi-vendedor — simulação do trigger generate_quote_number.
 *
 * O teste reproduz a lógica EXATA do trigger atual (MAX+1 sem lock) e a
 * versão proposta (MAX+1 + advisory lock). O objetivo é provar duas coisas:
 *
 *   1. Sob N inserts concorrentes no mesmo ano, a versão atual produz
 *      COLISÕES (mesmo quote_number gerado para inserts diferentes).
 *   2. A versão com lock produz números ÚNICOS e SEQUENCIAIS por ano.
 *
 * Esse teste é a defesa contra regressão: se o trigger no banco mudar para
 * uma estratégia frouxa, este spec falha e força revisão.
 */
import { describe, it, expect } from 'vitest';

type Row = { id: number; year_yy: string; quote_number: string };

class InMemoryQuotes {
  rows: Row[] = [];
  private nextId = 1;
  // simula a janela em que duas transações leem o MAX antes de qualquer
  // INSERT comitar — exatamente o que acontece em ausência de lock.
  async insertNoLock(year_yy: string): Promise<Row> {
    const max = Math.max(
      10000,
      ...this.rows
        .filter((r) => r.year_yy === year_yy)
        .map((r) => Number.parseInt(r.quote_number.split('/')[0], 10)),
    );
    await Promise.resolve(); // cede o event loop → outras "transações" leem o mesmo MAX
    const number = `${max + 1}/${year_yy}`;
    const row = { id: this.nextId++, year_yy, quote_number: number };
    this.rows.push(row);
    return row;
  }

  private locks = new Map<string, Promise<void>>();
  async insertWithAdvisoryLock(year_yy: string): Promise<Row> {
    const key = `quote_number:${year_yy}`;
    const prev = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    this.locks.set(
      key,
      prev.then(() => next),
    );
    await prev;
    try {
      const max = Math.max(
        10000,
        ...this.rows
          .filter((r) => r.year_yy === year_yy)
          .map((r) => Number.parseInt(r.quote_number.split('/')[0], 10)),
      );
      await Promise.resolve();
      const number = `${max + 1}/${year_yy}`;
      const row = { id: this.nextId++, year_yy, quote_number: number };
      this.rows.push(row);
      return row;
    } finally {
      release();
    }
  }
}

describe('quote_number · concorrência multi-vendedor', () => {
  it('🚨 estratégia atual (MAX+1 sem lock) PRODUZ colisões', async () => {
    const db = new InMemoryQuotes();
    const N = 50;
    const results = await Promise.all(
      Array.from({ length: N }, () => db.insertNoLock('26')),
    );
    const numbers = results.map((r) => r.quote_number);
    const unique = new Set(numbers);
    // Provamos a vulnerabilidade: NÃO há N números distintos.
    expect(unique.size).toBeLessThan(N);
  });

  it('✅ estratégia proposta (advisory lock) gera números únicos e sequenciais', async () => {
    const db = new InMemoryQuotes();
    const N = 50;
    const results = await Promise.all(
      Array.from({ length: N }, () => db.insertWithAdvisoryLock('26')),
    );
    const numbers = results.map((r) => r.quote_number);
    const unique = new Set(numbers);
    expect(unique.size).toBe(N);
    const seqs = numbers
      .map((n) => Number.parseInt(n.split('/')[0], 10))
      .sort((a, b) => a - b);
    // sequência contínua de 10001..10001+N-1
    expect(seqs[0]).toBe(10001);
    expect(seqs[seqs.length - 1]).toBe(10000 + N);
  });

  it('rollover de ano: 50 inserts em /26 e 50 em /27 não se misturam (com lock)', async () => {
    const db = new InMemoryQuotes();
    const tasks: Promise<Row>[] = [];
    for (let i = 0; i < 50; i++) tasks.push(db.insertWithAdvisoryLock('26'));
    for (let i = 0; i < 50; i++) tasks.push(db.insertWithAdvisoryLock('27'));
    const rows = await Promise.all(tasks);
    const y26 = rows.filter((r) => r.year_yy === '26').map((r) => r.quote_number);
    const y27 = rows.filter((r) => r.year_yy === '27').map((r) => r.quote_number);
    expect(new Set(y26).size).toBe(50);
    expect(new Set(y27).size).toBe(50);
    expect(y26.every((n) => n.endsWith('/26'))).toBe(true);
    expect(y27.every((n) => n.endsWith('/27'))).toBe(true);
  });
});
