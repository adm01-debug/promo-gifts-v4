import { ProductQuickActions } from '@/components/products/ProductQuickActions';

export default function IndicationTest() {
  const mockTags = {
    'Público-Alvo': ['Executivos', 'Novos Funcionários'],
    'Datas Comemorativas': ['Fim de Ano', 'Aniversário da Empresa'],
    Endomarketing: ['Onboarding'],
  };

  const mockNiches = ['Corporativo', 'Tecnologia'];

  const mockProduct = {
    id: 'test-product-id',
    name: 'Produto de Teste',
    sku: 'SKU-TESTE',
    price: 50.0,
    minQuantity: 10,
    images: ['https://placehold.co/600x400?text=Produto+de+Teste'],
    supplier: { id: 'supplier-id', name: 'Fornecedor Teste' },
    stockStatus: 'in-stock',
    stock: 1000,
    colors: [
      { name: 'Azul', hex: '#0000FF' },
      { name: 'Vermelho', hex: '#FF0000' }
    ],
    tags: {
      publicoAlvo: mockTags['Público-Alvo'],
      datasComemorativas: mockTags['Datas Comemorativas'],
      endomarketing: mockTags.Endomarketing,
      nicho: mockNiches
    }
  } as any;


  return (
    <div className="p-10 bg-background min-h-screen">
      <h1 className="text-2xl font-bold mb-8 text-foreground">Teste de Ações Rápidas (Indicação)</h1>
      
      <div className="max-w-md bg-card p-6 rounded-2xl border border-border shadow-lg">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Card do Produto</h2>
        <div className="aspect-square bg-muted rounded-xl mb-4 overflow-hidden">
          <img src={mockProduct.images[0]} alt="Mock" className="w-full h-full object-cover" />
        </div>
        
        <ProductQuickActions
          productId={mockProduct.id}
          productName={mockProduct.name}
          productSku={mockProduct.sku}
          basePrice={mockProduct.price}
          minQuantity={mockProduct.minQuantity}
          tags={mockTags}
          niches={mockNiches}
          product={mockProduct}
        />
      </div>

      <div className="mt-10 max-w-md bg-card p-6 rounded-2xl border border-border shadow-lg">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Cenário: Sem Tags (Deve ficar desabilitado)</h2>
        <ProductQuickActions
          productId="no-tags-id"
          productName="Produto sem Tags"
          basePrice={10.0}
          minQuantity={1}
          tags={{}}
          niches={[]}
          product={{ ...mockProduct, colors: [] }}
        />

      </div>
    </div>
  );
}
