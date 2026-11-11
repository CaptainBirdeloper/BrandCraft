import type { LightRig, RigColors, Vec3 } from './lightrig';
import { DEFAULT_RIG, LIGHT_TARGET, resolveRigColors } from './lightrig';
import { DEFAULT_VARIANT } from '../preset/variants';

type Core = typeof import('@daidr/minecraft-skin-renderer');

interface ShaderSources {
  vertex: string;
  fragment: string;
}

interface StockPlugin {
  backend: 'webgl' | 'webgpu';
  createRenderer: (options: never) => unknown;
  shaders: ShaderSources;
}

export type { StockPlugin };

interface DrawParams {
  bindGroup: { uniforms: Record<string, unknown> };
  [key: string]: unknown;
}

interface Renderer {
  draw: (params: DrawParams) => void;
  [key: string]: unknown;
}

const VERTEX_DECLARATIONS = '// [PLUGIN_VERTEX_DECLARATIONS]';
const VERTEX_MAIN = '// [PLUGIN_VERTEX_MAIN]';
const FRAGMENT_DECLARATIONS = '// [PLUGIN_FRAGMENT_DECLARATIONS]';
const LAMBERT_BLOCK = /\/\/ Lambert lighting[\s\S]*?fragColor = vec4\(texColor\.rgb \* light, texColor\.a\);/;

/** Full lighting model that replaces the library's ambient + headlight Lambert. */
const LIGHTING_GLSL = `    // Custom lighting: hemisphere ambient + wrapped key/fill + fresnel rim.
    vec3 normal = normalize(v_worldNormal);
    vec3 viewDir = normalize(u_lightCamPos - v_worldPos);
    float hemi = normal.y * 0.5 + 0.5;
    vec3 ambient = mix(u_lightGround, u_lightSky, hemi) * u_lightAmbient;
    float keyDot = clamp((dot(normal, u_lightKeyDir) + 0.45) / 1.45, 0.0, 1.0);
    vec3 key = u_lightKeyColor * u_lightKeyIntensity * keyDot;
    float fillDot = clamp((dot(normal, u_lightFillDir) + 0.65) / 1.65, 0.0, 1.0);
    vec3 fill = u_lightFillColor * u_lightFillIntensity * fillDot;
    float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 3.0);
    float rimFace = clamp((dot(normal, u_lightRimDir) + 0.5) / 1.5, 0.0, 1.0);
    vec3 rim = u_lightRimColor * u_lightRimIntensity * fresnel * rimFace;
    vec3 lit = clamp(texColor.rgb * (ambient + key + fill) * 0.86 + rim * texColor.rgb, 0.0, 1.0);
    lit = mix(lit, lit * lit * (3.0 - 2.0 * lit), u_lightContrast);
    fragColor = vec4(lit, texColor.a);`;

function composeShader(base: ShaderSources): ShaderSources {
  const vertex = base.vertex
    .replace(VERTEX_DECLARATIONS, 'out vec3 v_worldPos;')
    .replace(VERTEX_MAIN, 'v_worldPos = worldPos.xyz;');
  const declarations = [
    'in vec3 v_worldPos;',
    'uniform vec3 u_lightKeyDir;',
    'uniform vec3 u_lightKeyColor;',
    'uniform float u_lightKeyIntensity;',
    'uniform vec3 u_lightFillDir;',
    'uniform vec3 u_lightFillColor;',
    'uniform float u_lightFillIntensity;',
    'uniform vec3 u_lightRimDir;',
    'uniform vec3 u_lightRimColor;',
    'uniform float u_lightRimIntensity;',
    'uniform vec3 u_lightSky;',
    'uniform vec3 u_lightGround;',
    'uniform float u_lightAmbient;',
    'uniform float u_lightContrast;',
    'uniform vec3 u_lightCamPos;',
  ].join('\n');
  if (!LAMBERT_BLOCK.test(base.fragment)) throw new Error('lighting: Lambert block not found');
  const fragment = base.fragment
    .replace(FRAGMENT_DECLARATIONS, declarations)
    .replace(LAMBERT_BLOCK, LIGHTING_GLSL);
  return { vertex, fragment };
}

const keyDir = new Float32Array(3);
const fillDir = new Float32Array(3);
const rimDir = new Float32Array(3);
const keyColor = new Float32Array(3);
const fillColor = new Float32Array(3);
const rimColor = new Float32Array(3);
const skyColor = new Float32Array(3);
const groundColor = new Float32Array(3);
const camPos = new Float32Array(3);
const inverse = new Float32Array(16);

