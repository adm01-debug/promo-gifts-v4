import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppLogo } from './AppLogo';

describe('AppLogo Visual Consistency', () => {
  it('renders brand variant with primary background and white icon', () => {
    const { container } = render(<AppLogo variant="brand" />);
    const iconContainer = container.querySelector('.bg-primary');
    expect(iconContainer).toBeInTheDocument();
    const icon = iconContainer?.querySelector('svg');
    expect(icon).toHaveClass('text-white');
  });

  it('renders light variant with white background and foreground icon', () => {
    const { container } = render(<AppLogo variant="light" />);
    const iconContainer = container.querySelector('.bg-white');
    expect(iconContainer).toBeInTheDocument();
    const icon = iconContainer?.querySelector('svg');
    expect(icon).toHaveClass('text-foreground');
  });

  it('hides text when showText is false', () => {
    const { queryByText } = render(<AppLogo showText={false} />);
    expect(queryByText('Promo Gifts')).not.toBeInTheDocument();
  });
});
