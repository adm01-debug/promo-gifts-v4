/* eslint-disable @typescript-eslint/require-await */
/**
 * Behavioural tests for mockup-storage utilities.
 * Run: npx vitest run src/lib/__tests__/mockup-storage.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploadCalls: Array<{ path: string; options: unknown }> = [];
let uploadError: unknown = null;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn((path: string, _blob: unknown, options: unknown) => {
          uploadCalls.push({ path, options });
          return Promise.resolve({ data: { path }, error: uploadError });
        }),
        getPublicUrl: vi.fn((path: string) => ({
          data: { publicUrl: `https://storage.example.com/${path}` },
        })),
      })),
    },
  },
}));

import { uploadLogoToStorage, downloadImageFromUrl } from '@/lib/mockup-storage';

// 1x1 transparent PNG
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

beforeEach(() => {
  uploadCalls.length = 0;
  uploadError = null;
});

describe('uploadLogoToStorage', () => {
  it('uploads a data: URL and returns the public URL under {userId}/logos/', async () => {
    const url = await uploadLogoToStorage('user-42', PNG_DATA_URL, 'My Logo!');
    expect(url).toMatch(/^https:\/\/storage\.example\.com\//);
    expect(uploadCalls).toHaveLength(1);
    expect(uploadCalls[0].path).toMatch(/^user-42\/logos\/\d+-My_Logo_\.png$/);
    expect(uploadCalls[0].options).toMatchObject({ contentType: 'image/png', upsert: false });
  });

  it('returns null for an input without base64 content', async () => {
    const url = await uploadLogoToStorage('user-42', 'not-a-data-url');
    expect(url).toBeNull();
    expect(uploadCalls).toHaveLength(0);
  });

  it('returns null when the storage upload errors', async () => {
    uploadError = { message: 'quota exceeded' };
    const url = await uploadLogoToStorage('user-42', PNG_DATA_URL);
    expect(url).toBeNull();
  });
});

describe('downloadImageFromUrl', () => {
  it('falls back to window.open when the fetch is not ok (BUG-07)', async () => {
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Response('not found', { status: 404 })),
    );

    await downloadImageFromUrl('https://cdn.example.com/missing.png', 'file.png');
    expect(openSpy).toHaveBeenCalledWith('https://cdn.example.com/missing.png', '_blank');

    vi.unstubAllGlobals();
  });
});