let ready = false;
let keyIntensity = 0;
let fillIntensity = 0;
let rimIntensity = 0;
let ambient = 0;
let contrast = 0;
let mat4InvertFn: ((matrix: Float32Array) => Float32Array | null) | null = null;

function writeVector(out: Float32Array, value: Vec3): void {
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
}

function writeDirection(out: Float32Array, pos: Vec3): void {
  const x = pos[0] - LIGHT_TARGET[0];
  const y = pos[1] - LIGHT_TARGET[1];
  const z = pos[2] - LIGHT_TARGET[2];
  const length = Math.hypot(x, y, z);
  if (length < 1e-4) {
    out[0] = 0;
    out[1] = 1;
    out[2] = 0;
    return;
  }
  out[0] = x / length;
  out[1] = y / length;
  out[2] = z / length;
}

/** Pick the rig for the next draws. Cheap: call before each render. */
export function setLightRig(rig: LightRig, colors: RigColors): void {
  writeDirection(keyDir, rig.key.pos);
  writeDirection(fillDir, rig.fill.pos);
  writeDirection(rimDir, rig.rim.pos);
  writeVector(keyColor, colors.key);
  writeVector(fillColor, colors.fill);
  writeVector(rimColor, colors.rim);
  writeVector(skyColor, colors.sky);
  writeVector(groundColor, colors.ground);
  keyIntensity = rig.key.intensity;
  fillIntensity = rig.fill.intensity;
  rimIntensity = rig.rim.intensity;
  ambient = rig.ambient;
  contrast = rig.contrast;
  ready = true;
}

setLightRig(DEFAULT_RIG, resolveRigColors(DEFAULT_VARIANT));

/** Unproject the near-plane centre of the view-projection matrix to get the eye. */
function updateCamera(uniforms: Record<string, unknown>): void {
  const matrix = uniforms.u_viewProjectionMatrix;
  if (!(matrix instanceof Float32Array) || !mat4InvertFn) return;
  const inverted = mat4InvertFn(matrix);
  if (!inverted) return;
  inverse.set(inverted);
  const w = -inverse[11] + inverse[15];
  if (Math.abs(w) < 1e-6) return;
  camPos[0] = (-inverse[8] + inverse[12]) / w;
  camPos[1] = (-inverse[9] + inverse[13]) / w;
  camPos[2] = (-inverse[10] + inverse[14]) / w;
}

function inject(params: DrawParams): void {
  if (!ready) return;
  const uniforms = params.bindGroup.uniforms;
  updateCamera(uniforms);
  uniforms.u_lightKeyDir = keyDir;
  uniforms.u_lightKeyColor = keyColor;
  uniforms.u_lightKeyIntensity = keyIntensity;
  uniforms.u_lightFillDir = fillDir;
  uniforms.u_lightFillColor = fillColor;
  uniforms.u_lightFillIntensity = fillIntensity;
  uniforms.u_lightRimDir = rimDir;
  uniforms.u_lightRimColor = rimColor;
  uniforms.u_lightRimIntensity = rimIntensity;
  uniforms.u_lightSky = skyColor;
  uniforms.u_lightGround = groundColor;
  uniforms.u_lightAmbient = ambient;
  uniforms.u_lightContrast = contrast;
  uniforms.u_lightCamPos = camPos;
}

function wrap(base: Renderer): Renderer {
  const draw = (params: DrawParams): void => {
    inject(params);
    base.draw(params);
  };
  return new Proxy(base, {
    get(target, prop) {
      if (prop === 'draw') return draw;
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Renderer;
}

/**
 * Register a WebGL renderer plugin that keeps the stock renderer but swaps in
 * the lighting shader. Falls back to the stock plugin if the shader source
 * cannot be patched, so a library update degrades instead of breaking renders.
 */
export function registerLighting(core: Core, stock: StockPlugin): void {
  try {
    const composed = composeShader(stock.shaders);
    mat4InvertFn = (matrix) => core.mat4Invert(matrix) as Float32Array | null;
    const plugin = {
      backend: stock.backend,
      createRenderer: (options: unknown) =>
        Promise.resolve(stock.createRenderer(options as never)).then((base) => wrap(base as Renderer)),
      shaders: stock.shaders,
      getComposedShaders: () => composed,
    };
    core.use(plugin as unknown as Parameters<Core['use']>[0]);
  } catch (error) {
    console.warn('lighting: stock shader kept', error);
  }
}
