# Hybrid Photoreal Browser 3D Experience (WebGPU + WebGL2)

This project provides a production-oriented architecture for a premium browser-based 3D experience with:

- **WebGPU primary path** with **WebGL2 fallback**.
- **Hybrid renderer model**:
  - interaction mode: stable real-time rasterized PBR
  - idle mode: progressive quality refinement with ray/path-traced feature hooks
- **Responsiveness-first quality scaling**, dynamic internal resolution, and graceful degradation.

## Architecture

- `src/renderer/RendererCore.ts` — renderer backend selection, tone mapping, color management, dynamic internal resolution.
- `src/renderer/HybridRefinement.ts` — idle-mode accumulation and ray/path-traced refinement entry point.
- `src/assets/AssetPipeline.ts` — glTF/GLB + KTX2 ingestion, hero-only transmission guardrails.
- `src/lighting/LightingSystem.ts` — direct + environment baseline lighting.
- `src/quality/QualityScaler.ts` — frame-time reactive scaling, interaction/idle transitions, accumulation reset.
- `src/post/PostProcessingStack.ts` — bloom/DoF/denoise staging hooks.
- `src/interaction/InteractionController.ts` — input-state transitions to prioritize motion responsiveness.
- `src/config/presets.ts` — desktop high/medium, laptop balanced, mobile-safe presets.

## Render behavior

### During camera motion

- Lower internal render scale.
- Disable/limit accumulation and ray budget.
- Keep rasterized PBR and baseline lighting active.

### When camera stops

- Enable progressive accumulation.
- Increase internal quality toward preset caps.
- Enable premium reflection/refraction/GI refinement hooks.
- Apply denoiser hooks as accumulation increases.

## Asset pipeline expectations

- Prefer GLB/glTF 2.0 with packed ORM textures.
- Require KTX2 compressed textures:
  - UASTC for hero textures/normal maps
  - ETC1S for non-critical textures
- Require LOD chains for major assets.
- Reserve costly transmission/clear materials for hero assets.

## Running

```bash
npm install
npm run dev
```

