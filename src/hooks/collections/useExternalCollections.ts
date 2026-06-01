/**
 * Hook para sincronizar coleções com o BD externo (Promobrind)
 * Tabelas: collections, collection_products
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
