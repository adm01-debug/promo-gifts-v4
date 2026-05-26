import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, AlertCircle, Clock, Trash2 } from 'lucide-react';

export function SkeletonDevTools() {
  const { isDev } = useAuth();
  const [forced, setForced] = useState(false);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    if (!isDev) return;
    (window as any).__FORCE_SKELETONS__ = forced;
    (window as any).__SIMULATE_API_ERROR__ = apiError;
  }, [forced, apiError, isDev]);

  if (!isDev) return null;

  return (
    <div className="fixed bottom-20 left-4 z-[9999] pointer-events-auto">
      <Card className="p-3 shadow-2xl border-primary/20 bg-background/90 backdrop-blur-md space-y-3 w-48">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
          <Clock className="w-3 h-3" /> Skeleton Tools
        </div>
        
        <div className="space-y-2">
          <Button 
            variant={forced ? "destructive" : "outline"} 
            size="sm" 
            className="w-full justify-start text-[11px] h-8"
            onClick={() => setForced(!forced)}
          >
            {forced ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Clock className="w-3 h-3 mr-2" />}
            {forced ? "Stop Loading" : "Force Loading"}
          </Button>

          <Button 
            variant={apiError ? "destructive" : "outline"} 
            size="sm" 
            className="w-full justify-start text-[11px] h-8"
            onClick={() => setApiError(!apiError)}
          >
            <AlertCircle className="w-3 h-3 mr-2" />
            {apiError ? "Clear Error" : "Simulate Error"}
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start text-[11px] h-8"
            onClick={() => {
              console.clear();
              localStorage.clear();
              window.location.reload();
            }}
          >
            <Trash2 className="w-3 h-3 mr-2" />
            Clear & Reload
          </Button>
        </div>
      </Card>
    </div>
  );
}
