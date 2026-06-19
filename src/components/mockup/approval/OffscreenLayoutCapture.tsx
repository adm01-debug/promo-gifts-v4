/**
 * OffscreenLayoutCapture — Renders the approval template off-screen,
 * captures it with html2canvas, uploads to storage, and updates the DB record.
 *
 * Usage: set `captureRequest` with the data + record ID. Once captured, it
 * auto-clears and calls `onCaptured`.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MockupApprovalTemplate } from './MockupApprovalTemplate';
import { supabase } from '@/integrations/supabase/client';
import type { MockupApprovalData } from '@/types/mockup-approval';
import { logger } from '@/lib/logger';
import { untypedFrom } from '@/lib/supabase-untyped';

export interface LayoutCaptureRequest {
  data: MockupApprovalData;
  recordId: string;
  userId: string;
}

interface OffscreenLayoutCaptureProps {
  request: LayoutCaptureRequest | null;
  onCaptured?: (recordId: string) => void;
}

export function OffscreenLayoutCapture({ request, onCaptured }: OffscreenLayoutCaptureProps) {
  const templateRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const processedRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const captureCountRef = useRef<Record<string, number>>({});

  // Reset counters on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      processedRef.current = null;
      captureCountRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!request || isCapturing || processedRef.current === request.recordId) return;

    // Trava de loop: impede mais de 3 tentativas para o mesmo recordId
    const count = (captureCountRef.current[request.recordId] ?? 0) + 1;
    captureCountRef.current[request.recordId] = count;

    if (count > 3) {
      logger.error('Loop de captura detectado para o record:', {
        recordId: request.recordId,
        attempts: count,
      });
      return;
    }

    const capture = async () => {
      // Wait for template to render
      await new Promise((r) => {
        setTimeout(r, 500);
      });
      if (!templateRef.current || !mountedRef.current) return;

      // Wait for all images inside the template to load
      const images = templateRef.current.querySelectorAll('img');
      if (images.length > 0) {
        await Promise.all(
          [...images].map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  img.onload = () => resolve();
                  img.onerror = () => resolve(); // don't block on broken images
                  // Timeout safety: resolve after 8s even if image never loads
                  setTimeout(resolve, 8000);
                }),
          ),
        );
      }

      // Extra buffer for rendering after images load
      await new Promise((r) => {
        setTimeout(r, 500);
      });
      if (!templateRef.current || !mountedRef.current) return;

      setIsCapturing(true);
      processedRef.current = request.recordId;
      const currentRecordId = request.recordId;

      try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(templateRef.current, {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        });

        if (!mountedRef.current) return;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        // Upload to storage
        const blob = await (await fetch(dataUrl)).blob();
        const fileName = `layout-${Date.now()}.jpg`;
        const storagePath = `${request.userId}/mockup-layouts/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('mockup-assets')
          .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true });

        if (uploadError) {
          logger.error('Layout auto-capture upload error:', uploadError);
          return;
        }

        const { data: urlData } = supabase.storage.from('mockup-assets').getPublicUrl(storagePath);

        // Update DB record
        const { error: updateError } = await untypedFrom('generated_mockups')
          .update({ layout_url: urlData.publicUrl })
          .eq('id', currentRecordId);

        if (updateError) {
          logger.error('Layout auto-capture DB update error:', updateError);
          return;
        }

        logger.log('Layout auto-captured for record:', currentRecordId);
        if (mountedRef.current) {
          onCaptured?.(currentRecordId);
        }
      } catch (err) {
        logger.error('Layout auto-capture error:', err);
      } finally {
        if (mountedRef.current) setIsCapturing(false);
      }
    };

    capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.recordId, isCapturing]);

  if (!request) return null;

  // Render off-screen via portal
  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: '-9999px',
        top: 0,
        width: '794px',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      <MockupApprovalTemplate ref={templateRef} data={request.data} />
    </div>,
    document.body,
  );
}
