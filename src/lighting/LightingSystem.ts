import * as THREE from 'three';

export class LightingSystem {
  configure(scene: THREE.Scene): void {
    scene.environment = this.createProceduralHdrProxy();

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(6, 9, 2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight(0xb9d3ff, 0x1f2632, 0.42);
    scene.add(fillLight);
  }

  private createProceduralHdrProxy(): THREE.Texture {
    const data = new Float32Array([
      1.2, 1.3, 1.5, 1,
      0.8, 0.9, 1.2, 1,
      0.4, 0.45, 0.6, 1,
      0.1, 0.12, 0.2, 1
    ]);
    const texture = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    texture.colorSpace = THREE.LinearSRGBColorSpace;
    return texture;
  }
}
