import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProductQuickActions } from '@/components/products/ProductQuickActions';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

describe('ProductQuickActions', () => {
  const defaultProps = {
    productId: '123',
    productName: 'Test Product',
    basePrice: 100,
    minQuantity: 10,
  };

  describe('Botão Indicação', () => {
    it('should disable Indicação button when no tags are provided', () => {
      render(
        <BrowserRouter>
          <ProductQuickActions {...defaultProps} tags={{}} />
        </BrowserRouter>
      );

      const button = screen.getByRole('button', { name: /Indicação/i });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Sem dados de indicação para este produto');
    });

    it('should enable Indicação button when tags are provided', () => {
      const tags = { 'Público-Alvo': ['Jovens'] };
      render(
        <BrowserRouter>
          <ProductQuickActions {...defaultProps} tags={tags} />
        </BrowserRouter>
      );

      const button = screen.getByRole('button', { name: /Indicação/i });
      expect(button).not.toBeDisabled();
    });

    it('should show loading state in Indicação modal', () => {
      const tags = { 'Público-Alvo': ['Jovens'] };
      render(
        <BrowserRouter>
          <ProductQuickActions {...defaultProps} tags={tags} isLoadingTags={true} />
        </BrowserRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Indicação/i }));
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show error state in Indicação modal', () => {
      const tags = { 'Público-Alvo': ['Jovens'] };
      render(
        <BrowserRouter>
          <ProductQuickActions {...defaultProps} tags={tags} hasErrorTags={true} />
        </BrowserRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Indicação/i }));
      expect(screen.getByText(/Não foi possível carregar as indicações/i)).toBeInTheDocument();
    });
  });

  describe('Botão Nicho', () => {
    it('should disable Nicho button when no niches are provided', () => {
      render(
        <BrowserRouter>
          <ProductQuickActions {...defaultProps} niches={[]} />
        </BrowserRouter>
      );

      const button = screen.getByRole('button', { name: /Nicho/i });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Sem dados de nicho para este produto');
    });

    it('should enable Nicho button when niches are provided', () => {
      render(
        <BrowserRouter>
          <ProductQuickActions {...defaultProps} niches={['Tecnologia']} />
        </BrowserRouter>
      );

      const button = screen.getByRole('button', { name: /Nicho/i });
      expect(button).not.toBeDisabled();
    });

    it('should show loading state in Nicho modal', () => {
      render(
        <BrowserRouter>
          <ProductQuickActions {...defaultProps} niches={['Tecnologia']} isLoadingNiches={true} />
        </BrowserRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Nicho/i }));
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show error state in Nicho modal', () => {
      render(
        <BrowserRouter>
          <ProductQuickActions {...defaultProps} niches={['Tecnologia']} hasErrorNiches={true} />
        </BrowserRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Nicho/i }));
      expect(screen.getByText(/Não foi possível carregar os nichos/i)).toBeInTheDocument();
    });

    it('should display niches correctly in modal', () => {
      const niches = ['Saúde', 'Educação', '  Tecnologia  ', 'Saúde']; // Includes duplicates and spaces
      render(
        <BrowserRouter>
          <ProductQuickActions {...defaultProps} niches={niches} />
        </BrowserRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Nicho/i }));
      
      expect(screen.getByText('Saúde')).toBeInTheDocument();
      expect(screen.getByText('Educação')).toBeInTheDocument();
      expect(screen.getByText('Tecnologia')).toBeInTheDocument();
      
      // Check for uniqueness (Saúde should only appear once if it's a simple list)
      // Actually displayNiches uses Set, so it should be unique.
      const items = screen.getAllByText(/Saúde|Educação|Tecnologia/);
      expect(items.length).toBe(3);
    });
  });
});
