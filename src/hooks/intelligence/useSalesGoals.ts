import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { untypedFrom } from '@/lib/supabase-untyped';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfQuarter,
  endOfQuarter,
  format,
} from 'date-fns';

export interface SalesGoal {
  id: string;
  user_id: string;
  goal_type: 'monthly' | 'quarterly' | 'weekly';
  target_value: number;
  current_value: number;
  target_quotes: number;
  current_quotes: number;
  target_conversions: number;
  current_conversions: number;
  start_date: string;
  end_date: string;
  is_achieved: boolean;
  achieved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalInput {
  goal_type: 'monthly' | 'quarterly' | 'weekly';
  target_value: number;
  target_quotes?: number;
  target_conversions?: number;
}

export function useSalesGoals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get date range based on goal type
  const getDateRange = (type: 'monthly' | 'quarterly' | 'weekly') => {
    const now = new Date();
    switch (type) {
      case 'weekly':
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case 'quarterly':
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'monthly':
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  // Fetch current goals
  const { data: goals, isLoading } = useQuery({
    queryKey: ['sales-goals', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await untypedFrom('sales_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SalesGoal[];
    },
    enabled: !!user?.id,
  });

  // Get active goal for current period
  const { data: activeGoal, isLoading: isLoadingActive } = useQuery({
    queryKey: ['active-sales-goal', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const now = new Date().toISOString().split('T')[0];

      const { data, error } = await untypedFrom('sales_goals')
        .select('*')
        .eq('user_id', user.id)
        .lte('start_date', now)
        .gte('end_date', now)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error) throw error;
      return data as SalesGoal | null;
    },
    enabled: !!user?.id,
  });

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (input: CreateGoalInput) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { start, end } = getDateRange(input.goal_type);

      const { data, error } = await untypedFrom('sales_goals')
        .insert({
          user_id: user.id,
          goal_type: input.goal_type,
          target_value: input.target_value,
          target_quotes: input.target_quotes || 0,
          target_conversions: input.target_conversions || 0,
          current_value: 0,
          current_quotes: 0,
          current_conversions: 0,
          start_date: format(start, 'yyyy-MM-dd'),
          end_date: format(end, 'yyyy-MM-dd'),
        })
        .select()
        .single();

      if (error) throw error;
      return data as SalesGoal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-goals'] });
      queryClient.invalidateQueries({ queryKey: ['active-sales-goal'] });
      toast.success('Meta criada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar meta', { description: sanitizeError(error) });
    },
  });

  // Update goal progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: async ({
      goalId,
      addValue = 0,
      addQuotes = 0,
      addConversions = 0,
    }: {
      goalId: string;
      addValue?: number;
      addQuotes?: number;
      addConversions?: number;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Get current goal
      const { data: currentGoal, error: fetchError } = await untypedFrom('sales_goals')
        .select('*')
        .eq('id', goalId)
        .single();

      if (fetchError) throw fetchError;

      const newValue = (currentGoal.current_value || 0) + addValue;
      const newQuotes = (currentGoal.current_quotes || 0) + addQuotes;
      const newConversions = (currentGoal.current_conversions || 0) + addConversions;

      // Check if goal is achieved
      const isAchieved =
        newValue >= currentGoal.target_value &&
        (currentGoal.target_quotes === 0 || newQuotes >= currentGoal.target_quotes) &&
        (currentGoal.target_conversions === 0 || newConversions >= currentGoal.target_conversions);

      const wasNotAchieved = !currentGoal.is_achieved;

      const { data, error } = await untypedFrom('sales_goals')
        .update({
          current_value: newValue,
          current_quotes: newQuotes,
          current_conversions: newConversions,
          is_achieved: isAchieved,
          achieved_at:
            isAchieved && wasNotAchieved ? new Date().toISOString() : currentGoal.achieved_at,
        })
        .eq('id', goalId)
        .select()
        .single();

      if (error) throw error;

      return { goal: data as SalesGoal, justAchieved: isAchieved && wasNotAchieved };
    },
    onSuccess: async ({ justAchieved }) => {
      queryClient.invalidateQueries({ queryKey: ['sales-goals'] });
      queryClient.invalidateQueries({ queryKey: ['active-sales-goal'] });

      if (justAchieved) {
        toast.success('🎉 Meta atingida!', {
          description: 'Parabéns! Você atingiu sua meta!',
        });
      }
    },
    onError: (error) => {
      toast.error('Erro ao atualizar progresso', { description: sanitizeError(error) });
    },
  });

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await untypedFrom('sales_goals').delete().eq('id', goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-goals'] });
      queryClient.invalidateQueries({ queryKey: ['active-sales-goal'] });
      toast.success('Meta excluída');
    },
  });

  // Calculate progress percentage
  const getProgress = (goal: SalesGoal) => {
    if (!goal.target_value) return 0;
    return Math.min((goal.current_value / goal.target_value) * 100, 100);
  };

  // Get progress color based on percentage
  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'success';
    if (percentage >= 75) return 'primary';
    if (percentage >= 50) return 'warning';
    return 'destructive';
  };

  return {
    goals: goals || [],
    activeGoal,
    isLoading: isLoading || isLoadingActive,
    createGoal: createGoalMutation.mutateAsync,
    updateProgress: updateProgressMutation.mutateAsync,
    deleteGoal: deleteGoalMutation.mutateAsync,
    getProgress,
    getProgressColor,
    isCreating: createGoalMutation.isPending,
    isUpdating: updateProgressMutation.isPending,
  };
}
