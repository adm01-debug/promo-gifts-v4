/**
 * ShareMenu — Multi-format sharing dropdown
 */

import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Share2, Download, Link2, Mail, MessageCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
const getJsPDF = () => import('jspdf').then((m) => m.default);

interface ShareMenuProps {
  mockupUrl: string;
  productName?: string;
  techniqueName?: string;
  /** Optional ref to the mockup image element for PDF capture */
  imageRef?: React.RefObject<HTMLImageElement>;
  className?: string;
}

export function ShareMenu({ mockupUrl, productName, techniqueName, className }: ShareMenuProps) {
  const fileName = `mockup-${productName?.replace(/\s+/g, '-') || 'produto'}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(mockupUrl);
      toast.success('Link copiado!');
    } catch (err: unknown) {
      logger.error('[ShareMenu] Falha ao copiar link:', err);
      toast.error('Erro ao copiar link');
    }
  };

  const handleDownloadPNG = async () => {
    try {
      const response = await fetch(mockupUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PNG baixado!');
    } catch (err: unknown) {
      logger.error('[ShareMenu] Falha ao baixar PNG:', err);
      toast.error('Erro ao baixar PNG');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = mockupUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const jsPDF = await getJsPDF();
      const pdf = new jsPDF({
        orientation: img.width > img.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [img.width + 80, img.height + 140],
      });

      // Header
      pdf.setFontSize(16);
      pdf.text(productName || 'Mockup', 40, 40);
      if (techniqueName) {
        pdf.setFontSize(10);
        pdf.setTextColor(120);
        pdf.text(`Técnica: ${techniqueName}`, 40, 60);
      }

      // Image
      pdf.addImage(img, 'PNG', 40, 80, img.width, img.height);

      pdf.save(`${fileName}.pdf`);
      toast.success('PDF gerado!');
    } catch (err: unknown) {
      logger.error('[ShareMenu] Falha ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF');
    }
  };

  const handleWhatsApp = () => {
    const text = `Confira o mockup${productName ? `: ${productName}` : ''}${techniqueName ? ` (${techniqueName})` : ''}\n${mockupUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Mockup${productName ? `: ${productName}` : ''}`);
    const body = encodeURIComponent(
      `Olá,\n\nSegue o mockup do produto${productName ? ` ${productName}` : ''}${techniqueName ? ` com técnica ${techniqueName}` : ''}:\n\n${mockupUrl}\n\nAtenciosamente`,
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Compartilhar mockup" className={className}>
          <Share2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Compartilhar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
          <Link2 className="mr-2 h-4 w-4" /> Copiar link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleWhatsApp} className="cursor-pointer">
          <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmail} className="cursor-pointer">
          <Mail className="mr-2 h-4 w-4" /> Email
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Baixar</DropdownMenuLabel>
        <DropdownMenuItem onClick={handleDownloadPNG} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4" /> Download PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadPDF} className="cursor-pointer">
          <FileText className="mr-2 h-4 w-4" /> Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
