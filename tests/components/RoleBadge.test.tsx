import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RoleBadge } from '@/components/RoleBadge';

describe('RoleBadge Component', () => {
  it('renders correctly with role label', () => {
    render(<RoleBadge role="dev" />);
    expect(screen.getByText(/Dev/i)).toBeInTheDocument();
  });

  it('does not have a native title attribute', () => {
    const { container } = render(<RoleBadge role="admin" />);
    const badge = container.querySelector('.inline-flex');
    expect(badge).not.toHaveAttribute('title');
  });

  it('does not have any hover state that could trigger a tooltip explanation', () => {
    // This is more for E2E, but we can check if there are any data-attributes 
    // that might indicate a Radix tooltip is attached.
    const { container } = render(<RoleBadge role="admin" />);
    const badge = container.querySelector('.inline-flex');
    
    // Radix tooltips usually add attributes when they are active or for identification
    const attributes = badge?.getAttributeNames() || [];
    const tooltipRelated = attributes.filter(attr => 
      attr.includes('tooltip') || attr.includes('popover') || attr.includes('aria-describedby')
    );
    
    expect(tooltipRelated.length).toBe(0);
  });
});
