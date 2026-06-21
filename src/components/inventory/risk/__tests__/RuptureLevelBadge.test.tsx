/**
 * RuptureLevelBadge — render dos 5 níveis.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RuptureLevelBadge } from '../RuptureLevelBadge';
import type { RuptureLevel } from '@/hooks/stock/useRuptureAlerts';

describe('RuptureLevelBadge', () => {
  const levels: RuptureLevel[] = ['RUPTURA', 'CRÍTICO', 'ALERTA', 'ATENÇÃO', 'OK'];
  it.each(levels)('renderiza %s', (lvl) => {
    render(<RuptureLevelBadge level={lvl} />);
    expect(screen.getByText(lvl)).toBeInTheDocument();
  });
});
