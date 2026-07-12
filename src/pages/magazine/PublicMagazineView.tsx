/**
 * PublicMagazineView — /revista-publica/:token
 * Visualização pública de uma revista publicada, com botões Baixar PDF,
 * WhatsApp e Copiar link.
 *
 * v1: lê do localStorage (mesmo browser). A leitura cross-device chega
 * quando a migração Gold (qa/migrations-draft/2026-07-12_magazines.sql)
 * for aprovada e a edge function `magazine-public-view` for deployada.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Copy, Loader2, MessageCircle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { magazineService } from '@/services/magazineService';
import type { Magazine } from '@/types/magazine';
import { Button } from '@/components/ui/button';
import { paginateMagazine } from './pagination';
import { MagazinePageRenderer } from './components/MagazinePageRenderer';
import './magazine.css';

export default function PublicMagazineView() {
  const { token } = useParams<{ token: string }>();
  const [magazine, setMagazine] = useState<Magazine | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pageIdx, setPageIdx] = useState(0);

  useEffect(() => {
    if (!token) {
      setLoaded(true);
      return;
    }
    const found = magazineService.getByToken(token);
    setMagazine(found && found.status === 'published' ? found : null);
    setLoaded(true);
  }, [token]);

  const pages = useMemo(() => (magazine ? paginateMagazine(magazine) : []), [magazine]);
  const current = pages[pageIdx];

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copiado.');
  };
  const openWhatsApp = () => {
    const msg = magazine?.title
      ? `Olá! Compartilho a revista "${magazine.title}": ${shareUrl}`
      : `Confira esta revista: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };
  const openPrint = () => window.open(`/magazine/print?token=${token ?? ''}`, '_blank');

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!magazine) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 p-6 text-center text-white">
        <div>
          <div className="mb-2 text-2xl font-semibold">Revista indisponível</div>
          <div className="max-w-md text-sm opacity-80">
            O link expirou ou a revista foi despublicada. Peça um novo link ao remetente.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 py-6">
      <header className="mx-auto mb-4 flex max-w-[1200px] items-center justify-between px-4 text-white">
        <div>
          <div className="text-xs uppercase tracking-widest opacity-70">Revista</div>
          <div className="text-xl font-semibold">{magazine.title}</div>
          {magazine.branding.clientName && (
            <div className="text-sm opacity-80">Preparada para {magazine.branding.clientName}</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={openPrint}>
            <Printer className="mr-2 h-4 w-4" /> Baixar PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={openWhatsApp}>
            <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
          </Button>
          <Button variant="secondary" size="sm" onClick={copyLink}>
            <Copy className="mr-2 h-4 w-4" /> Copiar link
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-4">
        <div className="overflow-hidden rounded-xl bg-white shadow-2xl">
          {current ? <MagazinePageRenderer magazine={magazine} page={current} totalPages={pages.length} fitContainer /> : null}
        </div>

        <div className="mt-4 flex items-center justify-between text-white">
          <Button
            variant="ghost"
            className="text-white hover:text-white hover:bg-white/10"
            disabled={pageIdx === 0}
            onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
          </Button>
          <span className="text-sm opacity-80">
            Página {pageIdx + 1} de {pages.length}
          </span>
          <Button
            variant="ghost"
            className="text-white hover:text-white hover:bg-white/10"
            disabled={pageIdx >= pages.length - 1}
            onClick={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))}
          >
            Próxima <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
