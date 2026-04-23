import * as THREE from 'three';
import { atmosphereFragmentShader, atmosphereVertexShader } from '../shaders/atmosphere';

const EARTH_TEXTURE_BASE = 'https://threejs.org/examples/textures/planets';

export class EarthScene {
  private readonly earthGroup = new (THREE as any).Group();
  private earthMesh?: any;
  private cloudMesh?: any;
  private atmosphereMesh?: any;

  async build(scene: any, camera: any): Promise<void> {
    const loader = new (THREE as any).TextureLoader();

    const [albedoMap, normalMap, roughnessMap, emissiveMap, cloudMap] = await Promise.all([
      loader.loadAsync(`${EARTH_TEXTURE_BASE}/earth_atmos_2048.jpg`),
      loader.loadAsync(`${EARTH_TEXTURE_BASE}/earth_normal_2048.jpg`),
      loader.loadAsync(`${EARTH_TEXTURE_BASE}/earth_specular_2048.jpg`),
      loader.loadAsync(`${EARTH_TEXTURE_BASE}/earth_lights_2048.png`),
      loader.loadAsync(`${EARTH_TEXTURE_BASE}/earth_clouds_1024.png`)
    ]);

    [albedoMap, normalMap, roughnessMap, emissiveMap, cloudMap].forEach((texture) => {
      texture.colorSpace = texture === normalMap || texture === roughnessMap ? (THREE as any).NoColorSpace : (THREE as any).SRGBColorSpace;
      texture.anisotropy = 16;
      texture.generateMipmaps = true;
    });

    const earthMaterial = new (THREE as any).MeshPhysicalMaterial({
      map: albedoMap,
      normalMap,
      normalScale: new (THREE as any).Vector2(0.9, 0.9),
      roughnessMap,
      roughness: 0.95,
      metalness: 0.0,
      emissiveMap,
      emissive: new (THREE as any).Color('#fff2ca'),
      emissiveIntensity: 1.2,
      clearcoat: 0.03,
      clearcoatRoughness: 0.3
    });

    this.earthMesh = new (THREE as any).Mesh(new (THREE as any).SphereGeometry(1, 256, 256), earthMaterial);
    this.earthMesh.castShadow = true;
    this.earthMesh.receiveShadow = true;

    const cloudMaterial = new (THREE as any).MeshPhysicalMaterial({
      map: cloudMap,
      transparent: true,
      opacity: 0.42,
      alphaMap: cloudMap,
      blending: (THREE as any).NormalBlending,
      depthWrite: false,
      roughness: 1,
      metalness: 0
    });

    this.cloudMesh = new (THREE as any).Mesh(new (THREE as any).SphereGeometry(1.01, 192, 192), cloudMaterial);

    const atmosphereMaterial = new (THREE as any).ShaderMaterial({
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      transparent: true,
      depthWrite: false,
      side: (THREE as any).BackSide,
      uniforms: {
        viewPosition: { value: camera.position.clone() },
        sunDirection: { value: new (THREE as any).Vector3(1, 0.2, 0.4).normalize() },
        atmosphereColor: { value: new (THREE as any).Color('#7ec8ff') },
        intensity: { value: 1.15 }
      }
    });

    this.atmosphereMesh = new (THREE as any).Mesh(new (THREE as any).SphereGeometry(1.07, 192, 192), atmosphereMaterial);

    const sunLight = new (THREE as any).DirectionalLight('#fff8df', 4.5);
    sunLight.position.set(8, 2, 3);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(4096, 4096);

    const ambientFill = new (THREE as any).HemisphereLight('#93b7ff', '#04060d', 0.2);

    this.earthGroup.add(this.earthMesh, this.cloudMesh, this.atmosphereMesh);
    scene.add(sunLight, ambientFill, this.earthGroup);

    const starField = new (THREE as any).Mesh(
      new (THREE as any).SphereGeometry(90, 64, 64),
      new (THREE as any).MeshBasicMaterial({ color: '#02030a', side: (THREE as any).BackSide })
    );
    scene.add(starField);
  }

  update(deltaSeconds: number, camera: any): void {
    if (this.earthMesh) this.earthMesh.rotation.y += deltaSeconds * 0.05;
    if (this.cloudMesh) this.cloudMesh.rotation.y += deltaSeconds * 0.07;

    const atmosphereMaterial = this.atmosphereMesh?.material;
    if (atmosphereMaterial) atmosphereMaterial.uniforms.viewPosition.value.copy(camera.position);
  }
}
