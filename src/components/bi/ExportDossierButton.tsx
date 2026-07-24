/**
 * ExportDossierButton — botão de exportação do Dossiê BI em PDF.
 */
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBIDossierExport } from '@/hooks/bi/useBIDossierExport';

interface Props {
  clientId: string;
}

export function ExportDossierButton({ clientId }: Props) {
  const { isReady, isExporting, exportPDF } = useBIDossierExport(clientId);

  const handleClick = async () => {
    try {
      await exportPDF();
      toast.success('Dossiê exportado', {
        description: 'PDF gerado com sucesso.',
      });
    } catch {
      toast.error('Falha ao gerar dossiê', {
        description: 'Tente novamente.',
      });
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={!isReady || isExporting}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Gerando...
        </>
      ) : (
        <>
          <FileDown className="h-4 w-4" />
          Exportar Dossiê PDF
        </>
      )}
    </Button>
  );
}
