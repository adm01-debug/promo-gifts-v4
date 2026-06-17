import type { Product } from '@/hooks/products';

export type TemplateKey = 'formal' | 'informal' | 'promotional';

export interface MessageTemplate {
  key: TemplateKey;
  label: string;
  description: string;
  generate: (product: Product) => string;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    key: 'formal',
    label: 'Formal',
    description: 'Linguagem profissional para clientes corporativos',
    generate: (product) => {
      const colors = (product.colors ?? []).map((c) => c.name).join(', ');
      return `Prezado(a),

Segue informações sobre o produto solicitado:

*${product.name}*
SKU: ${product.sku}

${product.description ?? ''}

Cores disponíveis: ${colors || 'Sob consulta'}
Valor unitário: a partir de ${formatPrice(product.price)}
Quantidade mínima: ${product.minQuantity} unidades
${product.stockStatus === 'in-stock' ? 'Disponibilidade: Em estoque' : 'Disponibilidade: Sob consulta'}

Ficamos à disposição para maiores informações.

Atenciosamente,
Promo Brindes`;
    },
  },
  {
    key: 'informal',
    label: 'Informal',
    description: 'Tom descontraído e direto',
    generate: (product) => {
      const colors = (product.colors ?? []).map((c) => c.name).join(', ');
      return `Oi! 😊

Olha esse produto que separei pra você:

*${product.name}*

${product.description ?? ''}

🎨 Cores: ${colors || 'Consulte'}
💰 A partir de ${formatPrice(product.price)}/un
📦 Qtd mínima: ${product.minQuantity} un
${product.stockStatus === 'in-stock' ? '✅ Em estoque' : '⚠️ Consultar disponibilidade'}

Promo Brindes - Brindes com Excelência!`;
    },
  },
  {
    key: 'promotional',
    label: 'Promoção',
    description: 'Destaque urgência e benefícios',
    generate: (product) => {
      const colors = (product.colors ?? []).map((c) => c.name).join(', ');
      const colorCount = colors ? colors.split(', ').length : 0;
      return `🔥 *OPORTUNIDADE ESPECIAL* 🔥

*${product.name}*

${product.description ?? ''}

${colorCount > 0 ? `✨ ${colorCount} cores disponíveis: ${colors}` : '✨ Cores sob consulta'}
💰 A partir de apenas ${formatPrice(product.price)}/un
📦 Pedido mínimo: ${product.minQuantity} un
${product.stockStatus === 'in-stock' ? '🚀 PRONTA ENTREGA!' : '⏰ Consulte prazos'}

⚡ Condições especiais para pedidos esta semana!
📞 Fale conosco agora mesmo!

Promo Brindes - Brindes com Excelência!`;
    },
  },
];
