import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppLogo } from './AppLogo';

describe('AppLogo Visual Consistency', () => {
  it('renders brand variant with primary background and primary foreground icon', () => {
    const { container } = render(<AppLogo variant="brand" />);
    const iconContainer = container.querySelector('.bg-primary');
    expect(iconContainer).toBeInTheDocument();
    const icon = iconContainer?.querySelector('svg');
    expect(icon).toHaveClass('text-primary-foreground');
  });

  it('renders sidebar variant with primary background and primary foreground icon', () => {
    const { container } = render(<AppLogo variant="sidebar" />);
    const iconContainer = container.querySelector('.bg-primary');
    expect(iconContainer).toBeInTheDocument();
    const icon = iconContainer?.querySelector('svg');
    expect(icon).toHaveClass('text-primary-foreground');
    // QA: V3 icon box usa h-10 w-10 (tamanho fixo para todos os variants).
    expect(iconContainer).toHaveClass('h-10');
    expect(iconContainer).toHaveClass('w-10');
  });

  it('renders light variant with primary background and primary foreground icon', () => {
    const { container } = render(<AppLogo variant="light" />);
    const iconContainer = container.querySelector('.bg-primary');
    expect(iconContainer).toBeInTheDocument();
    const icon = iconContainer?.querySelector('svg');
    expect(icon).toHaveClass('text-primary-foreground');
  });

  it('hides text when showText is false', () => {
    const { queryByText } = render(<AppLogo showText={false} />);
    expect(queryByText('Promo Gifts')).not.toBeInTheDocument();
  });
});
