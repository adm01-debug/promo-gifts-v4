import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import React from 'react';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});
window.IntersectionObserver = mockIntersectionObserver;

describe('OptimizedImage', () => {
  const defaultProps = {
    src: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
    alt: 'Test Image',
    width: 400,
    height: 300,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not have src initially when not in view', () => {
    render(<OptimizedImage {...defaultProps} />);
    const img = screen.getByRole('img', { name: /test image/i });
    expect(img).not.toHaveAttribute('src');
  });

  it('shows the image after entering view and loading', async () => {
    let intersectCallback: any;
    mockIntersectionObserver.mockImplementation((callback) => {
      intersectCallback = callback;
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    });

    render(<OptimizedImage {...defaultProps} />);
    
    act(() => {
      intersectCallback([{ isIntersecting: true }]);
    });

    const img = screen.getByRole('img', { name: /test image/i });
    expect(img).toHaveAttribute('src', defaultProps.src);

    fireEvent.load(img);

    await waitFor(() => {
      expect(img).toHaveClass('opacity-100');
    });
  });

  it('applies custom blur and zoom amounts', () => {
    render(
      <OptimizedImage 
        {...defaultProps} 
        blurAmount={30} 
        zoomAmount={1.5} 
        priority={true} 
      />
    );
    
    const img = screen.getByRole('img', { name: /test image/i });
    // Verificamos o estilo quando NÃO está carregado
    expect(img).toHaveStyle({
      filter: 'blur(30px)',
      transform: 'scale(1.5)',
    });
  });

  it('shows error state when image fails to load', async () => {
    render(<OptimizedImage {...defaultProps} priority={true} />);
    
    const img = screen.getByRole('img', { name: /test image/i });
    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.getByText(/erro ao carregar/i)).toBeInTheDocument();
    });
  });

  it('uses priority/eager loading when specified', () => {
    render(<OptimizedImage {...defaultProps} priority={true} />);
    const img = screen.getByRole('img', { name: /test image/i });
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
  });
});
