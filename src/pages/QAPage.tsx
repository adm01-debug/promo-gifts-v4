import { useState, useRef, useEffect } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDevGate } from '@/hooks/admin';
import { devInfraGate } from '@/lib/system/dev-gate/DevInfraGate';

export default function QAPage() {
  const [viewportWidth, setViewportWidth] = useState('100%');
  const [_burstCount, setBurstCount] = useState(0);
  const [renderCount, setRenderCount] = useState(0);
  const lastRenderCountRef = useRef(0);

  // Observador reativo via Gate
  const { isAllowed } = useDevGate();

  // Contador de renders reais para validar debounce
  useEffect(() => {
    lastRenderCountRef.current += 1;
    setRenderCount(lastRenderCountRef.current);
  });

  const runBurstTest = () => {
    const burstSize = 10;
    setBurstCount(burstSize);

    // Simula múltiplas escritas rápidas no localStorage
    for (let i = 0; i < burstSize; i++) {
      const val = i % 2 === 0 ? 'true' : 'false';
      localStorage.setItem('show_dev_infra_messages', val);
      // Dispara manualmente o evento de storage já que o browser não dispara para a própria aba
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'show_dev_infra_messages',
          newValue: val,
        }),
      );
    }
  };

  const widths = [
    { label: 'Mobile (320px)', value: '320px' },
    { label: 'Mobile (375px)', value: '375px' },
    { label: 'Tablet (768px)', value: '768px' },
    { label: 'Desktop (1024px)', value: '1024px' },
    { label: 'Full', value: '100%' },
  ];

  return (
    <>
      <PageSEO
        title="QA Playground"
        description="Ambiente de testes para validação de layout, responsividade e acessibilidade."
        path="/qa"
      />
      <div className="min-h-screen animate-fade-in space-y-8 bg-background p-4 md:p-8">
        <header className="flex flex-col gap-4 border-b pb-6">
          <div>
            <h1
              data-testid="page-title-qa"
              className="font-display text-3xl font-bold tracking-tight"
            >
              QA Responsive Playground
            </h1>
            <p className="text-muted-foreground">
              Valide layout, overflow e estados dos componentes em diferentes larguras.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
            <span className="px-2 text-sm font-medium">Simular largura:</span>
            {widths.map((w) => (
              <Button
                key={w.value}
                variant={viewportWidth === w.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewportWidth(w.value)}
              >
                {w.label}
              </Button>
            ))}
          </div>
        </header>

        <div
          className="mx-auto overflow-hidden rounded-xl border-2 border-dashed border-muted bg-zinc-50 shadow-inner transition-all duration-300 dark:bg-zinc-950"
          style={{ width: viewportWidth }}
        >
          <div className="space-y-12 p-4 md:p-6">
            {/* Typography Section */}
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 border-b pb-2 text-lg font-semibold">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Typography & Spacing
              </h2>
              <div className="space-y-4">
                <h1 className="text-4xl font-extrabold lg:text-5xl">Heading 1 - Fluid Font Size</h1>
                <h2 className="text-3xl font-bold">Heading 2 - Responsive</h2>
                <p className="max-w-2xl text-lg leading-relaxed">
                  Este parágrafo testa a legibilidade e o comportamento de linha em diferentes
                  larguras. Garantindo que o contraste e o tamanho da fonte (min 16px no mobile)
                  sejam mantidos.
                </p>
                <p className="text-muted-foreground">
                  Texto muted para teste de contraste e acessibilidade.
                </p>
              </div>
            </section>

            {/* Buttons & Interactive Section */}
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 border-b pb-2 text-lg font-semibold">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Buttons & Form Elements (A11y Touch Size)
              </h2>
              <div className="flex flex-wrap gap-4">
                <Button size="lg">Primary LG (44px+)</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button disabled>Disabled</Button>
              </div>
              <div className="grid max-w-sm gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox id="terms" className="h-5 w-5" />
                  <label
                    htmlFor="terms"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Checkbox (Touch target 44px+)
                  </label>
                </div>
                <Input placeholder="Input de texto responsivo..." />
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Opção 1</SelectItem>
                    <SelectItem value="2">Opção 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            {/* Grid & Cards Section (Overflow Test) */}
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 border-b pb-2 text-lg font-semibold">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Grid & Overflow Protection
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="space-y-2 p-4">
                  <Badge>Status: OK</Badge>
                  <h3 className="font-bold">Card Title</h3>
                  <p className="truncate text-sm text-muted-foreground">
                    Este texto deve truncar caso o card seja muito pequeno no mobile.
                  </p>
                </Card>
                <Card className="space-y-2 p-4">
                  <Badge variant="secondary">Status: Pending</Badge>
                  <h3 className="font-bold">Long Text Content</h3>
                  <p className="text-sm text-muted-foreground">
                    Testando como o card expande verticalmente quando o texto é longo e não cabe em
                    uma linha.
                  </p>
                </Card>
                <Card className="space-y-2 overflow-x-auto p-4">
                  <Badge variant="outline">Horizontal Scroll</Badge>
                  <div className="flex w-[400px] gap-2">
                    <div className="flex h-10 w-20 shrink-0 items-center justify-center rounded bg-muted text-[10px]">
                      Fix 1
                    </div>
                    <div className="flex h-10 w-20 shrink-0 items-center justify-center rounded bg-muted text-[10px]">
                      Fix 2
                    </div>
                    <div className="flex h-10 w-20 shrink-0 items-center justify-center rounded bg-muted text-[10px]">
                      Fix 3
                    </div>
                    <div className="flex h-10 w-20 shrink-0 items-center justify-center rounded bg-muted text-[10px]">
                      Fix 4
                    </div>
                    <div className="flex h-10 w-20 shrink-0 items-center justify-center rounded bg-muted text-[10px]">
                      Fix 5
                    </div>
                  </div>
                </Card>
              </div>
            </section>

            {/* Navigation/Tabs Section */}
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 border-b pb-2 text-lg font-semibold">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Responsive Tabs (Scrollable)
              </h2>
              <Tabs defaultValue="tab1" className="w-full">
                <TabsList className="no-scrollbar w-full justify-start overflow-x-auto">
                  <TabsTrigger value="tab1">Overview</TabsTrigger>
                  <TabsTrigger value="tab2">Analytics</TabsTrigger>
                  <TabsTrigger value="tab3">Team Settings</TabsTrigger>
                  <TabsTrigger value="tab4">Billing History</TabsTrigger>
                  <TabsTrigger value="tab5">Integrations</TabsTrigger>
                  <TabsTrigger value="tab6">API Access</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1" className="mt-2 rounded-md border bg-background p-4">
                  Conteúdo da Tab 1 - Testando padding interno e alinhamento.
                </TabsContent>
              </Tabs>
            </section>

            {/* Integration Test Section */}
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 border-b pb-2 text-lg font-semibold">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Integration Test: Storage Debounce & Sync
              </h2>
              <Card className="border-blue-200 bg-blue-50/50 p-6 dark:border-blue-800 dark:bg-blue-900/10">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Status do Gate
                    </h3>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={isAllowed ? 'default' : 'destructive'}
                        className="px-4 py-1 text-lg"
                      >
                        {isAllowed ? 'ATIVO' : 'INATIVO'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        (Baseado em localStorage: <code>show_dev_infra_messages</code>)
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p>
                        🔥 Renders do componente:{' '}
                        <span className="font-mono font-bold text-blue-600">{renderCount}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Deve aumentar apenas 1 vez após um burst de alterações.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Ações de Teste
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={runBurstTest} variant="secondary">
                        Disparar Burst (10x writes)
                      </Button>
                      <Button
                        onClick={() => {
                          localStorage.removeItem('show_dev_infra_messages');
                          devInfraGate.invalidateCache();
                        }}
                        variant="outline"
                      >
                        Reset Gate
                      </Button>
                    </div>
                    <p className="text-[10px] italic text-muted-foreground">
                      O burst simula 10 alterações rápidas. Graças ao debounce de 50ms, o Gate deve
                      processar apenas a última e disparar um único update de UI.
                    </p>
                  </div>
                </div>
              </Card>
            </section>
          </div>
        </div>

        <footer className="border-t pt-8 text-center text-xs text-muted-foreground">
          <p>
            Breakpoints: sm (640px) | md (768px) | lg (1024px) | xl (1280px) | 2xl (1536px) | 3xl
            (1920px)
          </p>
        </footer>
      </div>
    </>
  );
}
