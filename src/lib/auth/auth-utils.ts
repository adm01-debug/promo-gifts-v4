import type { AppRole } from '@/contexts/AuthContext';

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export const FLOW_GREETINGS = [
  '{greeting}, {name}! Que bom te ver! Estou pronto pra te ajudar a vender mais hoje. \ud83d\ude80',
  '{greeting}, {name}! J\u00e1 separei algumas novidades do cat\u00e1logo pra voc\u00ea! \ud83d\ude0e',
  'E a\u00ed, {name}! Bora fazer acontecer! Estou aqui sempre que precisar. \ud83d\udcaa',
  '{greeting}, {name}! Tenho insights fresquinhos esperando por voc\u00ea! \u2728',
  'Fala, {name}! Pronto pra mais um dia de vendas incr\u00edveis? \ud83c\udfaf',
];

export function getRandomGreeting(name: string): string {
  const greeting = getGreeting();
  const template = FLOW_GREETINGS[Math.floor(Math.random() * FLOW_GREETINGS.length)];
  return template.replace('{greeting}', greeting).replace('{name}', name);
}

/**
 * Higher roles have lower index in the array for comparison.
 * hierarchy: dev > supervisor > agente
 */
const ROLE_HIERARCHY: AppRole[] = ['dev', 'supervisor', 'admin', 'manager', 'agente', 'vendedor'];

export function getHighestRole(roles: AppRole[]): AppRole | null {
  if (!roles.length) return null;
  return roles.reduce((highest, current) => {
    const highestIdx = ROLE_HIERARCHY.indexOf(highest);
    const currentIdx = ROLE_HIERARCHY.indexOf(current);
    if (highestIdx === -1) return current;
    if (currentIdx === -1) return highest;
    return currentIdx < highestIdx ? current : highest;
  });
}

export function isSupervisorOrAbove(roles: AppRole[]): boolean {
  return roles.some((r) => ['dev', 'supervisor', 'admin', 'manager'].includes(r));
}
