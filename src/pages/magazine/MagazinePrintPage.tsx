/**
 * MagazinePrintPage — /magazine/:id/print
 * Renderiza todas as páginas em sequência, sem chrome, para o usuário
 * usar o "Salvar como PDF" nativo do navegador (Cmd/Ctrl+P).
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Printer } from 'lucide-react';
import { magazineService } from '@/services/magazineService';
import type { Magazine } from '@/types/magazine';
import { Button } from '@/components/ui/button';
import { paginateMagazine } from './pagination';
import { MagazinePageRenderer } from './components/MagazinePageRenderer';
import './magazine.css';

export default function MagazinePrintPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [magazine, setMagazine] = useState<Magazine | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let m: Magazine | null = null;
      if (id) m = await magazineService.get(id);
      else if (token) m = await magazineService.getPublicByToken(token);
      if (cancelled) return;
      setMagazine(m);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  const pages = useMemo(() => (magazine ? paginateMagazine(magazine) : []), [magazine]);

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!magazine) {
    return (
      <div className="flex h-screen items-center justify-center text-center">
        <div>
          <div className="mb-2 text-xl font-semibold">Revista não encontrada</div>
          <div className="text-sm text-muted-foreground">Verifique o link e tente novamente.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-200 py-8">
      <div className="mag-hide-in-print fixed right-6 top-6 z-50 flex flex-col gap-2">
        <Button size="lg" onClick={() => window.print()} data-testid="magazine-print-btn">
          <Printer className="mr-2 h-5 w-5" /> Salvar como PDF
        </Button>
        <span className="rounded bg-black/70 px-2 py-1 text-center text-xs text-white">
          Use o diálogo de impressão do navegador
        </span>
      </div>

      <div className="mx-auto flex max-w-[1000px] flex-col gap-6 print:max-w-none print:gap-0">
        {pages.map((p) => (
          <div
            key={p.index}
            className="mx-auto w-full overflow-hidden rounded-lg bg-white shadow-lg print:rounded-none print:shadow-none"
          >
            <MagazinePageRenderer magazine={magazine} page={p} totalPages={pages.length} fitContainer />
          </div>
        ))}
      </div>
    </div>
  );
}
