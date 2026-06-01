import { SecurityDashboard } from './SecurityDashboard';

export function SecuritySettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Central de Segurança</h2>
        <p className="text-muted-foreground">
          Visualize e gerencie todas as configurações de segurança da sua conta em um só lugar.
        </p>
      </div>

      <SecurityDashboard />
    </div>
  );
}
