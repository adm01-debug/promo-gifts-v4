// src/lib/date-utils.ts

import { format, formatDistance, formatRelative, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata uma data no padrão brasileiro
 * @param date - Data a ser formatada (Date, string ISO, timestamp)
 * @param pattern - Padrão de formatação (default: dd/MM/yyyy)
 * @returns String formatada em português
 */
export function formatDate(date: Date | string | number, pattern: string = 'dd/MM/yyyy'): string {
  const parsedDate = typeof date === 'string' ? parseISO(date) : new Date(date);
  return format(parsedDate, pattern, { locale: ptBR });
}

/**
 * Formata data e hora no padrão brasileiro
 * @param date - Data a ser formatada
 * @returns String no formato "dd/MM/yyyy HH:mm"
 */
export function formatDateTime(date: Date | string | number): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm');
}

/**
 * Formata apenas a hora
 * @param date - Data a ser formatada
 * @returns String no formato "HH:mm"
 */
export function formatTime(date: Date | string | number): string {
  return formatDate(date, 'HH:mm');
}

/**
 * Formata data em formato relativo (ex: "há 2 dias")
 * @param date - Data a ser formatada
 * @param baseDate - Data base para comparação (default: agora)
 * @returns String formatada em português
 */
export function formatDateRelative(
  date: Date | string | number,
  baseDate: Date = new Date(),
): string {
  const parsedDate = typeof date === 'string' ? parseISO(date) : new Date(date);
  return formatDistance(parsedDate, baseDate, {
    locale: ptBR,
    addSuffix: true,
  });
}

/**
 * Formata data em formato relativo completo
 * Ex: "ontem às 15:30", "hoje às 10:00"
 */
export function formatDateRelativeFull(
  date: Date | string | number,
  baseDate: Date = new Date(),
): string {
  const parsedDate = typeof date === 'string' ? parseISO(date) : new Date(date);
  return formatRelative(parsedDate, baseDate, { locale: ptBR });
}

/**
 * Formata data para exibição em lista/tabela
 * Ex: "25 Dez 2025, 14:30"
 */
export function formatDateCompact(date: Date | string | number): string {
  return formatDate(date, 'dd MMM yyyy, HH:mm');
}

/**
 * Formata data por extenso
 * Ex: "25 de dezembro de 2025"
 */
export function formatDateLong(date: Date | string | number): string {
  return formatDate(date, "dd 'de' MMMM 'de' yyyy");
}

/**
 * Formata dia da semana
 * Ex: "Segunda-feira", "Terça-feira"
 */
export function formatWeekday(date: Date | string | number): string {
  return formatDate(date, 'EEEE');
}

/**
 * Formata mês e ano
 * Ex: "Dezembro de 2025"
 */
export function formatMonthYear(date: Date | string | number): string {
  return formatDate(date, "MMMM 'de' yyyy");
}

/**
 * Verifica se uma data é hoje
 */
export function isToday(date: Date | string | number): boolean {
  const parsedDate = typeof date === 'string' ? parseISO(date) : new Date(date);
  const today = new Date();
  return (
    parsedDate.getDate() === today.getDate() &&
    parsedDate.getMonth() === today.getMonth() &&
    parsedDate.getFullYear() === today.getFullYear()
  );
}

/**
 * Verifica se uma data é ontem
 */
export function isYesterday(date: Date | string | number): boolean {
  const parsedDate = typeof date === 'string' ? parseISO(date) : new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    parsedDate.getDate() === yesterday.getDate() &&
    parsedDate.getMonth() === yesterday.getMonth() &&
    parsedDate.getFullYear() === yesterday.getFullYear()
  );
}

/**
 * Verifica se uma data é amanhã
 */
export function isTomorrow(date: Date | string | number): boolean {
  const parsedDate = typeof date === 'string' ? parseISO(date) : new Date(date);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    parsedDate.getDate() === tomorrow.getDate() &&
    parsedDate.getMonth() === tomorrow.getMonth() &&
    parsedDate.getFullYear() === tomorrow.getFullYear()
  );
}

/**
 * Formata data inteligente (hoje/ontem/amanhã ou data normal)
 */
export function formatDateSmart(date: Date | string | number): string {
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  if (isTomorrow(date)) return 'Amanhã';
  return formatDate(date);
}
