const POINTER_LIMIT = 16;
const SIM_SCALE = 2;

const advectionWGSL = /* wgsl */ `
struct SimParams {
  resolution: vec2f,
  deltaTime: f32,
  dissipation: f32,
  texelSize: vec2f,
  radius: f32,
  force: f32,
  pointerCount: u32,
  pad0: u32,
  aspect: f32,
  pad1: vec3f,
};

struct Pointer {
  active: f32,
  kind: f32,
  position: vec2f,
  velocity: vec2f,
  color: vec3f,
  radius: f32,
  strength: f32,
};

@group(0) @binding(0) var velocityTex: texture_2d<f32>;
@group(0) @binding(1) var sourceTex: texture_2d<f32>;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var<uniform> params: SimParams;
@group(0) @binding(4) var<storage, read> pointers: array<Pointer, ${POINTER_LIMIT}>;

fn bilerp(tex: texture_2d<f32>, uv: vec2f) -> vec4f {
  let size = vec2f(textureDimensions(tex));
  let p = uv * size - 0.5;
  let i0 = floor(p);
  let f = fract(p);

  let a = textureLoad(tex, vec2i(clamp(i0, vec2f(0.0), size - 1.0)), 0);
  let b = textureLoad(tex, vec2i(clamp(i0 + vec2f(1.0, 0.0), vec2f(0.0), size - 1.0)), 0);
  let c = textureLoad(tex, vec2i(clamp(i0 + vec2f(0.0, 1.0), vec2f(0.0), size - 1.0)), 0);
  let d = textureLoad(tex, vec2i(clamp(i0 + vec2f(1.0, 1.0), vec2f(0.0), size - 1.0)), 0);

  let ab = mix(a, b, f.x);
  let cd = mix(c, d, f.x);
  return mix(ab, cd, f.y);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = vec2u(textureDimensions(sourceTex));
  if (gid.x >= dims.x || gid.y >= dims.y) {
    return;
  }

  let cell = vec2f(gid.xy);
  let uv = (cell + 0.5) / params.resolution;
  let vel = textureLoad(velocityTex, vec2i(gid.xy), 0).xy;
  let backUv = clamp(uv - vel * params.deltaTime * params.texelSize * 0.7, vec2f(0.0), vec2f(1.0));

  var value = bilerp(sourceTex, backUv) * params.dissipation;

  for (var i: u32 = 0u; i < params.pointerCount; i++) {
    let p = pointers[i];
    if (p.active < 0.5) {
      continue;
    }

    let offset = uv - p.position;
    let adjusted = vec2f(offset.x * params.aspect, offset.y);
    let dist = length(adjusted);
    let influence = exp(-dist * dist / max(p.radius * p.radius, 0.0001));

    if (p.kind < 0.5) {
      value.xy += p.velocity * influence * p.strength * params.force;
    } else {
      value.rgb += p.color * influence * p.strength;
      value.a = 1.0;
    }
  }

  textureStore(dstTex, vec2i(gid.xy), value);
}
`;

const divergenceWGSL = /* wgsl */ `
struct SimParams {
  resolution: vec2f,
  deltaTime: f32,
  dissipation: f32,
  texelSize: vec2f,
  radius: f32,
  force: f32,
  pointerCount: u32,
  pad0: u32,
  aspect: f32,
  pad1: vec3f,
};

@group(0) @binding(0) var velocityTex: texture_2d<f32>;
@group(0) @binding(1) var divTex: texture_storage_2d<r16float, write>;
@group(0) @binding(2) var<uniform> params: SimParams;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = vec2u(textureDimensions(velocityTex));
  if (gid.x >= dims.x || gid.y >= dims.y) {
    return;
  }

  let coord = vec2i(gid.xy);
  let left = textureLoad(velocityTex, max(coord - vec2i(1, 0), vec2i(0)), 0).x;
  let right = textureLoad(velocityTex, min(coord + vec2i(1, 0), vec2i(dims) - vec2i(1)), 0).x;
  let down = textureLoad(velocityTex, max(coord - vec2i(0, 1), vec2i(0)), 0).y;
  let up = textureLoad(velocityTex, min(coord + vec2i(0, 1), vec2i(dims) - vec2i(1)), 0).y;

  let div = 0.5 * ((right - left) + (up - down));
  textureStore(divTex, coord, vec4f(div, 0.0, 0.0, 1.0));
}
`;

