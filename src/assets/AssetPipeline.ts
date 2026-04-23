import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

export type AssetLoadOptions = {
  url: string;
  isHeroAsset?: boolean;
};

export class AssetPipeline {
  private readonly gltfLoader: GLTFLoader;
  private readonly ktx2Loader: KTX2Loader;

  constructor(renderer: THREE.Renderer) {
    this.gltfLoader = new GLTFLoader();
    this.ktx2Loader = new KTX2Loader();
    this.ktx2Loader.setTranscoderPath('/basis/');
    this.ktx2Loader.detectSupport(renderer);

    this.gltfLoader.setKTX2Loader(this.ktx2Loader);
  }

  async loadGlb({ url, isHeroAsset = false }: AssetLoadOptions): Promise<THREE.Object3D> {
    const gltf = await this.gltfLoader.loadAsync(url);
    gltf.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) {
        return;
      }

      node.castShadow = true;
      node.receiveShadow = true;

      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        if (!(material instanceof THREE.MeshPhysicalMaterial)) {
          return;
        }

        // Keep expensive transmissive shading for hero assets only.
        if (!isHeroAsset && material.transmission > 0) {
          material.transmission = 0;
        }

        material.roughness = Math.min(1, Math.max(0, material.roughness));
        material.metalness = Math.min(1, Math.max(0, material.metalness));
      });
    });

    return gltf.scene;
  }
}
