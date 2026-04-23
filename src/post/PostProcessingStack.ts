import type { QualityState } from '../quality/QualityScaler';

export class PostProcessingStack {
  private dofEnabled = false;

  setDofEnabled(enabled: boolean): void {
    this.dofEnabled = enabled;
  }

  updateForQuality(quality: QualityState): void {
    if (quality.interaction) {
      // Reduce expensive secondary effects during interaction.
      return;
    }

    if (this.dofEnabled && quality.accumulationSamples > 6) {
      // Placeholder for scalable DoF pass activation.
    }

    if (quality.accumulationSamples > 2) {
      // Placeholder: temporal bloom and denoise refinement.
    }
  }
}
