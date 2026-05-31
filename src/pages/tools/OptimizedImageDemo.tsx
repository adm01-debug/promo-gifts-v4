import React, { useState } from 'react';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCcw, AlertTriangle } from 'lucide-react';

export default function OptimizedImageDemo() {
  const [blur, setBlur] = useState(20);
  const [zoom, setZoom] = useState(1.1);
  const [duration, setDuration] = useState(700);
  const [key, setKey] = useState(0);
  const [showError, setShowError] = useState(false);

  const sampleImage = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800";
  const errorImage = "https://invalid-url.com/non-existent.jpg";

  const reload = () => setKey(prev => prev + 1);

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">OptimizedImage Demo</h1>
        <p className="text-muted-foreground">
          Ajuste os parâmetros para visualizar o efeito de transição blur-up e fade-in.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Blur Amount ({blur}px)</Label>
              </div>
              <Slider 
                value={[blur]} 
                onValueChange={([v]) => setBlur(v)} 
                min={0} 
                max={100} 
                step={1} 
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Zoom Amount ({zoom.toFixed(2)}x)</Label>
              </div>
              <Slider 
                value={[zoom]} 
                onValueChange={([v]) => setZoom(v)} 
                min={1} 
                max={2} 
                step={0.05} 
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Duration ({duration}ms)</Label>
              </div>
              <Slider 
                value={[duration]} 
                onValueChange={([v]) => setDuration(v)} 
                min={0} 
                max={3000} 
                step={100} 
              />
            </div>

            <div className="pt-4 space-y-2">
              <Button onClick={reload} className="w-full gap-2">
                <RefreshCcw className="h-4 w-4" /> Reiniciar Carregamento
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowError(!showError)} 
                className="w-full gap-2"
              >
                {showError ? 'Mostrar Imagem Válida' : 'Testar Estado de Erro'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center items-center min-h-[400px] bg-muted/20 rounded-lg">
            <div className="w-full max-w-sm aspect-[4/5] bg-white rounded-xl shadow-2xl overflow-hidden border">
              <OptimizedImage
                key={key}
                src={showError ? errorImage : sampleImage}
                alt="Product Preview"
                blurAmount={blur}
                zoomAmount={zoom}
                duration={duration}
                containerClassName="h-full w-full"
                priority
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Com LQIP (Base64/Thumb)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Simulando uma versão de baixa qualidade (LQIP) que aparece instantaneamente.
            </p>
            <div className="aspect-video relative overflow-hidden rounded-md border">
              <OptimizedImage
                key={`lqip-${key}`}
                src={sampleImage + "&t=" + key}
                lqip="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=1&w=50"
                alt="LQIP Demo"
                blurAmount={blur}
                zoomAmount={zoom}
                duration={duration}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fallback Automático</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sem LQIP, o componente usa um shimmer e aplica o efeito na imagem conforme ela carrega.
            </p>
            <div className="aspect-video relative overflow-hidden rounded-md border">
              <OptimizedImage
                key={`fallback-${key}`}
                src={sampleImage + "&fb=" + key}
                alt="Fallback Demo"
                blurAmount={blur}
                zoomAmount={zoom}
                duration={duration}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
