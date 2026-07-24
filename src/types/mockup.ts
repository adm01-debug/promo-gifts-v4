// src/types/mockup.ts
// Rascunhos de mockup

// BUG-10 FIX: The local PersonalizationArea definition was stale — it had 9 fields out of sync
// with the canonical definition in MultiAreaManager (positionX/Y, logoWidth/Height/Rotation/Scale,
// logoPreview, maxWidthCm/maxHeightCm/maxColors/isCurved/techniquesAvailable all absent).
// Importing and re-exporting from the single source of truth eliminates the divergence entirely.
import type { PersonalizationArea } from '@/components/mockup/MultiAreaManager';
export type { PersonalizationArea };

export interface MockupDraft {
  id: string;
  user_id: string;
  draft_key: string; // default: 'default'
  product_id: string | null;
  product_name: string | null;
  technique_id: string | null;
  technique_name: string | null;
  client_id: string | null;
  client_name: string | null;
  personalization_areas: PersonalizationArea[]; // JSONB
  logo_data: string | null; // JSONB stringified
  created_at: string;
  updated_at: string;
}

export interface LogoData {
  url: string;
  width: number;
  height: number;
  originalName?: string;
}

// G9 FIX: there used to be a second, divergent `GeneratedMockup` definition here
// (seller_id, missing client_name/layout_url/annotations…). It was unused and drifted
// from the runtime shape. Re-export the single source of truth from the service.
export type { GeneratedMockup } from '@/hooks/mockup/mockupGenerationService';
