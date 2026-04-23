import * as THREE from 'three';
import { WebGLRenderer } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import type { QualityState } from '../quality/QualityScaler';

export type RendererBackend = 'webgpu' | 'webgl2';

export class RendererCore {
  readonly renderer: THREE.Renderer;
  readonly backend: RendererBackend;

  constructor(private readonly container: HTMLElement) {
    const webgpuSupported = typeof navigator !== 'undefined' && 'gpu' in navigator;

    if (webgpuSupported) {
      this.renderer = new WebGPURenderer({ antialias: true });
      this.backend = 'webgpu';
    } else {
      this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      this.backend = 'webgl2';
    }

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    if ('shadowMap' in this.renderer) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    if ('useLegacyLights' in this.renderer) {
      this.renderer.useLegacyLights = false;
    }

    container.appendChild(this.renderer.domElement);
    this.resize();
  }

  resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.renderer.setSize(width, height, false);
  }

  applyQuality(state: QualityState): void {
    const width = Math.max(1, Math.floor(this.container.clientWidth * state.renderScale));
    const height = Math.max(1, Math.floor(this.container.clientHeight * state.renderScale));
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }
}
