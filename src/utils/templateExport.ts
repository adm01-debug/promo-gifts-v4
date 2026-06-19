import { type QuoteTemplate } from '@/hooks/quotes';

export interface ExportedTemplate {
  version: string;
  exportedAt: string;
  templates: Array<Omit<QuoteTemplate, 'id' | 'seller_id' | 'created_at' | 'updated_at'>>;
}

/**
 * Exports templates to a downloadable JSON file
 */
export function exportTemplatesToJson(templates: QuoteTemplate[], filename?: string): void {
  const exportData: ExportedTemplate = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    templates: templates.map((template) => ({
      name: template.name,
      description: template.description,
      is_default: template.is_default,
      template_data: template.template_data,
      items: template.items,
      discount_percent: template.discount_percent,
      discount_amount: template.discount_amount,
      notes: template.notes,
      internal_notes: template.internal_notes,
      payment_terms: template.payment_terms,
      delivery_time: template.delivery_time,
      validity_days: template.validity_days,
    })),
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const defaultFilename =
    filename || `templates-export-${new Date().toISOString().split('T')[0]}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = defaultFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports a single template to JSON
 */
export function exportSingleTemplate(template: QuoteTemplate): void {
  const sanitizedName = template.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  exportTemplatesToJson([template], `template-${sanitizedName}.json`);
}

/**
 * Validates imported template data
 */
export function validateImportedTemplates(data: unknown): ExportedTemplate | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;

  if (!obj.version || !obj.templates || !Array.isArray(obj.templates)) {
    return null;
  }

  // Validate each template has required fields
  for (const template of obj.templates) {
    if (typeof template !== 'object' || !template) return null;
    const t = template as Record<string, unknown>;
    if (!t.name || typeof t.name !== 'string') return null;
  }

  return data as ExportedTemplate;
}

/**
 * Reads a JSON file and parses template data
 */
export function readTemplateFile(file: File): Promise<ExportedTemplate | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        const validated = validateImportedTemplates(data);
        resolve(validated);
      } catch {
        resolve(null);
      }
    };

    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}
