/**
 * _zod.ts — Pinning ÚNICO de Zod para todo o projeto.
 *
 * Esta é a ÚNICA URL de Zod que pode existir em qualquer arquivo do projeto.
 * Todos os demais módulos (incluindo `index.ts` deste pacote) devem importar
 * `z` daqui via path relativo.
 *
 * Para subir/descer versão de Zod, edite somente este arquivo.
 *
 * Regra reforçada por ESLint (no-restricted-imports) em `eslint.config.js`.
 */
export { z } from "https://esm.sh/zod@3.23.8";
