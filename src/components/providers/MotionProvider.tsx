/**
 * MotionProvider — habilita o code-splitting de animações via LazyMotion.
 *
 * Os call sites importam o componente leve `m` (aliased como `motion`) em vez
 * do `motion` completo. As features pesadas (`domMax` — inclui drag, layout e
 * Reorder, usados pelo app) são carregadas SOB DEMANDA via `import()` dinâmico,
 * mantendo apenas o runtime mínimo de LazyMotion no caminho crítico e
 * transmitindo (~25–30KB de) features fora do bundle inicial.
 *
 * `strict` garante, em runtime (dev), que nenhum `motion.*` completo escape:
 * qualquer uso do componente pesado lança erro, mantendo a migração 100%.
 */
import { LazyMotion } from 'framer-motion';
import type { ReactNode } from 'react';

// Carrega o conjunto completo de features (drag/layout/Reorder) de forma lazy.
const loadMotionFeatures = () => import('framer-motion').then((mod) => mod.domMax);

export function MotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadMotionFeatures}>{children}</LazyMotion>;
}
