import { logger } from '@/lib/logger';

/**
 * Utilitário robusto para validação de arquivos no frontend.
 * Previne ataques de extensão mascarada e arquivos corrompidos.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ValidationOptions {
  maxSizeMb?: number;
  allowedExtensions?: string[];
  allowedMimeTypes?: string[];
}

/**
 * Magic Numbers dos formatos permitidos para validação binária.
 * (Assinaturas dos primeiros bytes do arquivo)
 */
const MAGIC_NUMBERS: Record<string, string[]> = {
  'image/jpeg': ['ffd8ff'],
  'image/png': ['89504e47'],
  'image/webp': ['52494646'], // RIFF (seguido por WEBP)
  'application/pdf': ['25504446'], // %PDF
};

export async function validateFile(
  file: File,
  options: ValidationOptions = {},
): Promise<ValidationResult> {
  const {
    maxSizeMb = 5,
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'],
    allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  } = options;

  // 1. Validação de Tamanho
  const maxBytes = maxSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return { valid: false, error: `Arquivo excede o limite de ${maxSizeMb}MB.` };
  }

  // 2. Validação de Extensão
  const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  if (!allowedExtensions.includes(extension)) {
    return { valid: false, error: 'Extensão de arquivo não permitida.' };
  }

  // 3. Validação de MIME Type (Browser-reported)
  if (!allowedMimeTypes.includes(file.type)) {
    return { valid: false, error: 'Tipo de arquivo inválido.' };
  }

  // 4. Verificação de Integridade (Magic Numbers)
  // Lê os primeiros 4 bytes do arquivo para confirmar o tipo real
  try {
    const signature = await getFileSignature(file);
    const expectedSignatures = MAGIC_NUMBERS[file.type];

    if (expectedSignatures && !expectedSignatures.some((s) => signature.startsWith(s))) {
      logger.error('File signature mismatch detected', {
        filename: file.name,
        reportedType: file.type,
        signature,
      });
      return {
        valid: false,
        error: 'Conteúdo do arquivo não corresponde à sua extensão (possível arquivo malicioso).',
      };
    }
  } catch (err) {
    logger.warn('Could not verify file signature', err);
    // Em caso de erro na leitura (ex: browser antigo), permitimos passar,
    // confiando no RLS do bucket que também valida MIME types.
  }

  return { valid: true };
}

/**
 * Lê os primeiros bytes de um arquivo e retorna em formato Hex.
 */
async function getFileSignature(file: File): Promise<string> {
  const slice = file.slice(0, 4);
  const buffer = await slice.arrayBuffer();
  const view = new Uint8Array(buffer);
  return Array.from(view)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
