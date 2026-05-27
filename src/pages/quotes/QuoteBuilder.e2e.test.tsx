import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuoteBuilderPage from './QuoteBuilderPage';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HelmetProvider } from 'react-helmet-async';
import * as React from 'react';

// --- Mocks de Hooks e Serviços ---

// Mock de navegação
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: undefined }),
    useSearchParams: () => [new URLSearchParams()],
  };
});

// Mock de Autenticação
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ 
    user: { id: 'seller-uuid', full_name: 'Vendedor Teste' },
    isAdmin: false 
  }),
}));

// Mock de Organização
vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ currentOrg: { id: 'org-uuid' } }),
}));

// Mock de CRM (necessário para o Seletor de Cliente)
vi.mock('@/lib/crm-db', () => ({
  selectCrm: vi.fn(async (table) => {
    if (table === 'companies') return [{ id: 'comp-1', razao_social: 'Empresa Teste LTDA', nome_fantasia: 'Empresa Teste', cnpj: '12.345.678/0001-99' }];
    if (table === 'contacts') return [{ id: 'cont-1', full_name: 'João Contato', cargo: 'Comprador' }];
    if (table === 'contact_emails') return [{ email: 'joao@teste.com' }];
    if (table === 'contact_phones') return [{ numero: '(11) 98888-7777' }];
    return [];
  }),
  searchCrm: vi.fn(async () => []),
}));

// Mock do Banco de Dados Externo (Busca de Produtos)
vi.mock('@/lib/external-db', () => ({
  fetchPromobrindProducts: vi.fn(async () => [
    { 
      id: 'prod-1', 
      name: 'Caneta Metal Premium', 
      sku: 'CAN-001', 
      base_price: 15.50, 
      sale_price: 12.90,
      images: ['https://img.com/caneta.jpg'],
      colors: [{ name: 'Azul', hex: '#0000FF', stock: 500 }]
    }
  ]),
  getProductImageUrl: vi.fn((p) => p.images?.[0] || null),
}));

// Mock do serviço de orçamentos (envio final)
vi.mock('@/services/quoteService', () => ({
  quoteService: {
    createQuote: vi.fn(async () => ({ id: 'new-quote-id', quote_number: 'ORC-2026-0001' })),
    fetchTechniques: vi.fn(async () => []),
    logHistory: vi.fn(async () => {}),
  }
}));

// --- Configuração do Ambiente de Teste ---

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

const renderBuilder = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <BrowserRouter>
          <TooltipProvider>
            <QuoteBuilderPage />
          </TooltipProvider>
        </BrowserRouter>
      </HelmetProvider>
    </QueryClientProvider>
  );
};

// --- Teste E2E do Fluxo Completo ---

describe('QuoteBuilderPage E2E Wizard Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('should complete the full wizard flow from client selection to proposal submission', async () => {
    const user = userEvent.setup();
    renderBuilder();

    // --- ETAPA 1: CLIENTE ---
    // 1.1 Selecionar Empresa
    const companyInput = screen.getByTestId('company-search-input');
    await user.click(companyInput);
    await user.type(companyInput, 'Empresa Teste');
    
    // Esperar a opção aparecer e clicar
    const companyOption = await screen.findByTestId('company-option-comp-1');
    await user.click(companyOption);

    // 1.2 Selecionar Contato
    // Se o contato for único, ele é selecionado automaticamente via useEffect em SingleContactDisplay
    // mas precisamos esperar o componente renderizar o estado final
    const contactTrigger = await screen.findByText(/João Contato/i);
    expect(contactTrigger).toBeInTheDocument();

    // Verificar se o Step 1 está marcado como concluído visualmente no stepper
    const wizard = screen.getByTestId('quote-wizard');
    const clientStep = within(wizard).getByLabelText(/Etapa 1: Cliente/i);
    expect(clientStep).toHaveAttribute('aria-label', expect.stringContaining('Concluída'));

    // --- ETAPA 2: CONDIÇÕES ---
    // 2.1 Forma de Pagamento
    const paymentMethodTrigger = screen.getByTestId('payment-method-select');
    await user.click(paymentMethodTrigger);
    const pixOption = await screen.findByRole('option', { name: /Transferência Bancária \/ Pix/i });
    await user.click(pixOption);

    // 2.2 Prazo de Pagamento
    const paymentTermsTrigger = screen.getByTestId('payment-terms-select');
    await user.click(paymentTermsTrigger);
    const termsOption = await screen.findByRole('option', { name: /7 dias a partir da entrega/i });
    await user.click(termsOption);

    // 2.3 Prazo de Entrega
    const deliveryTimeTrigger = screen.getByTestId('delivery-time-select');
    await user.click(deliveryTimeTrigger);
    const deliveryOption = await screen.findByRole('option', { name: /14 dias | Após aprovação/i });
    await user.click(deliveryOption);

    // 2.4 Frete
    const shippingTrigger = screen.getByTestId('shipping-type-select');
    await user.click(shippingTrigger);
    const cifOption = await screen.findByRole('option', { name: /CIF | Frete grátis/i });
    await user.click(cifOption);

    // Verificar Step 2
    const conditionsStep = within(wizard).getByLabelText(/Etapa 2: Condições/i);
    expect(conditionsStep).toHaveAttribute('aria-label', expect.stringContaining('Concluída'));

    // --- ETAPA 3: ITENS ---
    // Precisamos primeiro ir para a etapa de itens clicando nela ou via nextStep
    // Mas o hook useQuoteBuilderState deve permitir adicionar produtos de qualquer lugar se habilitado, 
    // porém o wizard exige a navegação. Vamos clicar no step 3.
    await user.click(within(wizard).getByLabelText(/Etapa 3: Itens/i));

    // 3.1 Abrir busca de produto
    const addProductBtn = await screen.findByTestId('quote-add-product-button');
    await user.click(addProductBtn);

    // 3.2 Buscar e Selecionar Produto
    const productSearchInput = await screen.findByTestId('product-search-input');
    await user.type(productSearchInput, 'Caneta');
    const productOption = await screen.findByTestId('product-search-option-prod-1');
    await user.click(productOption);

    // 3.3 Selecionar Cor (Modal de cores)
    const colorOption = await screen.findByTestId('color-option-Azul');
    await user.click(colorOption);

    // Verificar se o item foi adicionado ao resumo
    const itemCard = await screen.findByTestId('quote-item-0');
    expect(itemCard).toHaveTextContent('Caneta Metal Premium');
    
    // Verificar Step 3
    const itemsStep = within(wizard).getByLabelText(/Etapa 3: Itens/i);
    expect(itemsStep).toHaveAttribute('aria-label', expect.stringContaining('Concluída'));

    // --- ETAPA 4: REVISÃO E ENVIO ---
    // 4.1 Verificar Total (12,90 de um item sem personalização)
    const totalValue = screen.getByTestId('summary-total-value');
    expect(totalValue).toHaveTextContent('R$ 12,90');

    // 4.2 Enviar Proposta (Botão "Criar")
    const createBtn = screen.getByTestId('quote-save-final');
    expect(createBtn).not.toBeDisabled();
    await user.click(createBtn);

    // 4.3 Validar Redirecionamento ou Sucesso
    await waitFor(() => {
      // O mock do createQuote retorna ID, o handleSaveQuote geralmente navega para a página do orçamento
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/orcamentos/new-quote-id'));
    });
  });
});
