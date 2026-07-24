import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import LoadingScreen from '@/components/LoadingScreen';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }) } },
}));

describe('LoadingScreen', () => {
  it('renders loading text', () => {
    render(<LoadingScreen />);
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('renders spinner', () => {
    const { container } = render(<LoadingScreen />);
    const spinner = container.querySelector('svg.lucide-loader2, svg.lucide-loader-circle');
    expect(spinner).toBeInTheDocument();
  });

  it('has min-h-screen for full page', () => {
    const { container } = render(<LoadingScreen />);
    expect(container.firstChild).toHaveClass('min-h-screen');
  });
});
