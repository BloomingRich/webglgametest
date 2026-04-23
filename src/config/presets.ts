export type QualityPresetName =
  | 'desktop-high'
  | 'desktop-medium'
  | 'laptop-balanced'
  | 'mobile-safe';

export type QualityPreset = {
  name: QualityPresetName;
  baseRenderScale: number;
  minRenderScale: number;
  maxRenderScale: number;
  rasterShadowResolution: 1024 | 2048 | 4096;
  ssaoQuality: 'off' | 'low' | 'medium' | 'high';
  bloomQuality: 'off' | 'low' | 'medium' | 'high';
  dofQuality: 'off' | 'low' | 'medium' | 'high';
  idleRayBudget: number;
  maxAccumulationSamples: number;
  denoiser: 'none' | 'temporal' | 'atr-trt-lite';
  transmissiveHeroOnly: boolean;
};

export const PRESETS: Record<QualityPresetName, QualityPreset> = {
  'desktop-high': {
    name: 'desktop-high',
    baseRenderScale: 1,
    minRenderScale: 0.72,
    maxRenderScale: 1,
    rasterShadowResolution: 4096,
    ssaoQuality: 'high',
    bloomQuality: 'high',
    dofQuality: 'high',
    idleRayBudget: 6,
    maxAccumulationSamples: 128,
    denoiser: 'atr-trt-lite',
    transmissiveHeroOnly: true
  },
  'desktop-medium': {
    name: 'desktop-medium',
    baseRenderScale: 0.9,
    minRenderScale: 0.66,
    maxRenderScale: 1,
    rasterShadowResolution: 2048,
    ssaoQuality: 'medium',
    bloomQuality: 'medium',
    dofQuality: 'medium',
    idleRayBudget: 3,
    maxAccumulationSamples: 48,
    denoiser: 'temporal',
    transmissiveHeroOnly: true
  },
  'laptop-balanced': {
    name: 'laptop-balanced',
    baseRenderScale: 0.82,
    minRenderScale: 0.58,
    maxRenderScale: 0.9,
    rasterShadowResolution: 1024,
    ssaoQuality: 'low',
    bloomQuality: 'low',
    dofQuality: 'low',
    idleRayBudget: 1,
    maxAccumulationSamples: 16,
    denoiser: 'temporal',
    transmissiveHeroOnly: true
  },
  'mobile-safe': {
    name: 'mobile-safe',
    baseRenderScale: 0.64,
    minRenderScale: 0.5,
    maxRenderScale: 0.75,
    rasterShadowResolution: 1024,
    ssaoQuality: 'off',
    bloomQuality: 'low',
    dofQuality: 'off',
    idleRayBudget: 0,
    maxAccumulationSamples: 1,
    denoiser: 'none',
    transmissiveHeroOnly: true
  }
};
