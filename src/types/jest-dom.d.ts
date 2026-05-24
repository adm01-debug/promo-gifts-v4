// Registra os matchers do @testing-library/jest-dom nos tipos do vitest.
//
// O import de runtime fica em tests/setup.ts (import '@testing-library/jest-dom'),
// mas tests/setup.ts esta FORA de 'src' e o tsconfig.app.json (usado pelo gate de
// typecheck e pelo build) so inclui 'src'. Sem este arquivo dentro de 'src', os
// testes em src/**/__tests__ nao enxergam os tipos dos matchers (toBeInTheDocument,
// toHaveAttribute, toHaveClass, ...), gerando TS2339 em massa.
//
// Reaproveita o augment oficial publicado pelo proprio pacote.
import '@testing-library/jest-dom/vitest';
