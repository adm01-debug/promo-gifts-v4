/**
 * undoCopy — SSOT de copy do fluxo Desfazer no módulo Carrinhos.
 *
 * Cobertura:
 *   1) Constantes de duração (`UNDO_DURATION_MS` = 8000, `UNDO_DURATION_LABEL` = "8 segundos")
 *      são coerentes entre si e refletidas em `UNDO_TOAST_DESCRIPTION` e nas descrições
 *      de `ConfirmDialog`. Se alguém mudar uma sem mudar as outras, este teste quebra.
 *   2) Singular/plural resolvidos por número (nunca por sufixo hard-coded).
 *   3) Labels dos CTAs coerentes com o contexto (individual vs. lote).
 *   4) Título do toast de item removido usa exatamente o nome do item passado.
 */
import { describe, it, expect } from 'vitest';
import {
  UNDO_DURATION_MS,
  UNDO_DURATION_LABEL,
  UNDO_TOAST_DESCRIPTION,
  deleteConfirmDialogTitle,
  deleteConfirmDialogDescription,
  deletedToastTitle,
  confirmDialogConfirmLabel,
  itemRemovedToastTitle,
  RESTORE_SINGLE_SUCCESS,
  RESTORE_SINGLE_ERROR,
} from '../undoCopy';

describe('undoCopy — SSOT: duração + singular/plural', () => {
  describe('duração de 8 segundos', () => {
    it('UNDO_DURATION_MS é 8000ms (contrato do fluxo Desfazer)', () => {
      expect(UNDO_DURATION_MS).toBe(8000);
    });

    it('UNDO_DURATION_LABEL é "8 segundos" (label humana coerente com o MS)', () => {
      expect(UNDO_DURATION_LABEL).toBe('8 segundos');
    });

    it('a label da duração vem sempre da constante (nunca hard-coded)', () => {
      // Todos os copies que exibem tempo DEVEM ecoar UNDO_DURATION_LABEL
      expect(UNDO_TOAST_DESCRIPTION).toContain(UNDO_DURATION_LABEL);
      expect(deleteConfirmDialogDescription(1)).toContain(UNDO_DURATION_LABEL);
      expect(deleteConfirmDialogDescription(2)).toContain(UNDO_DURATION_LABEL);
      expect(deleteConfirmDialogDescription(50)).toContain(UNDO_DURATION_LABEL);
    });

    it('UNDO_TOAST_DESCRIPTION é a mesma string para bulk e individual (paridade)', () => {
      // Se um dia forem separadas por número, este teste morre — força justificativa.
      expect(UNDO_TOAST_DESCRIPTION).toBe(`Você pode desfazer por até ${UNDO_DURATION_LABEL}.`);
    });
  });

  describe('singular/plural — deletedToastTitle', () => {
    it('0 → mesmo copy do singular (defensivo: nunca exibe "0 carrinhos")', () => {
      // Regra: se por algum motivo o caller passar 0 (bulk sem seleção
      // efetiva), o título cai no singular — nunca exibimos "0 carrinhos".
      expect(deletedToastTitle(0)).toBe('Carrinho excluído');
    });
    it('1 → singular sem número', () => {
      expect(deletedToastTitle(1)).toBe('Carrinho excluído');
    });
    it('2..99 → plural com número', () => {
      for (const n of [2, 3, 5, 10, 99]) {
        expect(deletedToastTitle(n)).toBe(`${n} carrinhos excluídos`);
      }
    });
  });

  describe('singular/plural — deleteConfirmDialogTitle', () => {
    it('<=1 → "Excluir carrinho?"', () => {
      expect(deleteConfirmDialogTitle(0)).toBe('Excluir carrinho?');
      expect(deleteConfirmDialogTitle(1)).toBe('Excluir carrinho?');
    });
    it('>1 → "Excluir N carrinhos?"', () => {
      expect(deleteConfirmDialogTitle(2)).toBe('Excluir 2 carrinhos?');
      expect(deleteConfirmDialogTitle(7)).toBe('Excluir 7 carrinhos?');
    });
  });

  describe('singular/plural — deleteConfirmDialogDescription', () => {
    it('<=1 usa "O carrinho será removido"', () => {
      const s = deleteConfirmDialogDescription(1);
      expect(s.startsWith('O carrinho será removido')).toBe(true);
      // Cauda com tempo consistente
      expect(s.endsWith(`por até ${UNDO_DURATION_LABEL} após a confirmação.`)).toBe(true);
    });
    it('>1 usa "Os carrinhos serão removidos"', () => {
      const s = deleteConfirmDialogDescription(3);
      expect(s.startsWith('Os carrinhos serão removidos')).toBe(true);
      expect(s.endsWith(`por até ${UNDO_DURATION_LABEL} após a confirmação.`)).toBe(true);
    });
    it('nunca contém a copy legada "Esta ação não pode ser desfeita"', () => {
      for (const n of [1, 2, 3, 10]) {
        expect(deleteConfirmDialogDescription(n)).not.toMatch(/não pode ser desfeita/i);
      }
    });
  });

  describe('confirmDialogConfirmLabel', () => {
    it('<=1 → "Confirmar exclusão" (individual)', () => {
      expect(confirmDialogConfirmLabel(0)).toBe('Confirmar exclusão');
      expect(confirmDialogConfirmLabel(1)).toBe('Confirmar exclusão');
    });
    it('>1 → "Excluir N" (bulk)', () => {
      expect(confirmDialogConfirmLabel(3)).toBe('Excluir 3');
      expect(confirmDialogConfirmLabel(25)).toBe('Excluir 25');
    });
  });

  describe('itemRemovedToastTitle', () => {
    it('usa exatamente o nome do item passado', () => {
      expect(itemRemovedToastTitle('Caneta Azul')).toBe('Caneta Azul removido');
      expect(itemRemovedToastTitle('Caneca 300ml')).toBe('Caneca 300ml removido');
    });
    it('preserva caracteres especiais (aspas, acentos, emoji)', () => {
      expect(itemRemovedToastTitle('Kit "Premium" — ✨')).toBe(
        'Kit "Premium" — ✨ removido',
      );
    });
  });

  describe('constantes de resultado do restore individual', () => {
    it('mensagens de sucesso e erro terminam com ponto final', () => {
      expect(RESTORE_SINGLE_SUCCESS.endsWith('.')).toBe(true);
      expect(RESTORE_SINGLE_ERROR.endsWith('.')).toBe(true);
    });
    it('mensagens fazem referência a "carrinho" singular', () => {
      expect(RESTORE_SINGLE_SUCCESS).toMatch(/carrinho/i);
      expect(RESTORE_SINGLE_ERROR).toMatch(/carrinho/i);
      expect(RESTORE_SINGLE_SUCCESS).not.toMatch(/carrinhos/i);
      expect(RESTORE_SINGLE_ERROR).not.toMatch(/carrinhos/i);
    });
  });
});
