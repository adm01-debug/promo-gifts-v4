export interface Product {
  id: string;
  name: string;
  sku: string;
}

export interface ProductGroup {
  id: string;
  group_code: string;
  group_name: string;
}

export interface ProductGroupMember {
  id: string;
  product_id: string;
  product_group_id: string;
  use_group_rules: boolean;
  product_group?: ProductGroup;
}

export interface Component {
  id: string;
  product_id: string;
  component_code: string;
  component_name: string;
  is_personalizable: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface Location {
  id: string;
  component_id: string;
  location_code: string;
  location_name: string;
  max_width_cm: number | null;
  max_height_cm: number | null;
  max_area_cm2: number | null;
  area_image_url: string | null;
  is_active: boolean;
}

export interface Technique {
  id: string;
  code: string;
  name: string;
}

export interface LocationTechnique {
  id: string;
  component_location_id: string;
  technique_id: string;
  composed_code: string;
  max_colors: number | null;
  /**
   * Updates do toggle "definir como padrão" não persistem no DB.
   */
  is_default: boolean;
  is_active: boolean;
  technique?: Technique;
}
