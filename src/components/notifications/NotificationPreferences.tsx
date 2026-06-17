import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Smartphone, Shield, Info, Rocket } from 'lucide-react';
import {
  notificationPreferenceService,
  type UserNotificationPreference,
} from '@/services/notificationPreferenceService';
import { toast } from 'sonner';

const CATEGORIES = [
  {
    id: 'security',
    label: 'Segurança',
    icon: Shield,
    description: 'Alertas de login e alterações de conta',
  },
  {
    id: 'system',
    label: 'Sistema',
    icon: Info,
    description: 'Atualizações e avisos da plataforma',
  },
  {
    id: 'marketing',
    label: 'Promoções',
    icon: Rocket,
    description: 'Novidades e ofertas exclusivas',
  },
];

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<UserNotificationPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPreferences();

    // Subscribe to real-time changes
    const unsubscribe = notificationPreferenceService.subscribeToPreferences((updatedPref) => {
      setPreferences((prev) => {
        const index = prev.findIndex(
          (p) =>
            p.id === updatedPref.id ||
            (p.category === updatedPref.category && p.user_id === updatedPref.user_id),
        );
        if (index >= 0) {
          const next = [...prev];
          next[index] = updatedPref;
          return next;
        }
        return [...prev, updatedPref];
      });
    });

    return () => unsubscribe();
  }, []);

  async function loadPreferences() {
    setIsLoading(true);
    const prefs = await notificationPreferenceService.getPreferences();
    setPreferences(prefs);
    setIsLoading(false);
  }

  async function togglePreference(
    category: string,
    type: 'in_app_enabled' | 'push_enabled',
    value: boolean,
  ) {
    const success = await notificationPreferenceService.updatePreference(category, {
      [type]: value,
    });
    if (success) {
      setPreferences((prev) => {
        const exists = prev.some((p) => p.category === category);
        if (exists) {
          return prev.map((p) => (p.category === category ? { ...p, [type]: value } : p));
        }
        return [
          ...prev,
          {
            id: '',
            user_id: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            category,
            in_app_enabled: true,
            push_enabled: true,
            [type]: value,
          } as UserNotificationPreference,
        ];
      });
      toast.success('Preferências atualizadas');
    } else {
      toast.error('Erro ao atualizar preferências');
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando preferências...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        {CATEGORIES.map((cat) => {
          const pref = preferences.find((p) => p.category === cat.id) || {
            in_app_enabled: true,
            push_enabled: true,
          };
          const Icon = cat.icon;

          return (
            <Card key={cat.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{cat.label}</CardTitle>
                    <CardDescription>{cat.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor={`${cat.id}-inapp`} className="text-sm font-normal">
                      Na plataforma (In-app)
                    </Label>
                  </div>
                  <Switch
                    id={`${cat.id}-inapp`}
                    checked={pref.in_app_enabled}
                    onCheckedChange={(val) => togglePreference(cat.id, 'in_app_enabled', val)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor={`${cat.id}-push`} className="text-sm font-normal">
                      Notificações Push
                    </Label>
                  </div>
                  <Switch
                    id={`${cat.id}-push`}
                    checked={pref.push_enabled}
                    onCheckedChange={(val) => togglePreference(cat.id, 'push_enabled', val)}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
