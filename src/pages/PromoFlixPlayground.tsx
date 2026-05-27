
import { PromoFlixPlayer } from '@/components/products/gallery/PromoFlixPlayer';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PromoFlixPlayground() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">PromoFlix Playground</h1>
          </div>
          <span className="rounded bg-primary px-3 py-1 text-sm font-bold uppercase tracking-widest">
            QA Mode
          </span>
        </header>

        <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-white/10 shadow-2xl">
              <PromoFlixPlayer
                src="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
                isHls={true}
                title="Sintel - Test HLS Stream"
                productName="Produto de Teste"
                autoPlay={false}
              />
            </div>
            <div className="rounded-lg bg-zinc-900/50 p-6 border border-white/5">
              <h2 className="mb-4 text-xl font-semibold">Instruções de Teste</h2>
              <ul className="list-inside list-disc space-y-2 text-zinc-400">
                <li><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">Space</kbd> ou <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">K</kbd>: Play/Pause</li>
                <li><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">←</kbd> / <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">→</kbd> ou <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">J</kbd> / <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">L</kbd>: Voltar/Avançar 10s</li>
                <li><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">↑</kbd> / <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">↓</kbd>: Volume</li>
                <li><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">M</kbd>: Mute</li>
                <li><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">F</kbd>: Fullscreen</li>
                <li><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">P</kbd>: Picture-in-Picture</li>
                <li><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">S</kbd>: Screenshot (Print)</li>
                <li><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">&lt;</kbd> / <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">&gt;</kbd>: Velocidade (0.5x a 2x)</li>
              </ul>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-lg bg-zinc-900 p-6 border border-white/5">
              <h3 className="mb-3 text-lg font-medium text-white">Status da Implementação</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">HLS Support</span>
                  <span className="text-green-500 text-sm font-bold uppercase">OK</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Netflix UI</span>
                  <span className="text-green-500 text-sm font-bold uppercase">OK</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Keyboard shortcuts</span>
                  <span className="text-green-500 text-sm font-bold uppercase">OK</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Screenshot Tool</span>
                  <span className="text-green-500 text-sm font-bold uppercase">OK</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-primary/10 p-6 border border-primary/20">
              <p className="text-sm text-primary-foreground/80">
                Este playground é utilizado para validar visualmente o reprodutor <strong>PromoFlix</strong> antes do envio para produção.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
