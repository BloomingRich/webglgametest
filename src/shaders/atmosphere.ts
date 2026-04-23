export const atmosphereVertexShader = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const atmosphereFragmentShader = /* glsl */ `
uniform vec3 viewPosition;
uniform vec3 sunDirection;
uniform vec3 atmosphereColor;
uniform float intensity;

varying vec3 vWorldNormal;
varying vec3 vWorldPosition;

void main() {
  vec3 V = normalize(viewPosition - vWorldPosition);
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(sunDirection);

  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.2);
  float sunScatter = pow(max(dot(N, L), 0.0), 1.5);
  float glow = fresnel * (0.45 + 0.55 * sunScatter) * intensity;

  gl_FragColor = vec4(atmosphereColor * glow, glow * 0.95);
}
`;
