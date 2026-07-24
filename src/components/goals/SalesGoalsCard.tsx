import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Plus, TrendingUp, Trophy, Calendar, Sparkles } from 'lucide-react';
import { useSalesGoals, type CreateGoalInput } from '@/hooks/intelligence';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const GOAL_TYPE_LABELS: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
};

export function SalesGoalsCard() {
  const { activeGoal, isLoading, createGoal, getProgress, getProgressColor, isCreating } =
    useSalesGoals();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateGoalInput>({
    goal_type: 'monthly',
    target_value: 50000,
    target_quotes: 20,
    target_conversions: 10,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.target_value <= 0) return;
    await createGoal(formData);
    setIsDialogOpen(false);
    setFormData({
      goal_type: 'monthly',
      target_value: 50000,
      target_quotes: 20,
      target_conversions: 10,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (!activeGoal) {
    return (
      <Card className="border-dashed bg-gradient-to-br from-muted/50 to-muted/30">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Target className="h-7 w-7 text-primary" />
          </div>
          <h3 className="mb-1 font-display font-semibold text-foreground">Defina sua Meta</h3>
          <p className="mb-4 max-w-xs text-sm text-muted-foreground">
            Crie uma meta de vendas para acompanhar seu progresso!
          </p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Meta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Nova Meta de Vendas
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select
                    value={formData.goal_type}
                    onValueChange={(v) =>
                      setFormData({ ...formData, goal_type: v as CreateGoalInput['goal_type'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Meta de Valor (R$)</Label>
                  <Input
                    type="number"
                    value={formData.target_value}
                    onChange={(e) =>
                      setFormData({ ...formData, target_value: Number(e.target.value) })
                    }
                    placeholder="50000"
                    min={0}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Meta de Orçamentos</Label>
                    <Input
                      type="number"
                      value={formData.target_quotes}
                      onChange={(e) =>
                        setFormData({ ...formData, target_quotes: Number(e.target.value) })
                      }
                      placeholder="20"
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Meta de Conversões</Label>
                    <Input
                      type="number"
                      value={formData.target_conversions}
                      onChange={(e) =>
                        setFormData({ ...formData, target_conversions: Number(e.target.value) })
                      }
                      placeholder="10"
                      min={0}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isCreating || formData.target_value <= 0}
                >
                  {isCreating ? 'Criando...' : 'Criar Meta'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  const progress = getProgress(activeGoal);
  const progressColor = getProgressColor(progress);
  const daysRemaining = differenceInDays(new Date(activeGoal.end_date), new Date());
  const quotesProgress = activeGoal.target_quotes
    ? (activeGoal.current_quotes / activeGoal.target_quotes) * 100
    : 0;
  const conversionsProgress = activeGoal.target_conversions
    ? (activeGoal.current_conversions / activeGoal.target_conversions) * 100
    : 0;

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all',
        activeGoal.is_achieved
          ? 'border-success/30 bg-gradient-to-br from-success/10 to-success/5'
          : 'border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10',
      )}
    >
      {activeGoal.is_achieved && (
        <div className="absolute right-2 top-2">
          <Badge variant="default" className="gap-1 bg-success">
            <Trophy className="h-3 w-3" />
            Atingida!
          </Badge>
        </div>
      )}

      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div
            className={cn(
              'rounded-lg p-2',
              activeGoal.is_achieved ? 'bg-success/20' : 'bg-primary/20',
            )}
          >
            <Target
              className={cn('h-5 w-5', activeGoal.is_achieved ? 'text-success' : 'text-primary')}
            />
          </div>
          Meta {GOAL_TYPE_LABELS[activeGoal.goal_type]}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Value Progress */}
        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Faturamento</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(activeGoal.current_value)}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              de {formatCurrency(activeGoal.target_value)}
            </p>
          </div>
          <Progress
            value={progress}
            className={cn(
              'h-3',
              progressColor === 'success' && '[&>div]:bg-success',
              progressColor === 'warning' && '[&>div]:bg-warning',
              progressColor === 'destructive' && '[&>div]:bg-destructive',
            )}
          />
          <p className="text-right text-xs text-muted-foreground">{progress.toFixed(1)}%</p>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 gap-3">
          {activeGoal.target_quotes > 0 && (
            <div className="rounded-lg bg-background/50 p-3">
              <div className="mb-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Orçamentos</span>
              </div>
              <p className="font-semibold">
                {activeGoal.current_quotes}/{activeGoal.target_quotes}
              </p>
              <Progress value={quotesProgress} className="mt-1 h-1.5" />
            </div>
          )}
          {activeGoal.target_conversions > 0 && (
            <div className="rounded-lg bg-background/50 p-3">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Conversões</span>
              </div>
              <p className="font-semibold">
                {activeGoal.current_conversions}/{activeGoal.target_conversions}
              </p>
              <Progress value={conversionsProgress} className="mt-1 h-1.5" />
            </div>
          )}
        </div>

        {/* Time Remaining */}
        <div className="flex items-center gap-2 border-t border-border/50 pt-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {daysRemaining > 0 ? (
              <>
                <span className="font-medium text-foreground">{daysRemaining}</span> dias restantes
              </>
            ) : daysRemaining === 0 ? (
              <span className="font-medium text-warning">Último dia!</span>
            ) : (
              <span className="text-muted-foreground">Período encerrado</span>
            )}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            até {format(new Date(activeGoal.end_date), 'dd/MM', { locale: ptBR })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