const jacobiWGSL = /* wgsl */ `
@group(0) @binding(0) var pressureTex: texture_2d<f32>;
@group(0) @binding(1) var divTex: texture_2d<f32>;
@group(0) @binding(2) var outTex: texture_storage_2d<r16float, write>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = vec2u(textureDimensions(pressureTex));
  if (gid.x >= dims.x || gid.y >= dims.y) {
    return;
  }

  let coord = vec2i(gid.xy);
  let left = textureLoad(pressureTex, max(coord - vec2i(1, 0), vec2i(0)), 0).x;
  let right = textureLoad(pressureTex, min(coord + vec2i(1, 0), vec2i(dims) - vec2i(1)), 0).x;
  let down = textureLoad(pressureTex, max(coord - vec2i(0, 1), vec2i(0)), 0).x;
  let up = textureLoad(pressureTex, min(coord + vec2i(0, 1), vec2i(dims) - vec2i(1)), 0).x;
  let div = textureLoad(divTex, coord, 0).x;

  let next = (left + right + down + up - div) * 0.25;
  textureStore(outTex, coord, vec4f(next, 0.0, 0.0, 1.0));
}
`;

const gradientWGSL = /* wgsl */ `
@group(0) @binding(0) var velocityTex: texture_2d<f32>;
@group(0) @binding(1) var pressureTex: texture_2d<f32>;
@group(0) @binding(2) var outTex: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = vec2u(textureDimensions(velocityTex));
  if (gid.x >= dims.x || gid.y >= dims.y) {
    return;
  }

  let coord = vec2i(gid.xy);
  let left = textureLoad(pressureTex, max(coord - vec2i(1, 0), vec2i(0)), 0).x;
  let right = textureLoad(pressureTex, min(coord + vec2i(1, 0), vec2i(dims) - vec2i(1)), 0).x;
  let down = textureLoad(pressureTex, max(coord - vec2i(0, 1), vec2i(0)), 0).x;
  let up = textureLoad(pressureTex, min(coord + vec2i(0, 1), vec2i(dims) - vec2i(1)), 0).x;

  let vel = textureLoad(velocityTex, coord, 0).xy;
  let corrected = vel - 0.5 * vec2f(right - left, up - down);
  textureStore(outTex, coord, vec4f(corrected, 0.0, 1.0));
}
`;

const renderWGSL = /* wgsl */ `
struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsMain(@builtin(vertex_index) i: u32) -> VSOut {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -3.0),
    vec2f(3.0, 1.0),
    vec2f(-1.0, 1.0)
  );

  var out: VSOut;
  let pos = positions[i];
  out.position = vec4f(pos, 0.0, 1.0);
  out.uv = 0.5 * (pos + vec2f(1.0));
  return out;
}

@group(0) @binding(0) var dyeTex: texture_2d<f32>;

fn heat(t: f32) -> vec3f {
  let x = clamp(t, 0.0, 1.0);
  let c0 = vec3f(0.02, 0.06, 0.16);
  let c1 = vec3f(0.1, 0.55, 0.95);
  let c2 = vec3f(0.85, 0.27, 0.9);
  let c3 = vec3f(0.98, 0.92, 0.24);

  if (x < 0.4) {
    return mix(c0, c1, x / 0.4);
  }
  if (x < 0.75) {
    return mix(c1, c2, (x - 0.4) / 0.35);
  }
  return mix(c2, c3, (x - 0.75) / 0.25);
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(dyeTex));
  let coord = vec2i(clamp(in.uv * dims, vec2f(0.0), dims - 1.0));
  let dye = textureLoad(dyeTex, coord, 0).rgb;
  let intensity = clamp(dot(dye, vec3f(0.299, 0.587, 0.114)), 0.0, 1.0);
  let mapped = heat(intensity);
  return vec4f(mapped + dye * 0.3, 1.0);
}
`;

class FluidTracker {
  constructor(canvas) {
    this.canvas = canvas;
    this.gpu = null;
    this.context = null;
    this.format = null;
    this.uniformBuffer = null;
    this.pointerBuffer = null;

    this.textures = {};
    this.bindGroups = {};
    this.pipelines = {};

    this.simWidth = 0;
    this.simHeight = 0;

    this.pointers = new Map();
    this.activeArray = new Float32Array(POINTER_LIMIT * 12);

    this.lastTime = performance.now();
    this.running = false;

    this.handleResize = this.handleResize.bind(this);
    this.loop = this.loop.bind(this);
  }

