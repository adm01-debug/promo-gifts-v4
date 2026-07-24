import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import '@testing-library/jest-dom';

describe('Product Action Buttons Styling', () => {
  it('should have the correct gap and tracking classes', () => {
    render(
      <Button
        className="gap-1.5 font-action-button"
      >
        <ShoppingCart className="h-4 w-4" />
        Carrinho
      </Button>
    );

    const button = screen.getByRole('button', { name: /carrinho/i });
    
    // Verificando se as classes que controlam o gap e o tracking estão presentes
    // O tracking é controlado pela classe global .font-action-button definida no index.css
    expect(button).toHaveClass('gap-1.5');
    expect(button).toHaveClass('font-action-button');
  });

  it('should maintain consistent classes in a flex container (mobile simulation)', () => {
    render(
      <div className="flex gap-2.5">
        <Button className="gap-1.5 font-action-button">Carrinho</Button>
        <Button className="gap-1.5 font-action-button">Orçamento</Button>
      </div>
    );

    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toHaveClass('gap-1.5');
      expect(button).toHaveClass('font-action-button');
    });
  });
});
