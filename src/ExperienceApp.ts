import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AssetPipeline } from './assets/AssetPipeline';
import { PRESETS, type QualityPresetName } from './config/presets';
import { InteractionController } from './interaction/InteractionController';
import { LightingSystem } from './lighting/LightingSystem';
import { PostProcessingStack } from './post/PostProcessingStack';
import { QualityScaler } from './quality/QualityScaler';
import { HybridRefinement } from './renderer/HybridRefinement';
import { RendererCore } from './renderer/RendererCore';

export class ExperienceApp {
  private readonly rendererCore: RendererCore;
  private readonly qualityScaler: QualityScaler;
  private readonly post: PostProcessingStack;
  private readonly interactionController: InteractionController;
  private readonly assetPipeline: AssetPipeline;
  private readonly refinement: HybridRefinement;
  private readonly clock = new THREE.Clock();

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 600);
  private readonly controls: OrbitControls;

  constructor(private readonly host: HTMLElement, presetName: QualityPresetName = 'desktop-high') {
    this.rendererCore = new RendererCore(host);
    this.qualityScaler = new QualityScaler(PRESETS[presetName]);
    this.post = new PostProcessingStack();
    this.refinement = new HybridRefinement();

    this.assetPipeline = new AssetPipeline(this.rendererCore.renderer);

    this.camera.position.set(2.2, 1.4, 3.1);
    this.controls = new OrbitControls(this.camera, this.rendererCore.renderer.domElement);
    this.controls.enableDamping = true;

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

    new LightingSystem().configure(this.scene);
    this.scene.background = new THREE.Color('#11141a');

    this.mountHud();
    this.loadScene().catch(console.error);

    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  start(): void {
    this.rendererCore.renderer.setAnimationLoop(() => this.frame());
  }

  private async loadScene(): Promise<void> {
    // In production:
    // - use GLB with KTX2 textures (UASTC for hero assets, ETC1S for non-critical)
    // - enforce packed ORM textures and LOD chain availability
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: '#1e2126', roughness: 0.95, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Example production loading entry point:
    // const hero = await this.assetPipeline.loadGlb({ url: '/assets/hero.glb', isHeroAsset: true });
    // this.scene.add(hero);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 128, 128),
      new THREE.MeshPhysicalMaterial({
        color: '#f3f6ff',
        roughness: 0.12,
        metalness: 0.92,
        clearcoat: 0.65,
        clearcoatRoughness: 0.15,
        ior: 1.5,
        sheen: 0.05,
        sheenRoughness: 0.25
      })
    );
    sphere.position.set(0, 0.72, 0);
    sphere.castShadow = true;
    this.scene.add(sphere);
  }

  private frame(): void {
    const deltaMs = this.clock.getDelta() * 1000;
    this.controls.update();

    const quality = this.qualityScaler.onFrame(deltaMs);
    this.rendererCore.applyQuality(quality);
    this.post.updateForQuality(quality);
    this.refinement.tick(quality);

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
    hud.innerHTML = 'Initializing...';
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
