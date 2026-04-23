import type { QualityState } from '../quality/QualityScaler';

export class HybridRefinement {
  private accumulation = 0;

  reset(): void {
    this.accumulation = 0;
  }

  tick(state: QualityState): void {
    if (state.interaction) {
      this.accumulation = 0;
      return;
    }

    this.accumulation = state.accumulationSamples;

    if (state.rayBudget > 0) {
      // Placeholder for progressive ray/path-traced effects in idle quality mode:
      // reflections, refractions, soft shadows, and indirect light probes.
      // Add denoiser pass after each accumulation increment.
    }
  }
}
