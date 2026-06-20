/**
 * ArtFileUpload — Upload de arquivos de arte vetorial (AI, EPS, PDF, SVG, CDR)
 * vinculados a um mockup. Usa o bucket privado `mockup-art-files` com RLS por pasta de usuário.
 */
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, FileText, Trash2, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { logger } from '@/lib/logger';
const ACCEPTED_EXTENSIONS = ['.ai', '.eps', '.pdf', '.svg', '.cdr'];
const ACCEPTED_MIME = [
  'application/postscript',
  'application/illustrator',
  'application/pdf',
  'image/svg+xml',
  'application/x-coreldraw',
  'application/octet-stream',
];
const MAX_SIZE_MB = 25;

export interface ArtFileAttachment {
  id: string;
  file_url: string;
  file_path: string;
  original_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  file_extension: string | null;
  notes: string | null;
  created_at: string;
}

interface ArtFileUploadProps {
  userId: string;
  mockupId?: string | null;
  quoteId?: string | null;
  attachments: ArtFileAttachment[];
  onAttachmentsChange: (next: ArtFileAttachment[]) => void;
  className?: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function ArtFileUpload({
  userId,
  mockupId,
  quoteId,
  attachments,
  onAttachmentsChange,
  className,
}: ArtFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!userId) {
        toast.error('Faça login para anexar arquivos');
        return;
      }

      const list = Array.from(files);
      if (list.length === 0) return;

      setIsUploading(true);
      const uploaded: ArtFileAttachment[] = [];

      for (const file of list) {
        const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
        if (!ACCEPTED_EXTENSIONS.includes(ext)) {
          toast.error(`${file.name}: formato não suportado (${ACCEPTED_EXTENSIONS.join(', ')})`);
          continue;
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          toast.error(`${file.name}: excede ${MAX_SIZE_MB}MB`);
          continue;
        }

        const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const path = `${userId}/${Date.now()}-${safe}`;

        const { error: upErr } = await supabase.storage
          .from('mockup-art-files')
          .upload(path, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });

        if (upErr) {
          logger.error('[ArtFileUpload] upload error', upErr);
          toast.error(`Falha ao enviar ${file.name}`);
          continue;
        }

        const { data: signed } = await supabase.storage
          .from('mockup-art-files')
          .createSignedUrl(path, 60 * 60 * 24 * 7);

        const { data: row, error: insErr } = await supabase
          .from('art_file_attachments')
          .insert({
            user_id: userId,
            mockup_id: mockupId ?? null,
            quote_id: quoteId ?? null,
            file_url: signed?.signedUrl ?? '',
            file_path: path,
            original_name: file.name,
            mime_type: file.type || null,
            file_size_bytes: file.size,
            file_extension: ext,
          })
          .select()
          .single();

        if (insErr || !row) {
          logger.error('[ArtFileUpload] db insert error', insErr);
          toast.error(`Falha ao registrar ${file.name}`);
          await supabase.storage.from('mockup-art-files').remove([path]);
          continue;
        }

        uploaded.push(row as ArtFileAttachment);
      }

      if (uploaded.length > 0) {
        onAttachmentsChange([...attachments, ...uploaded]);
        toast.success(`${uploaded.length} arquivo(s) enviado(s)`);
      }

      setIsUploading(false);
    },
    [userId, mockupId, quoteId, attachments, onAttachmentsChange],
  );

  const handleRemove = useCallback(
    async (att: ArtFileAttachment) => {
      const { error: delErr } = await supabase
        .from('art_file_attachments')
        .delete()
        .eq('id', att.id);

      if (delErr) {
        toast.error('Falha ao remover registro');
        return;
      }

      const { error: storageErr } = await supabase.storage
        .from('mockup-art-files')
        .remove([att.file_path]);
      if (storageErr) {
        logger.error('[ArtFileUpload] Falha ao remover arquivo do storage:', storageErr);
      }
      onAttachmentsChange(attachments.filter((a) => a.id !== att.id));
      toast.success('Arquivo removido');
    },
    [attachments, onAttachmentsChange],
  );

  const handleDownload = useCallback(async (att: ArtFileAttachment) => {
    const { data, error } = await supabase.storage
      .from('mockup-art-files')
      .createSignedUrl(att.file_path, 60 * 5);
    if (error || !data?.signedUrl) {
      toast.error('Falha ao gerar link');
      return;
    }
    window.open(data.signedUrl, '_blank');
  }, []);

  return (
    <div className={cn('space-y-3', className)}>
      <Card
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        data-testid="mockup-art-file-dropzone"
        className={cn(
          'cursor-pointer border-2 border-dashed p-6 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={[...ACCEPTED_EXTENSIONS, ...ACCEPTED_MIME].join(',')}
          className="hidden"
          aria-label="Upload de arquivos de arte vetorial"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Enviando…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-6 w-6" />
            <p className="text-sm font-medium">Arraste arquivos vetoriais ou clique</p>
            <p className="text-xs">
              {ACCEPTED_EXTENSIONS.join(', ')} • máx {MAX_SIZE_MB}MB
            </p>
          </div>
        )}
      </Card>

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att) => (
            <Card key={att.id} className="flex items-center gap-3 p-3">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{att.original_name}</p>
                <p className="text-xs text-muted-foreground">
                  {att.file_extension?.toUpperCase().replace('.', '')} •{' '}
                  {formatBytes(att.file_size_bytes)}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleDownload(att)}
                aria-label={`Baixar arquivo ${att.original_name}`}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleRemove(att)}
                aria-label={`Remover arquivo ${att.original_name}`}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
