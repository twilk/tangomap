'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

// <model-viewer> is a custom element registered by importing the module at
// runtime; declare the (subset of) props we use so TSX type-checks.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        ar?: boolean;
        'ar-modes'?: string;
        'camera-controls'?: boolean;
      };
    }
  }
}

/** Minimal shape of the model-viewer element methods we call. */
type ModelViewerEl = HTMLElement & {
  loaded?: boolean;
  model?: {
    materials?: Array<{
      pbrMetallicRoughness?: { baseColorTexture?: { setTexture?: (t: unknown) => void } };
    }>;
  };
  createTexture?: (url: string) => Promise<unknown>;
  activateAR?: () => Promise<void>;
};

type Phase = 'idle' | 'ready' | 'unsupported';

/**
 * L1 "Place my card" — world-anchored surface AR via <model-viewer>, one
 * component covering Android (WebXR/Scene Viewer) and iOS (auto-generated USDZ
 * AR Quick Look). We ship ONE generic quad (public/ar/card-quad.gltf) and swap
 * its placeholder texture for this dancer's /u/<handle>/card/ar-image PNG — no
 * per-user 3D assets. Loads the ~1 MB library only on devices that can actually
 * place; everywhere else it renders nothing and onFallback (the fullscreen
 * immersive card) stays the AR affordance.
 *
 * NOTE: the AR session itself cannot be verified without a physical ARCore
 * Android or an iPhone + camera — this is device-tested behavior.
 */
export function ArPlaceCard({ handle, onFallback }: { handle: string; onFallback: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [busy, setBusy] = useState(false);
  const ref = useRef<ModelViewerEl | null>(null);

  // Cheap capability probe first (no library), then load model-viewer only if
  // the device can place. Desktops/unsupported browsers never pay the download.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let ok = false;
      try {
        const a = document.createElement('a');
        // iOS Safari AR Quick Look advertises rel="ar" support.
        if (typeof a.relList?.supports === 'function' && a.relList.supports('ar')) ok = true;
      } catch {}
      if (!ok) {
        try {
          const xr = (navigator as Navigator & { xr?: { isSessionSupported(m: string): Promise<boolean> } }).xr;
          if (xr?.isSessionSupported) ok = await xr.isSessionSupported('immersive-ar');
        } catch {}
      }
      if (cancelled) return;
      if (!ok) {
        setPhase('unsupported');
        return;
      }
      try {
        await import('@google/model-viewer'); // registers the custom element
        if (!cancelled) setPhase('ready');
      } catch {
        if (!cancelled) setPhase('unsupported');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Swap the generic quad's white placeholder for this dancer's card PNG. The
  // runtime swap carries into iOS Quick Look because model-viewer auto-generates
  // the USDZ from the live scene at AR launch (not a static ios-src file).
  const swapTexture = useCallback(async () => {
    const mv = ref.current;
    if (!mv?.createTexture) return;
    try {
      const tex = await mv.createTexture(`/u/${encodeURIComponent(handle)}/card/ar-image`);
      mv.model?.materials?.[0]?.pbrMetallicRoughness?.baseColorTexture?.setTexture?.(tex);
    } catch {}
  }, [handle]);

  useEffect(() => {
    const mv = ref.current;
    if (phase !== 'ready' || !mv) return;
    mv.addEventListener('load', swapTexture);
    if (mv.loaded) void swapTexture();
    return () => mv.removeEventListener('load', swapTexture);
  }, [phase, swapTexture]);

  const place = useCallback(async () => {
    const mv = ref.current;
    if (phase !== 'ready' || !mv?.activateAR) {
      onFallback();
      return;
    }
    setBusy(true);
    try {
      await swapTexture();
      await mv.activateAR();
    } catch {
      onFallback();
    } finally {
      setBusy(false);
    }
  }, [phase, onFallback, swapTexture]);

  if (phase !== 'ready') return null;

  return (
    <>
      <button type="button" className="tm-cta ghost" onClick={place} disabled={busy}>
        {busy ? 'Opening…' : 'Place in your space'}
      </button>
      {/* Off-screen launcher — model-viewer is only the AR entry point here. */}
      <model-viewer
        ref={ref}
        src="/ar/card-quad.gltf"
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
    </>
  );
}
