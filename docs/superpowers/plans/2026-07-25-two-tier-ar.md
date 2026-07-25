# Two-Tier AR for the Dancer Card — Design & Plan

> **For agentic workers:** This is a research + design plan. The buildable phases use
> checkbox (`- [ ]`) steps; implement task-by-task with superpowers:subagent-driven-development.
> **Hard environment limit:** none of the camera/AR paths can be verified from this repo's
> build or CI — no camera, no WebXR, no second phone. Every device-only step is marked ⚠️DEVICE.

**Goal:** Two AR experiences for the dancer card — (L1) place your own card on a real surface,
and (L2) the novel one: point your phone at someone else's phone (showing only a marker) and see
their card "hologrammed" over it, in your view.

**Architecture:** Web-first. Both levels reuse the card infrastructure that already exists
(`getCardData` resolver + a server-rendered card PNG by handle). AR paths degrade gracefully to
the current fullscreen immersive card when the device can't do AR.

**Tech Stack:** Next.js 15 / React 19 / TS. Existing: `qrcode` (encode), `next/og` (Satori card
PNG). New (per research below): a marker tracker (L2) and a WebXR/USDZ path (L1).

---

## The two levels (recap)

- **L1 — "Place my card"** (solo, world-anchored): open your own card, tap a real surface, a
  scalable copy anchors there, walk around it. Single device, your own card.
- **L2 — "Card over the phone"** (marker-anchored spectator AR) ★novel: A shows a marker on-screen;
  B points B's phone at it; B sees A's card floating anchored to A's phone at real-world scale.
  A's phone = anchor + identity; the card lives in B's view. Two devices, in person.

---

## What already exists (grounded — read before designing)

The *rendering* and *resolution* halves are largely solved. What's genuinely new is **tracking**.

| Concern | Already in the repo | File |
| --- | --- | --- |
| **Card data resolver** | `getCardData(handle)` → all card fields, **privacy-gated** (`null` for private/missing, no private fields out), React-`cache`d | `src/lib/publicProfile.ts` |
| **Card texture by URL** | `opengraph-image.tsx` renders the card to a PNG server-side (Satori/`ImageResponse`), keyed by handle, same privacy gate | `app/u/[handle]/card/opengraph-image.tsx` |
| **Card data contract** | `CardData` = `PublicProfile` + `serial`, `mintedYear`, `ghostMastered` | `src/lib/publicProfile.ts:31` |
| **Interactive card** | `DancerCard` (SVG/DOM), incl. the fullscreen `immersive` fallback + `?ar=1` deep-link + `/api/ar-open` beacon | `src/components/DancerCard.tsx` |
| **QR generation** | `qrcode` dep, dynamically imported as `loadQR()` (encode only) | `src/components/DancerCard.tsx:433` |
| **Usage beacon** | `POST /api/ar-open` logs one line per immersive open | `app/api/ar-open/route.ts` |

**Two consequences that shape the whole plan:**

1. **The card is already rendered three ways** — SVG/DOM (`DancerCard`), a 1080×1920 story canvas
   (`downloadStory`), and a 1200×630 Satori PNG (`opengraph-image`). AR needs a *texture*, i.e. a
   4th consumer. **Do not add a 4th bespoke renderer** — see the card-object contract below.
2. **L2's "resolve A's card from the marker" is a solved problem.** The marker only needs to carry
   a handle (or a signed short id → handle); B fetches the card via the existing resolver / PNG
   route. No card data travels in the marker. This is also the privacy guarantee (see below).

---

## Card-object contract (deliverable #4) — grounded recommendation

**Decision: the canonical AR texture is a server-rendered card PNG by URL, reusing the Satori
route.** An AR renderer (WebXR quad, marker overlay, `<model-viewer>` texture) can load a card as a
plain image URL — no client-side card drawing needed. This collapses the "card object" for AR to a
single portrait-oriented variant of the endpoint we already ship.

