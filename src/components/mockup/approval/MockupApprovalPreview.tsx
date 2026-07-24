/**
 * MockupApprovalPreview — Full-page preview of the approval document
 * with PDF download capability and automatic layout capture.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { MockupApprovalTemplate } from './MockupApprovalTemplate';
import type { MockupApprovalData } from '@/types/mockup-approval';

import { logger } from '@/lib/logger';
interface MockupApprovalPreviewProps {
  data: MockupApprovalData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired once with the captured layout image data URL */
  onLayoutCaptured?: (layoutDataUrl: string) => void;
}

export function MockupApprovalPreview({
  data,
  open,
  onOpenChange,
  onLayoutCaptured,
}: MockupApprovalPreviewProps) {
  const templateRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const hasCapturedRef = useRef(false);

  // Auto-capture the layout once it renders
  useEffect(() => {
    if (!open || !onLayoutCaptured || hasCapturedRef.current) return;
    // Wait for images to load and template to render
    const timer = setTimeout(async () => {
      if (!templateRef.current || hasCapturedRef.current) return;
      hasCapturedRef.current = true;
      try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(templateRef.current, {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        onLayoutCaptured(dataUrl);
      } catch (err) {
        logger.error('Layout capture error:', err);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [open, onLayoutCaptured]);

  // Reset capture flag when dialog closes
  useEffect(() => {
    if (!open) hasCapturedRef.current = false;
  }, [open]);

  const handleExportPdf = useCallback(async () => {
    if (!templateRef.current) return;
    setIsExporting(true);

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(templateRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const canvasAspect = canvas.width / canvas.height;
      const pageAspect = pageWidth / pageHeight;

      let imgWidth: number;
      let imgHeight: number;
      let offsetX = 0;
      let offsetY = 0;

      if (canvasAspect > pageAspect) {
        imgWidth = pageWidth;
        imgHeight = pageWidth / canvasAspect;
        offsetY = 0;
      } else {
        imgHeight = pageHeight;
        imgWidth = pageHeight * canvasAspect;
        offsetX = (pageWidth - imgWidth) / 2;
      }

      pdf.addImage(imgData, 'JPEG', offsetX, offsetY, imgWidth, imgHeight);

      const filename = `mockup-aprovacao-${data.documentNumber.replace(/[/\s]/g, '-')}.pdf`;
      pdf.save(filename);
      toast.success('PDF exportado com sucesso!');
    } catch (err) {
      logger.error('PDF export error:', err);
      toast.error('Erro ao exportar PDF. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  }, [data.documentNumber]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-[860px] overflow-hidden p-0">
        <DialogHeader className="flex-row items-center justify-between border-b px-6 pb-2 pt-4">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <FileText aria-hidden="true" className="h-5 w-5 text-primary" />
              Aprovação de Layout
            </DialogTitle>
            <DialogDescription>
              Ref. {data.documentNumber} — {data.client.name}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleExportPdf} disabled={isExporting} size="sm" className="gap-1.5">
              {isExporting ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Download aria-hidden="true" className="h-4 w-4" />
              )}
              {isExporting ? 'Exportando...' : 'Baixar PDF'}
            </Button>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(95vh-80px)] overflow-auto bg-muted/30 p-4">
          <div className="mx-auto" style={{ width: '794px' }}>
            <div className="overflow-hidden rounded-lg bg-white shadow-xl">
              <MockupApprovalTemplate ref={templateRef} data={data} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
