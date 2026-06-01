/**
 * Shared styles and constants for ProposalHtmlTemplate
 */
import type React from 'react';

export const GREEN = '#00c853';
export const GREEN_DARK = '#009e41';
export const DARK = '#333333';
export const BLUE = '#0085ca';

export function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const thStyle: React.CSSProperties = {
  backgroundColor: GREEN,
  color: '#fff',
  padding: '15px 12px',
  fontSize: '13px',
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 700,
  textTransform: 'uppercase',
};

export const tdStyle: React.CSSProperties = {
  padding: '20px 12px',
  fontSize: '15px',
  color: '#333',
  verticalAlign: 'middle',
};

export const totalsRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 0',
  fontSize: '14px',
  color: '#555',
  borderBottom: '1px solid #fafafa',
};