- [ ] Add a **portrait card image route** (card-shaped ~3:4, not the 1200×630 OG landscape) —
  `app/u/[handle]/card/ar-image.tsx` (or a `?variant=portrait` on the OG route). Same
  `getCardData(handle)` gate, same Satori JSX, re-laid-out to card proportions. This is the single
  AR texture source both levels consume.
- [ ] (Optional, later) unify the three existing renders behind one description → renderers. Out of
  scope for AR v1; noted so we don't quietly grow a 5th path.

Why not a client canvas texture: the Satori route is already privacy-correct, cache-friendly, and
identical for L1 (your own card) and L2 (someone else's) — one URL, `/u/<handle>/card/ar-image`.

---

## Privacy (constraint)

- The L2 marker carries **only** an identity (handle or signed short id) — **never card data, never
  PII, never location.** Everything visual is fetched through `getCardData`, which already returns
  `null` for private/missing profiles. A private card therefore cannot be resolved or rendered.
- A must **opt in** to "show mode" (an explicit action that displays the marker). Showing the marker
  exposes exactly what `/u/<handle>/card` already exposes publicly — nothing more.
- Prefer a **rotatable/revocable short id** over a raw handle in the marker, so "show mode" can be
  turned off without changing the public handle. (v1 may ship raw-handle; note the upgrade path.)

---

## Analytics (deliverable #5) — extend the existing beacon

Extend `POST /api/ar-open` (currently a bare 204 log line) to accept a tiny JSON body — no PII:

- [ ] `{ level: 'immersive' | 'l1-surface' | 'l2-marker', platform: 'android'|'ios'|'other',
  locked?: boolean, ms?: number }` — which level, which platform, did tracking lock, session length.
- [ ] Keep it fire-and-forget (`sendBeacon`), `force-dynamic`, no storage beyond the log line in v1.
  This is how we learn whether L2 tracking actually locks in the field before investing further.

---

## Platform capability matrix (deliverable #1)

| | **L1 — Place my card** | **L2 — Card over the phone** |
| --- | --- | --- |
| **Android Chrome** | ✅ **Web now.** WebXR `immersive-ar` + hit-test via `<model-viewer>` (GLB). Mature since Chrome 81. | ⚠️ **Web, gated on optics spike.** `getUserMedia` + OpenCV.js ArUco + `solvePnP` + Three.js. No WebXR needed. |
| **iOS Safari** | ✅ **Web now.** AR Quick Look; `<model-viewer>` auto-generates the USDZ client-side (no per-user asset). Horizontal placement reliable, **wall not**. | ⚠️ **Web, same OSS CV stack.** `getUserMedia` + WASM CV works on iOS since 11 (no WebXR). Same optics gate. Extra: non-persistent camera perms, randomized `deviceId`, COOP/COEP for WASM threads, thermal throttling. |
| **Native app** | Not needed. | Fallback only if OSS optics fail: ARKit/ARCore image tracking, or 8th Wall web-SLAM (~$700/mo). Deferred. |
| **Asset pipeline** | **One static GLB + the existing card PNG.** No per-user assets. | **Marker** = generated ArUco (dictionary ID ↔ handle). **Card** = existing card PNG as a Three.js texture. **No card data in the marker.** |

**Web-shippable today:** L1 fully, both platforms. L2 is web-capable but **pending the device optics GO/NO-GO** (Phase B0).

---

## Recommended stack per level (deliverable #2)

### L1 — `<model-viewer>` (wraps Three.js)
One approach covers both platforms. Ship **one generic unlit textured-quad GLB** (`public/ar/card-quad.glb`, card-proportioned, sized in real metres); at runtime `createTexture(cardPngUrl)` and swap `materials[0].pbrMetallicRoughness.baseColorTexture`. model-viewer routes to WebXR/Scene Viewer on Android and to auto-generated-USDZ AR Quick Look on iOS — and the runtime texture swap **does** carry into iOS Quick Look precisely because the USDZ is auto-generated (not a static `ios-src`). **Fallback:** the existing fullscreen immersive card when `canActivateAR` is false. New dep: `@google/model-viewer` (+ `three` transitively).

### L2 — OpenCV.js + `solvePnP` + Three.js (the OSS, cross-platform, no-WebXR path)
- **Tracker:** OpenCV.js **ArUco/AprilTag** detection (`objdetect` — the stock `opencv.js` may omit it, so budget for a **custom Emscripten build with `objdetect` enabled**), pose via **`solvePnP` (`IPPE_SQUARE` + sub-pixel corner refinement)**, then a **One-Euro (or Kalman) temporal filter** — every OSS option jitters raw; filtering is mandatory, not optional.
- **Marker = identity.** Encode the dancer in the **ArUco dictionary ID** (≤1024+ per dictionary; use a board or an ArUco+QR composite if the id space must be larger/arbitrary). If composite, decode the QR **once** with `zxing-wasm`/`jsQR` for identity, then track the fiducial for pose. **Never** put the native Barcode Detection API on the critical path — iOS lacks it.
- **Renderer:** Three.js perspective camera fed the `rvec`/`tvec` + intrinsics; the card plane is textured from `/u/<handle>/card/ar-image`.
- **Capture:** `getUserMedia({ facingMode: 'environment' })`, `playsinline`, process a **downscaled 640×480** frame while displaying full-res.
- **Our unique advantage:** *we* render A's marker, so we control its exact on-screen physical size and contrast — the single biggest lever on detection quality.

> **★ Make-or-break risk (L2).** The marker lives on a **glossy, emissive phone screen**, read by another phone's camera **across a table**. That stacks specular glare, screen-vs-sensor **moiré**, and auto-exposure **blooming** at exactly the small angular size where fiducial corner-noise is worst. Screen-displayed markers are *documented* to be less reliable than printed ones, and **no library choice fixes optics.** If fiducials don't hold detection off a screen on the target hardware, **L2 does not exist.** This is why Phase B0 gates the entire L2 track.

---

## Phased plan (deliverable #3)

Two tracks after a shared foundation. **L1 (Track A) is low-risk — ship it first for the visible win.** **L2 (Track B) is gated on a 1-day optics spike (B0) that must pass before any L2 product work.** Every camera/AR behavior is ⚠️DEVICE — unverifiable from this repo's build/CI (no camera, no WebXR, no second phone); those steps need a real ARCore Android + a real iPhone.

### Phase 0 (shared foundation) — portrait card-texture endpoint · no device, fully verifiable
The one AR texture source both levels consume. Reuses `getCardData` + the Satori pattern.

- [ ] **Create** `app/u/[handle]/card/ar-image.tsx` — a card-proportioned (~3:4) `ImageResponse`, same `getCardData(handle)` privacy gate as `opengraph-image.tsx`, `export const dynamic = 'force-dynamic'`.
- [ ] **Verify:** `GET /u/wilk/card/ar-image` returns a PNG (check `content-type`); a private/unknown handle returns the fallback image, not card data. This is a normal server route — verifiable in the browser pane with `read_network_requests`.

### Track A — L1 "Place my card" (low risk)

**Phase A1 — model-viewer placement**
- [ ] **Add dep** `@google/model-viewer`; **add** `public/ar/card-quad.glb` (unit unlit textured quad, card ratio, metric scale).
- [ ] **Add** a "Place in your space" control to `DancerCard` (feature-detect via model-viewer's `canActivateAR`); it mounts `<model-viewer ar ar-modes="webxr scene-viewer quick-look">` with the GLB and swaps the texture to `/u/<handle>/card/ar-image`.
- [ ] **Fallback:** when AR is unsupported, the button opens the existing fullscreen immersive card instead.
- [ ] ⚠️DEVICE: real-world scale, walk-around anchoring stability, iOS Quick Look texture/orientation fidelity, iOS wall-placement (expected unreliable → horizontal is the supported UX). Verify on 1 Android + 1 iPhone.

### Track B — L2 "Card over the phone" (gated)

**Phase B0 — optics viability spike ⚠️DEVICE GATE · throwaway, ~1 day**
Do **not** build the product. Build one static HTTPS page.
- [ ] **Create** a standalone spike page (`public/ar-spike/index.html` or a `/ar-spike` route): rear-camera `getUserMedia`, OpenCV.js ArUco detect → `solvePnP` (IPPE_SQUARE, sub-pixel), Three.js axes/cube overlay, and a HUD showing **detection-rate %** and **jitter** = running std-dev of `tz` and rotation. No card art yet.
- [ ] **Run the real hard case:** phone B points at phone A displaying a **full-screen ArUco** (large, brightness maxed); sweep distance, tilt, glare — on **1 iPhone (Safari) + 1 Android (Chrome)**.
- [ ] **GO/NO-GO decision.** GO → proceed to B1/B2. NO-GO → stop OSS L2; evaluate the 8th Wall paid fallback or a native path (both out of the web-first scope). *A desktop webcam + a printed marker will look far better than reality — do not trust it as a substitute.*

**Phase B1 — "Show mode" (marker generation) · no device, verifiable**
- [ ] **Identity:** a rotatable/revocable **signed short id ↔ handle** mapping (so "show mode" can be revoked without touching the public handle). v1 may map id→handle directly; note the rotation upgrade path.
- [ ] **A's card "Show mode":** an explicit opt-in that renders a full-screen **ArUco for that id** at max brightness with a generous quiet zone (generate via OpenCV.js `drawMarker`, or a precomputed PNG set).
- [ ] **Verify:** the marker renders; decoding it (spike page or a unit test on the id codec) round-trips back to the correct handle. `getCardData` remains the resolver — private cards resolve to nothing.

**Phase B2 — "Scan mode" (the tracker) ⚠️DEVICE · only after B0 = GO**
- [ ] **B's "Scan a card":** the Phase-B0 pipeline productionized — `getUserMedia` + OpenCV.js ArUco + `solvePnP` + One-Euro filter, rendering the card plane (texture = `/u/<handle>/card/ar-image` for the resolved handle) at the tracked pose via Three.js.
- [ ] **Infra:** add COOP/COEP headers (scoped to the scan route in `next.config`) so WASM threads/SIMD engage; guard against breaking other embeds.
- [ ] **Defensive:** camera-denied / no-detection / unresolvable-id all degrade to a clear message (and, where sensible, the fullscreen immersive card).
- [ ] ⚠️DEVICE: glare/moiré/exposure off a real screen, detection range + max viewing angle, filtered "looks-placed" quality, iOS camera ceiling + thermal throttle, and the two-device A-shows/B-scans choreography end-to-end.

### Phase C — analytics (deliverable #5) · alongside
- [ ] Extend `POST /api/ar-open` to accept `{ level: 'immersive'|'l1-surface'|'l2-marker', platform, locked?, ms? }` (no PII, still `sendBeacon` fire-and-forget). This is how we learn whether L2 tracking actually locks in the field.

---

## Dependency & infra footprint (new)

| Dep / infra | Track | Note |
| --- | --- | --- |
| `@google/model-viewer` (+`three`) | A (L1) | One component, both platforms. |
| `three` | B (L2) | Renders the card at the tracked pose. |
| OpenCV.js **custom `objdetect` build** | B (L2) | Stock build may omit ArUco (moved into `objdetect` in 4.7). |
| `zxing-wasm` (or `jsQR`) | B (L2) | Only if the marker is an ArUco+QR composite (arbitrary id payload). |
| COOP/COEP headers | B (L2) | Cross-origin isolation for WASM threads; scope to the scan route. |
| `qrcode` | — | Already present (encode); not a fiducial generator — ArUco marker gen is separate. |

## Recommended execution order

1. **Phase 0** (card texture) — safe, shippable, unblocks both tracks.
2. **Phase B0** (L2 optics spike) — run **early and in parallel**; it's the gate, and a NO-GO reshapes the whole L2 track before any product code exists.
3. **Track A** (L1) — low risk, high polish payoff; ship after Phase 0.
4. **Track B** B1 → B2 — only after B0 = GO.
5. **Phase C** analytics — alongside, once any AR path ships.
