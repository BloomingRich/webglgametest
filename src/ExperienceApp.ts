import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PRESETS, type QualityPresetName } from './config/presets';
import { InteractionController } from './interaction/InteractionController';
import { PostProcessingStack } from './post/PostProcessingStack';
import { QualityScaler } from './quality/QualityScaler';
import { HybridRefinement } from './renderer/HybridRefinement';
import { RendererCore } from './renderer/RendererCore';
import { EarthScene } from './scene/EarthScene';

export class ExperienceApp {
  private readonly rendererCore: RendererCore;
  private readonly qualityScaler: QualityScaler;
  private readonly post: PostProcessingStack;
  private readonly interactionController: InteractionController;
  private readonly refinement: HybridRefinement;
  private readonly earthScene = new EarthScene();
  private readonly clock = new THREE.Clock();

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.01, 300);
  private readonly controls: OrbitControls;

  constructor(private readonly host: HTMLElement, presetName: QualityPresetName = 'desktop-high') {
    this.rendererCore = new RendererCore(host);
    this.qualityScaler = new QualityScaler(PRESETS[presetName]);
    this.post = new PostProcessingStack();
    this.refinement = new HybridRefinement();

    this.camera.position.set(2.6, 1.1, 2.2);
    this.controls = new OrbitControls(this.camera, this.rendererCore.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 10;
    this.controls.maxPolarAngle = Math.PI * 0.95;

    const interactionStart = () => {
      this.qualityScaler.beginInteraction();
      this.refinement.reset();
    };

    const interactionEnd = () => {
      this.qualityScaler.endInteraction();
      this.qualityScaler.invalidateAccumulation();
    };

    this.interactionController = new InteractionController(interactionStart, interactionEnd);
    this.interactionController.attach(window);

    this.scene.background = new THREE.Color('#000000');

    this.mountHud();
    this.loadScene().catch(console.error);

    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  start(): void {
    this.rendererCore.renderer.setAnimationLoop(() => this.frame());
  }

  private async loadScene(): Promise<void> {
    await this.earthScene.build(this.scene, this.camera);
  }

  private frame(): void {
    const deltaSeconds = this.clock.getDelta();
    const deltaMs = deltaSeconds * 1000;
    this.controls.update();

    const quality = this.qualityScaler.onFrame(deltaMs);
    this.rendererCore.applyQuality(quality);
    this.post.updateForQuality(quality);
    this.refinement.tick(quality);
    this.earthScene.update(deltaSeconds, this.camera);

    this.rendererCore.render(this.scene, this.camera);
    this.updateHud(quality, deltaMs);
  }

  private onResize = (): void => {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.rendererCore.resize();
  };

  private mountHud(): void {
    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.id = 'hud';
    hud.innerHTML = 'Loading Earth...';
    this.host.appendChild(hud);
  }

  private updateHud(
    quality: {
      interaction: boolean;
      renderScale: number;
      accumulationSamples: number;
      rayBudget: number;
    },
    frameMs: number
  ): void {
    const hud = document.getElementById('hud');
    if (!hud) {
      return;
    }

    hud.innerHTML = [
      `Backend: ${this.rendererCore.backend}`,
      `Mode: ${quality.interaction ? 'Interaction / Raster' : 'Idle / Progressive'}`,
      `Render scale: ${quality.renderScale.toFixed(2)}`,
      `Accumulation: ${quality.accumulationSamples}`,
      `Ray budget: ${quality.rayBudget}`,
      `Frame: ${frameMs.toFixed(1)}ms`
    ].join('<br/>');
  }
}
