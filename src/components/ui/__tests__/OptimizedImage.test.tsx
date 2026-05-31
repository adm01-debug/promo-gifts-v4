import { render, screen, fireEvent } from '@testing-library/react';
import { OptimizedImage } from '../OptimizedImage';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('OptimizedImage', () => {
  const defaultProps = {
    src: 'https://example.com/image.jpg',
    alt: 'Test Image',
    blurAmount: 20,
    zoomAmount: 1.1,
    duration: 500,
  };

  beforeEach(() => {
    // IntersectionObserver mock is usually global in setupFiles, 
    // but we can ensure it exists here if needed.
    vi.clearAllMocks();
  });

  it('renders a shimmer or placeholder when loading', () => {
    render(<OptimizedImage {...defaultProps} />);
    
    // Check for shimmer or placeholder element
    // By default, if no lqip, we show a local placeholder img with blur
    const placeholder = screen.getByRole('img', { hidden: true });
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveStyle('filter: blur(20px)');
  });

  it('applies fade-in, removes blur and resets zoom after onLoad', () => {
    render(<OptimizedImage {...defaultProps} />);
    
    const img = screen.getByAltText('Test Image');
    
    // Initial state (loading)
    expect(img).toHaveClass('opacity-0');
    // Using getComputedStyle for style checks when possible, or just checking the style attribute
    expect(img).toHaveStyle(`filter: blur(${defaultProps.blurAmount}px)`);
    expect(img).toHaveStyle(`transform: scale(${defaultProps.zoomAmount})`);
    expect(img).toHaveStyle(`transition-duration: ${defaultProps.duration}ms`);

    // Simulate image load
    fireEvent.load(img);

    // Final state (loaded)
    expect(img).toHaveClass('opacity-100');
    expect(img).toHaveClass('scale-100');
    expect(img).toHaveClass('blur-0');
    expect(img).toHaveStyle('filter: none');
    expect(img).toHaveStyle('transform: scale(1)');
  });

  it('handles custom configuration correctly', () => {
    const customProps = {
      ...defaultProps,
      blurAmount: 50,
      zoomAmount: 1.5,
      duration: 1000,
    };
    render(<OptimizedImage {...customProps} />);
    
    const img = screen.getByAltText('Test Image');
    expect(img).toHaveStyle('filter: blur(50px)');
    expect(img).toHaveStyle('transform: scale(1.5)');
    expect(img).toHaveStyle('transition-duration: 1000ms');
  });

  it('shows error state when image fails to load', () => {
    render(<OptimizedImage {...defaultProps} />);
    
    const img = screen.getByAltText('Test Image');
    
    // Simulate error
    fireEvent.error(img);

    expect(screen.getByText('Erro ao carregar')).toBeInTheDocument();
  });

  it('uses lqip if provided', () => {
    const lqip = 'data:image/png;base64,lqip-data';
    render(<OptimizedImage {...defaultProps} lqip={lqip} />);
    
    // Find image by src attribute (LQIP)
    const placeholder = document.querySelector(`img[src="${lqip}"]`);
    
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute('aria-hidden', 'true');
  });
});
