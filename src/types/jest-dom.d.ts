/**
 * Tipos dos matchers do @testing-library/jest-dom para o escopo `src/`.
 *
 * O setup de runtime (`tests/setup.ts`) importa '@testing-library/jest-dom',
 * mas esse arquivo fica fora do `include` do tsconfig.app.json (que cobre
 * apenas `src`). Sem esta referência, os testes em `src/**` perdem os tipos
 * dos matchers (toBeInTheDocument, toHaveTextContent, toBeDisabled, etc.),
 * gerando TS2339 no gate de typecheck.
 *
 * Esta declaração apenas estende os tipos do Vitest — não tem efeito em runtime.
 */
import '@testing-library/jest-dom/vitest';
