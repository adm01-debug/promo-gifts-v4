/**
 * Tipos para o SSOT — Dev Infra Messages Gate
 */
export type GateValue = boolean | 'auto';

/**
 * Interface para os provedores de flag do Gate.
 * Segue o princípio de Interface Segregation do SOLID.
 */
export interface GateFlagProvider {
  getFlag: () => GateValue;
}
