import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, AlertCircle, Clock, Trash2, Bug } from 'lucide-react';

export function SkeletonDevTools() {
  const { isAdmin, isDev: isDevRole } = useAuth();
  const isDev = isAdmin || isDevRole;
  const [forced, setForced] = useState(false);
  const [debugLogs, setDebugLogs] = useState(false);

  useEffect(() => {
    if (!isDev) return;
    (window as any).__FORCE_SKELETONS__ = forced;
    (window as any).__DEBUG_SKELETONS__ = debugLogs;
  }, [forced, debugLogs, isDev]);

  if (!isDev) return null;

  return (
    <div className="fixed bottom-24 left-4 z-[9999] pointer-events-auto">
      <Card className="p-3 shadow-2xl border-primary/20 bg-background/90 backdrop-blur-md space-y-3 w-52">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
          <div className="flex items-center gap-1.5">
            <Bug className="w-3 h-3" /> Skeleton Debug
          </div>
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        </div>
        
        <div className="space-y-2">
          <Button 
            variant={forced ? "destructive" : "outline"} 
            size="sm" 
            className="w-full justify-start text-[11px] h-8"
            onClick={() => setForced(!forced)}
          >
            {forced ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Clock className="w-3 h-3 mr-2" />}
            {forced ? "Disable Forced Loading" : "Force Loading State"}
          </Button>

          <Button 
            variant={debugLogs ? "primary" : "outline"} 
            size="sm" 
            className="w-full justify-start text-[11px] h-8"
            onClick={() => setDebugLogs(!debugLogs)}
          >
            <Bug className="w-3 h-3 mr-2" />
            {debugLogs ? "Hide Console Traces" : "Show Console Traces"}
          </Button>

          <div className="pt-2 mt-2 border-t border-border/50">
             <p className="text-[9px] text-muted-foreground leading-tight italic">
               Use these tools to validate layout shift and skeleton consistency during transitions.
             </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
