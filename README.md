# Earth Planet Viewer — Hybrid WebGPU/WebGL2

This project now renders a photoreal Earth viewer with realistic day/night lighting, detailed surface maps, moving cloud layer, and atmospheric glow.

## Key capabilities

- **WebGPU primary renderer** with automatic **WebGL2 fallback**.
- **Photoreal Earth shading**:
  - high-resolution albedo, normal, roughness/specular, and city-night emissive textures
  - physically based material via `MeshPhysicalMaterial`
  - animated cloud shell with transparency
  - custom atmosphere Fresnel + sun scattering glow shader
- **Lighting setup**:
  - physically plausible directional sunlight
  - subtle hemisphere fill for planet-side readability
  - ACES filmic tone mapping and proper color management
- **Hybrid quality system**:
  - interaction mode prioritizes framerate and responsiveness
  - idle mode increases quality and accumulation budget progressively

## Runtime architecture

- `src/ExperienceApp.ts` — app composition, loop, camera controls, quality flow, HUD.
- `src/scene/EarthScene.ts` — earth assets/materials/lights/clouds/atmosphere.
- `src/shaders/atmosphere.ts` — atmosphere shader pair.
- `src/renderer/RendererCore.ts` — backend selection + renderer configuration.
- `src/quality/QualityScaler.ts` / `src/interaction/InteractionController.ts` — responsiveness-first scaling transitions.

## Run

```bash
npm install
npm run dev
```

> Note: Earth texture sources are loaded from `threejs.org/examples/textures/planets` at runtime.