  async init() {
    if (!navigator.gpu) {
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return false;
    }

    const device = await adapter.requestDevice();
    const context = this.canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
      device,
      format,
      alphaMode: 'opaque',
    });

    this.gpu = device;
    this.context = context;
    this.format = format;

    this.uniformBuffer = device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.pointerBuffer = device.createBuffer({
      size: POINTER_LIMIT * 48,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.createPipelines();
    this.setupPointerEvents();
    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    this.running = true;
    requestAnimationFrame(this.loop);
    return true;
  }

  createPipelines() {
    const device = this.gpu;

    const advection = device.createComputePipeline({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: advectionWGSL }), entryPoint: 'main' },
    });

    const divergence = device.createComputePipeline({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: divergenceWGSL }), entryPoint: 'main' },
    });

    const jacobi = device.createComputePipeline({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: jacobiWGSL }), entryPoint: 'main' },
    });

    const gradient = device.createComputePipeline({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: gradientWGSL }), entryPoint: 'main' },
    });

    const render = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: device.createShaderModule({ code: renderWGSL }), entryPoint: 'vsMain' },
      fragment: {
        module: device.createShaderModule({ code: renderWGSL }),
        entryPoint: 'fsMain',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list' },
    });

    this.pipelines = { advection, divergence, jacobi, gradient, render };
  }

  handleResize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(2, Math.floor(window.innerWidth * dpr));
    const height = Math.max(2, Math.floor(window.innerHeight * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    const simWidth = Math.max(8, Math.floor(width / SIM_SCALE));
    const simHeight = Math.max(8, Math.floor(height / SIM_SCALE));

    if (simWidth !== this.simWidth || simHeight !== this.simHeight) {
      this.simWidth = simWidth;
      this.simHeight = simHeight;
      this.allocateTextures();
    }
  }

  allocateTextures() {
    const device = this.gpu;
    const textureUsage =
      GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST;

    const make = (format) =>
      device.createTexture({
        size: [this.simWidth, this.simHeight],
        format,
        usage: textureUsage,
      });

    this.textures = {
      velocityA: make('rgba16float'),
      velocityB: make('rgba16float'),
      dyeA: make('rgba16float'),
      dyeB: make('rgba16float'),
      divergence: make('r16float'),
      pressureA: make('r16float'),
      pressureB: make('r16float'),
    };

    this.rebuildBindGroups();
  }

  rebuildBindGroups() {
    const device = this.gpu;
    const { advection, divergence, jacobi, gradient, render } = this.pipelines;
    const t = this.textures;

    this.bindGroups.advectVelocity = device.createBindGroup({
      layout: advection.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: t.velocityA.createView() },
        { binding: 1, resource: t.velocityA.createView() },
        { binding: 2, resource: t.velocityB.createView() },
        { binding: 3, resource: { buffer: this.uniformBuffer } },
        { binding: 4, resource: { buffer: this.pointerBuffer } },
      ],
    });

    this.bindGroups.advectDye = device.createBindGroup({
      layout: advection.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: t.velocityB.createView() },
        { binding: 1, resource: t.dyeA.createView() },
        { binding: 2, resource: t.dyeB.createView() },
        { binding: 3, resource: { buffer: this.uniformBuffer } },
        { binding: 4, resource: { buffer: this.pointerBuffer } },
      ],
    });

    this.bindGroups.divergence = device.createBindGroup({
      layout: divergence.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: t.velocityB.createView() },
        { binding: 1, resource: t.divergence.createView() },
        { binding: 2, resource: { buffer: this.uniformBuffer } },
      ],
    });

    this.bindGroups.jacobiAB = device.createBindGroup({
      layout: jacobi.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: t.pressureA.createView() },
        { binding: 1, resource: t.divergence.createView() },
        { binding: 2, resource: t.pressureB.createView() },
      ],
    });

    this.bindGroups.jacobiBA = device.createBindGroup({
      layout: jacobi.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: t.pressureB.createView() },
        { binding: 1, resource: t.divergence.createView() },
        { binding: 2, resource: t.pressureA.createView() },
      ],
    });

    this.bindGroups.gradient = device.createBindGroup({
      layout: gradient.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: t.velocityB.createView() },
        { binding: 1, resource: t.pressureA.createView() },
        { binding: 2, resource: t.velocityA.createView() },
      ],
    });

    this.bindGroups.render = device.createBindGroup({
      layout: render.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: t.dyeB.createView() }],
    });
  }

  setupPointerEvents() {
    this.canvas.addEventListener('pointerdown', (event) => {
      this.canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, this.makePointerState(event));
    });

    this.canvas.addEventListener('pointermove', (event) => {
      const pointer = this.pointers.get(event.pointerId);
      if (!pointer) {
        return;
      }

      const next = this.normalizePointer(event.clientX, event.clientY);
      pointer.velocity.x = (next.x - pointer.position.x) * 90;
      pointer.velocity.y = (next.y - pointer.position.y) * 90;
      pointer.position = next;
      pointer.updated = true;
    });

    const endPointer = (event) => {
      this.pointers.delete(event.pointerId);
    };

    this.canvas.addEventListener('pointerup', endPointer);
    this.canvas.addEventListener('pointercancel', endPointer);
    this.canvas.addEventListener('pointerout', endPointer);
  }

  makePointerState(event) {
    const position = this.normalizePointer(event.clientX, event.clientY);
    const isTouch = event.pointerType === 'touch';

    return {
      id: event.pointerId,
      position,
      velocity: { x: 0, y: 0 },
      color: isTouch ? [1.0, 0.35, 0.08] : [0.1, 0.8, 1.0],
      radius: isTouch ? 0.09 : 0.06,
      strength: isTouch ? 1.6 : 1.0,
      updated: true,
    };
  }

  normalizePointer(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: 1 - (clientY - rect.top) / rect.height,
    };
  }

  writeParams(dt) {
    const aspect = this.simWidth / this.simHeight;
    const activePointers = Array.from(this.pointers.values()).slice(0, POINTER_LIMIT);

    const params = new Float32Array(16);
    params[0] = this.simWidth;
    params[1] = this.simHeight;
    params[2] = dt;
    params[3] = 0.992;
    params[4] = 1 / this.simWidth;
    params[5] = 1 / this.simHeight;
    params[6] = 0.065;
    params[7] = 58.0;
    params[8] = activePointers.length;
    params[10] = aspect;

    this.gpu.queue.writeBuffer(this.uniformBuffer, 0, params);

    this.activeArray.fill(0);
    activePointers.forEach((pointer, index) => {
      const base = index * 12;
      this.activeArray[base + 0] = 1; // active
      this.activeArray[base + 1] = 0; // velocity pass
      this.activeArray[base + 2] = pointer.position.x;
      this.activeArray[base + 3] = pointer.position.y;
      this.activeArray[base + 4] = pointer.velocity.x;
      this.activeArray[base + 5] = pointer.velocity.y;
      this.activeArray[base + 6] = pointer.color[0];
      this.activeArray[base + 7] = pointer.color[1];
      this.activeArray[base + 8] = pointer.color[2];
      this.activeArray[base + 9] = pointer.radius;
      this.activeArray[base + 10] = pointer.strength;
    });

    this.gpu.queue.writeBuffer(this.pointerBuffer, 0, this.activeArray);

    activePointers.forEach((pointer) => {
      pointer.velocity.x *= 0.82;
      pointer.velocity.y *= 0.82;
    });
  }

  writeDyePointers() {
    const activePointers = Array.from(this.pointers.values()).slice(0, POINTER_LIMIT);
    this.activeArray.fill(0);

    activePointers.forEach((pointer, index) => {
      const base = index * 12;
      this.activeArray[base + 0] = 1;
      this.activeArray[base + 1] = 1; // dye pass
      this.activeArray[base + 2] = pointer.position.x;
      this.activeArray[base + 3] = pointer.position.y;
      this.activeArray[base + 6] = pointer.color[0];
      this.activeArray[base + 7] = pointer.color[1];
      this.activeArray[base + 8] = pointer.color[2];
      this.activeArray[base + 9] = pointer.radius * 1.25;
      this.activeArray[base + 10] = pointer.strength;
    });

    this.gpu.queue.writeBuffer(this.pointerBuffer, 0, this.activeArray);
  }

  loop(now) {
    if (!this.running || !this.bindGroups.advectVelocity) {
      return;
    }

    const dt = Math.min((now - this.lastTime) / 1000, 0.033);
    this.lastTime = now;

    this.writeParams(dt);

    const encoder = this.gpu.createCommandEncoder();

    const workX = Math.ceil(this.simWidth / 8);
    const workY = Math.ceil(this.simHeight / 8);

    const compute = encoder.beginComputePass();

    compute.setPipeline(this.pipelines.advection);
    compute.setBindGroup(0, this.bindGroups.advectVelocity);
    compute.dispatchWorkgroups(workX, workY);

    this.writeDyePointers();

    compute.setPipeline(this.pipelines.advection);
    compute.setBindGroup(0, this.bindGroups.advectDye);
    compute.dispatchWorkgroups(workX, workY);

    compute.setPipeline(this.pipelines.divergence);
    compute.setBindGroup(0, this.bindGroups.divergence);
    compute.dispatchWorkgroups(workX, workY);

    compute.setPipeline(this.pipelines.jacobi);
    for (let i = 0; i < 10; i += 1) {
      compute.setBindGroup(0, i % 2 === 0 ? this.bindGroups.jacobiAB : this.bindGroups.jacobiBA);
      compute.dispatchWorkgroups(workX, workY);
    }

    compute.setPipeline(this.pipelines.gradient);
    compute.setBindGroup(0, this.bindGroups.gradient);
    compute.dispatchWorkgroups(workX, workY);

    compute.end();

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.setPipeline(this.pipelines.render);
    renderPass.setBindGroup(0, this.bindGroups.render);
    renderPass.draw(3, 1, 0, 0);
    renderPass.end();

    this.gpu.queue.submit([encoder.finish()]);

    requestAnimationFrame(this.loop);
  }
}

async function bootstrap() {
  const canvas = document.getElementById('flowCanvas');
  const fallback = document.getElementById('fallback');

  const tracker = new FluidTracker(canvas);
  const ok = await tracker.init();

  if (!ok) {
    fallback.classList.add('show');
  }
}

bootstrap();
