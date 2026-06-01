import { describe, expect, it } from 'vitest';

import { validateFile } from '../file-validation';

describe('validateFile', () => {
  it('bloqueia spoofing de extensão quando a assinatura real não bate', async () => {
    const exeHeader = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    const spoofed = new File([exeHeader], 'payload.jpg', { type: 'image/jpeg' });

    const result = await validateFile(spoofed);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('possível arquivo malicioso');
  });

  it('bloqueia MIME spoofing quando o browser reporta tipo fora da allowlist', async () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const spoofedMime = new File([pngHeader], 'imagem.png', { type: 'application/octet-stream' });

    const result = await validateFile(spoofedMime);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Tipo de arquivo inválido.');
  });

  it('bloqueia arquivos com tamanho extremo acima do limite', async () => {
    const overLimit = new File([new Uint8Array(6 * 1024 * 1024)], 'grande.pdf', {
      type: 'application/pdf',
    });

    const result = await validateFile(overLimit, { maxSizeMb: 5 });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Arquivo excede o limite de 5MB.');
  });

  it('aceita arquivo com metadados maliciosos no nome quando conteúdo é válido', async () => {
    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const withInjectedName = new File([pdfHeader], 'relatorio-"><script>alert(1)</script>.pdf', {
      type: 'application/pdf',
    });

    const result = await validateFile(withInjectedName);

    expect(result).toEqual({ valid: true });
  });

  it('bloqueia arquivos parcialmente válidos (extensão e MIME permitidos, bytes inválidos)', async () => {
    const truncatedJpeg = new Uint8Array([0xff, 0xd8, 0x00, 0x00]);
    const partial = new File([truncatedJpeg], 'foto.jpeg', { type: 'image/jpeg' });

    const result = await validateFile(partial);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('possível arquivo malicioso');
  });

  it('retorna erro explícito para extensão não permitida, sem quebra silenciosa', async () => {
    const txtLike = new File(['hello'], 'readme.txt', { type: 'text/plain' });

    const result = await validateFile(txtLike);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Extensão de arquivo não permitida.');
  });
});
