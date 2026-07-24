// Tipos centralizados para o sistema de color swatches
// Alimentados pelo campo products.color_swatches (JSONB, mantido por triggers)
// fn_rebuild_color_swatches: P1(product_images/variant_id→CF) → P2(product_images/color_id→CF) → P3(pv.images[0]) → P4(primary_image_url)

export interface ColorSwatch {
  /** UUID da variante representante da cor (maior estoque individual) */
  variant_id: string;
  /** SKU da variante representante */
  sku: string;
  /** UUID canônico da cor em color_variations */
  color_id: string;
  /** Nome legível da cor, ex: 'AZUL', 'ROSA' */
  color_name: string;
  /** Hex code para renderizar o dot, ex: '#0066CB' */
  color_hex: string;
  /** Estoque TOTAL desta cor (SUM de todas as variantes com esse color_id) */
  stock_quantity: number;
  /** Melhor URL de imagem disponível para esta cor (hierarquia P1→P4) */
  image_url: string | null;
  /** true se stock_quantity > 0 */
  is_in_stock: boolean;
}

export interface ColorSwatchState {
  /** Variante ativa selecionada pelo usuário, null = todas as cores */
  activeVariantId: string | null;
  /** Dados da variante ativa */
  activeVariant: ColorSwatch | null;
  /** URL da imagem a exibir (swatch.image_url ou product.primary_image_url) */
  displayImage: string | null;
  /** Estoque a exibir (swatch.stock_quantity ou product.stock_quantity total) */
  displayStock: number;
  /** Label contextual do campo estoque */
  stockLabel: 'Estoque nesta cor' | 'Estoque total';
  /** true quando há variante selecionada */
  isFiltered: boolean;
}
