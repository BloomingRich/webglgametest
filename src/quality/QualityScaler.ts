import type { QualityPreset } from '../config/presets';

export type QualityState = {
  renderScale: number;
  interaction: boolean;
  accumulationActive: boolean;
  accumulationSamples: number;
  rayBudget: number;
};

export class QualityScaler {
  private readonly targetFrameMs = 1000 / 60;
  private readonly slowFrameToleranceMs = 2.5;
  private readonly qualityStep = 0.035;

  private state: QualityState;

  constructor(private readonly preset: QualityPreset) {
    this.state = {
      renderScale: preset.baseRenderScale,
      interaction: true,
      accumulationActive: false,
      accumulationSamples: 0,
      rayBudget: 0
    };
  }

  beginInteraction(): QualityState {
    this.state.interaction = true;
    this.state.accumulationActive = false;
    this.state.accumulationSamples = 0;
    this.state.rayBudget = 0;
    this.state.renderScale = Math.max(
      this.preset.minRenderScale,
      this.state.renderScale - this.qualityStep
    );
    return { ...this.state };
  }

  endInteraction(): QualityState {
    this.state.interaction = false;
    this.state.accumulationActive = true;
    this.state.rayBudget = this.preset.idleRayBudget;
    return { ...this.state };
  }

  onFrame(frameMs: number): QualityState {
    if (this.state.interaction) {
      if (frameMs > this.targetFrameMs + this.slowFrameToleranceMs) {
        this.state.renderScale = Math.max(
          this.preset.minRenderScale,
          this.state.renderScale - this.qualityStep
        );
      } else {
        this.state.renderScale = Math.min(
          this.preset.baseRenderScale,
          this.state.renderScale + this.qualityStep * 0.4
        );
      }
      return { ...this.state };
    }

    if (this.state.accumulationActive) {
      this.state.renderScale = Math.min(
        this.preset.maxRenderScale,
        this.state.renderScale + this.qualityStep * 0.3
      );
      this.state.accumulationSamples = Math.min(
        this.preset.maxAccumulationSamples,
        this.state.accumulationSamples + 1
      );
      this.state.rayBudget = this.preset.idleRayBudget;
    }

    return { ...this.state };
  }

  invalidateAccumulation(): QualityState {
    this.state.accumulationSamples = 0;
    this.state.accumulationActive = !this.state.interaction;
    return { ...this.state };
  }

  getState(): QualityState {
    return { ...this.state };
  }
}
