export interface ViaCepResult {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

// BUG-007 FIX: Added 5-second timeout via AbortController.
// Previously there was no timeout, causing the fetch to hang indefinitely
// if viacep.com.br is slow or unavailable, blocking address auto-fill UI flows.
export async function fetchAddressByCep(cep: string): Promise<ViaCepResult | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return data as ViaCepResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
