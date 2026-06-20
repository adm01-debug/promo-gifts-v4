import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { validateFile } from '@/lib/security/file-validation';

import { logger } from '@/lib/logger';
interface ImageUploadButtonProps {
  currentImageUrl: string | null;
  onUpload: (url: string) => void;
  onRemove: () => void;
  folder?: string;
  className?: string;
}

export function ImageUploadButton({
  currentImageUrl,
  onUpload,
  onRemove,
  folder = 'locations',
  className,
}: ImageUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 🛡️ Camada de Segurança V2.0: Validação de integridade e tipo real
    const validation = await validateFile(file, {
      maxSizeMb: 5,
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });

    if (!validation.valid) {
      toast.error(validation.error || 'Arquivo inválido');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      let retryCount = 0;
      const maxRetries = 3;
      let uploadSuccess = false;
      let lastError: unknown = null;

      while (retryCount < maxRetries && !uploadSuccess) {
        try {
          const { data, error } = await supabase.functions.invoke('secure-upload', {
            body: formData,
          });

          if (error) {
            // Se for erro 403 (bloqueio por malware ou falha de verificação), não tentamos novamente
            if (error.status === 403) {
              throw error;
            }
            throw error;
          }

          onUpload(data.url);
          toast.success('Imagem enviada com segurança!');
          uploadSuccess = true;
        } catch (error: unknown) {
          lastError = error;
          const errObj = error as Record<string, unknown>;

          // Se for bloqueio de segurança (403), interrompe as tentativas
          if (
            errObj?.status === 403 ||
            (errObj?.context as Record<string, unknown>)?.status === 403 ||
            ((errObj?.context as Record<string, unknown>)?.context as Record<string, unknown>)
              ?.status === 403
          ) {
            break;
          }

          retryCount++;
          if (retryCount < maxRetries) {
            const delay = 2 ** retryCount * 1000; // Exponential backoff: 2s, 4s
            logger.warn(
              `Tentativa ${retryCount} falhou. Tentando novamente em ${delay}ms...`,
              error,
            );
            await new Promise((resolve) => {
              setTimeout(resolve, delay);
            });
          }
        }
      }

      if (!uploadSuccess) {
        throw lastError;
      }
    } catch (error) {
      logger.error('Upload error:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!currentImageUrl) return;

    try {
      // Extract path from URL
      const urlParts = currentImageUrl.split('/personalization-images/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('personalization-images').remove([filePath]);
      }
      onRemove();
      toast.success('Imagem removida!');
    } catch (error) {
      logger.error('Remove error:', error);
      toast.error('Erro ao remover imagem');
    }
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {currentImageUrl ? (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0">
                <ImageIcon className="h-4 w-4 text-primary" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="p-0">
              <img
                src={currentImageUrl}
                alt="Área de gravação"
                className="max-h-48 max-w-64 rounded"
                loading="lazy"
              />
            </TooltipContent>
          </Tooltip>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Upload className="mr-1 h-3 w-3" />
              <span className="text-xs">Imagem</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
