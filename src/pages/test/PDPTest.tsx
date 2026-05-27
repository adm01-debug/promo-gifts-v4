import { ProductDetailHero } from '../products/product-detail/ProductDetailHero';
import { Product } from '@/hooks/products';

export default function PDPTest() {
  const mockProduct: Product = {
    id: 'test-id',
    name: 'Produto de Teste com Badges',
    description: 'Descrição de teste',
    price: 99.9,
    sku: 'SKU-TESTE',
    minQuantity: 10,
    stock: 500,
    stockStatus: 'in-stock',
    featured: true,
    newArrival: true,
    onSale: true,
    isKit: true,
    gender: 'unissex',
    category: { id: 1, name: 'Canetas', icon: '🖋️' },
    groups: [{ id: 2, name: 'Escritório', icon: '🏢' }],
    images: ['https://images.unsplash.com/photo-1583483423576-9d3244670020?w=800&q=80'],
    supplier: { id: 'sup-1', name: 'Fornecedor Teste' },
    leadTimeDays: 5,
    variations: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="p-8 bg-background min-h-screen">
      <ProductDetailHero
        product={mockProduct}
        id="test-id"
        selectedVariation={null}
        setSelectedVariation={() => {}}
        isFavorite={false}
        onToggleFavorite={() => {}}
        viewCount={123}
        supplierTrust={null}
        onOpenPackagingModal={() => {}}
        onOpenFutureStock={() => {}}
        onOpenSupplierComparison={() => {}}
      />
    </div>
  );
}
