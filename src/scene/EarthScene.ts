import * as THREE from 'three';
import { atmosphereFragmentShader, atmosphereVertexShader } from '../shaders/atmosphere';

const EARTH_TEXTURE_BASE = 'https://threejs.org/examples/textures/planets';

export class EarthScene {
  private readonly earthGroup = new THREE.Group();
  private earthMesh?: THREE.Mesh;
  private cloudMesh?: THREE.Mesh;
  private atmosphereMesh?: THREE.Mesh;
  private sunLight?: THREE.DirectionalLight;

  async build(scene: THREE.Scene, camera: THREE.PerspectiveCamera): Promise<void> {
    const loader = new THREE.TextureLoader();

    const [albedoMap, normalMap, roughnessMap, emissiveMap, cloudMap] = await Promise.all([
      loader.loadAsync(`${EARTH_TEXTURE_BASE}/earth_atmos_2048.jpg`),
      loader.loadAsync(`${EARTH_TEXTURE_BASE}/earth_normal_2048.jpg`),
      loader.loadAsync(`${EARTH_TEXTURE_BASE}/earth_specular_2048.jpg`),
      loader.loadAsync(`${EARTH_TEXTURE_BASE}/earth_lights_2048.png`),
      loader.loadAsync(`${EARTH_TEXTURE_BASE}/earth_clouds_1024.png`)
    ]);

    [albedoMap, normalMap, roughnessMap, emissiveMap, cloudMap].forEach((texture) => {
      texture.colorSpace = texture === normalMap || texture === roughnessMap ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      texture.anisotropy = 16;
      texture.generateMipmaps = true;
    });

    const earthMaterial = new THREE.MeshPhysicalMaterial({
      map: albedoMap,
      normalMap,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap,
      roughness: 0.95,
      metalness: 0.0,
      emissiveMap,
      emissive: new THREE.Color('#fff2ca'),
      emissiveIntensity: 1.2,
      clearcoat: 0.03,
      clearcoatRoughness: 0.3
    });

    this.earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 256, 256), earthMaterial);
    this.earthMesh.castShadow = true;
    this.earthMesh.receiveShadow = true;

    const cloudMaterial = new THREE.MeshPhysicalMaterial({
      map: cloudMap,
      transparent: true,
      opacity: 0.42,
      alphaMap: cloudMap,
      blending: THREE.NormalBlending,
      depthWrite: false,
      roughness: 1,
      metalness: 0
    });

    this.cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(1.01, 192, 192), cloudMaterial);

    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: {
        viewPosition: { value: camera.position.clone() },
        sunDirection: { value: new THREE.Vector3(1, 0.2, 0.4).normalize() },
        atmosphereColor: { value: new THREE.Color('#7ec8ff') },
        intensity: { value: 1.15 }
      }
    });

    this.atmosphereMesh = new THREE.Mesh(new THREE.SphereGeometry(1.07, 192, 192), atmosphereMaterial);

    this.sunLight = new THREE.DirectionalLight('#fff8df', 4.5);
    this.sunLight.position.set(8, 2, 3);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(4096, 4096);

    const ambientFill = new THREE.HemisphereLight('#93b7ff', '#04060d', 0.2);

    this.earthGroup.add(this.earthMesh, this.cloudMesh, this.atmosphereMesh);
    scene.add(this.sunLight, ambientFill, this.earthGroup);

    const starField = new THREE.Mesh(
      new THREE.SphereGeometry(90, 64, 64),
      new THREE.MeshBasicMaterial({ color: '#02030a', side: THREE.BackSide })
    );
    scene.add(starField);
  }

  update(deltaSeconds: number, camera: THREE.PerspectiveCamera): void {
    if (this.earthMesh) {
      this.earthMesh.rotation.y += deltaSeconds * 0.05;
    }

    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += deltaSeconds * 0.07;
    }

    const atmosphereMaterial = this.atmosphereMesh?.material;
    if (atmosphereMaterial instanceof THREE.ShaderMaterial) {
      atmosphereMaterial.uniforms.viewPosition.value.copy(camera.position);
    }
  }
}
