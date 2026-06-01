/**
 * Aplica máscara de formatação para chaves PIX com base no tipo selecionado.
 */
export function applyPixMask(value: string, tipo: string): string {
  const digits = value.replace(/\D/g, '');

  switch (tipo) {
    case 'CPF':
      // 000.000.000-00
      return digits
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

    case 'CNPJ':
      // 00.000.000/0000-00
      return digits
        .slice(0, 14)
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');

    case 'Telefone':
      // (00) 00000-0000 or (00) 0000-0000
      if (digits.length <= 10) {
        return digits
          .slice(0, 10)
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
      }
      return digits
        .slice(0, 11)
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d{1,4})$/, '$1-$2');

    default:
      // Email, Aleatória — sem máscara
      return value;
  }
}

/** Valida dígitos verificadores de CPF */
export function validateCpfDigits(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // todos iguais

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (parseInt(digits[9]) !== check) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return parseInt(digits[10]) === check;
}

/** Valida dígitos verificadores de CNPJ */
export function validateCnpjDigits(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let check = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (parseInt(digits[12]) !== check) return false;

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  check = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return parseInt(digits[13]) === check;
}

/** Valida chave PIX conforme o tipo. Retorna mensagem de erro ou null se válido. */
export function validatePixKey(chave: string, tipo: string): string | null {
  const raw = chave.replace(/\D/g, '');
  switch (tipo) {
    case 'CPF':
      if (raw.length < 11) return null; // ainda digitando
      return validateCpfDigits(raw) ? null : 'CPF inválido (dígitos verificadores)';
    case 'CNPJ':
      if (raw.length < 14) return null;
      return validateCnpjDigits(raw) ? null : 'CNPJ inválido (dígitos verificadores)';
    default:
      return null;
  }
}

/** Placeholder dinâmico baseado no tipo */
export function pixPlaceholder(tipo: string): string {
  switch (tipo) {
    case 'CPF':
      return '000.000.000-00';
    case 'CNPJ':
      return '00.000.000/0000-00';
    case 'Telefone':
      return '(00) 00000-0000';
    case 'Email':
      return 'email@exemplo.com';
    case 'Aleatória':
      return 'Chave aleatória';
    default:
      return 'Selecione o tipo primeiro';
  }
}
