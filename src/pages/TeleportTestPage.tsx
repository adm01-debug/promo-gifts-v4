import { PersistentBreadcrumbs } from '@/components/common/PersistentBreadcrumbs';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function TeleportTestPage() {
  const navigate = useNavigate();
  
  return (
    <div className="p-8 space-y-8">
      <div className="border-b pb-4">
        <PersistentBreadcrumbs showBackButton />
      </div>
      
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Teletransporte Test Page</h1>
        <p className="text-muted-foreground">
          Use esta página para testar o comportamento do botão "Teletransporte".
        </p>
        
        <div className="flex gap-4">
          <Button onClick={() => navigate('/produtos')}>Ir para Produtos</Button>
          <Button onClick={() => navigate('/favoritos')}>Ir para Favoritos</Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            Back Manual (Browser)
          </Button>
        </div>
      </div>
    </div>
  );
}
