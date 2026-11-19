// PostFX: HDR MSAA target + 5-level bloom + ACES + speed blur + vignette on GPUs;
// fast direct ACESFilmic path on software WebGL (SwiftShader) with fenceSync pacing.
import * as THREE from 'three';

const VERT =
  'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const BRIGHT = `uniform sampler2D tSrc; uniform float threshold; varying vec2 vUv;
void main(){ vec3 c = texture2D(tSrc, vUv).rgb; float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(threshold, threshold + 0.6, l); gl_FragColor = vec4(min(c * k, vec3(24.0)), 1.0); }`;

const BLUR = `uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
void main(){ vec3 s = texture2D(tSrc, vUv).rgb * 0.227;
  s += texture2D(tSrc, vUv + dir * 1.385).rgb * 0.316; s += texture2D(tSrc, vUv - dir * 1.385).rgb * 0.316;
  s += texture2D(tSrc, vUv + dir * 3.231).rgb * 0.070; s += texture2D(tSrc, vUv - dir * 3.231).rgb * 0.070;
  gl_FragColor = vec4(s, 1.0); }`;

const COMPOSITE = `uniform sampler2D tScene; uniform sampler2D b0; uniform sampler2D b1; uniform sampler2D b2; uniform sampler2D b3; uniform sampler2D b4;
uniform float bloom; uniform float exposure; uniform float speedBlur; uniform vec3 tint; uniform float saturation; uniform float time;
varying vec2 vUv;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec2 d = vUv - 0.5; float r = length(d);
  vec3 c = texture2D(tScene, vUv).rgb;
  if (speedBlur > 0.0) { vec3 acc = c; float w = 1.0;
    for (int i = 1; i < 7; i++) { float k = float(i) / 7.0 * speedBlur * smoothstep(0.18, 0.7, r) * 0.065;
      acc += texture2D(tScene, vUv - d * k).rgb; w += 1.0; } c = acc / w; }
  vec3 b = texture2D(b0, vUv).rgb * 0.16 + texture2D(b1, vUv).rgb * 0.2 + texture2D(b2, vUv).rgb * 0.22 + texture2D(b3, vUv).rgb * 0.22 + texture2D(b4, vUv).rgb * 0.2;
  c += b * bloom;
  c *= exposure * tint;
  c = aces(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  c = c * c * (3.0 - 2.0 * c) * 0.35 + c * 0.65;
  c *= 1.0 - smoothstep(0.45, 0.95, r) * 0.38;
  c = toSRGB(c);
  c += (fract(sin(dot(vUv * (time + 1.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

export function detectSoftwareGl(renderer: THREE.WebGLRenderer): boolean {
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const name = dbg
    ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
    : String(gl.getParameter(gl.RENDERER));
  return /swiftshader|llvmpipe|softpipe|mesa offscreen|software/i.test(name);
}

export function createFramePacer(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
): {
  scheduleNext: (fn: () => void) => void;
  cancel: () => void;
} {
  let rafId = 0;
  let timerId = 0;

  const cancel = () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (timerId) window.clearTimeout(timerId);
    rafId = 0;
    timerId = 0;
  };

  const scheduleNext = (fn: () => void) => {
    if (!isSoftwareGl) {
      rafId = requestAnimationFrame(fn);
      return;
    }
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (sync) {
        gl.flush();
        const poll = () => {
          if (gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) {
            timerId = window.setTimeout(poll, 16);
          } else {
            gl.deleteSync(sync);
            timerId = window.setTimeout(() => {
              rafId = requestAnimationFrame(fn);
            }, 80);
          }
        };
        timerId = window.setTimeout(poll, 16);
        return;
      }
    }
    timerId = window.setTimeout(() => {
      rafId = requestAnimationFrame(fn);
    }, 80);
  };

  return { scheduleNext, cancel };
}

export class PostFX {
  public params = {
    bloom: 0.85,
    threshold: 1.25,
    exposure: 0.92,
    speedBlur: 0,
    saturation: 1.16,
    tint: new THREE.Color(1, 1, 1),
  };

  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private scene = new THREE.Scene();
  private brightMat: THREE.ShaderMaterial;
  private blurMat: THREE.ShaderMaterial;
  private compMat: THREE.ShaderMaterial;
  private sceneRT: THREE.WebGLRenderTarget | null = null;
  private levels: Array<{
    a: THREE.WebGLRenderTarget;
    b: THREE.WebGLRenderTarget;
    w: number;
    h: number;
  }> = [];

  constructor(
    private renderer: THREE.WebGLRenderer,
    public readonly isSoftwareGl: boolean,
  ) {
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: frag,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });

    this.brightMat = mk(BRIGHT, {
      tSrc: { value: null },
      threshold: { value: 1 },
    });
    this.blurMat = mk(BLUR, {
      tSrc: { value: null },
      dir: { value: new THREE.Vector2() },
    });
    this.compMat = mk(COMPOSITE, {
      tScene: { value: null },
      b0: { value: null },
      b1: { value: null },
      b2: { value: null },
      b3: { value: null },
      b4: { value: null },
      bloom: { value: 1 },
      exposure: { value: 1 },
      speedBlur: { value: 0 },
      tint: { value: new THREE.Color() },
      saturation: { value: 1 },
      time: { value: 0 },
    });

    if (!this.isSoftwareGl) {
      this.setSize(2, 2);
    } else {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
    }
  }

  setSize(w: number, h: number): void {
    if (this.isSoftwareGl) return;
    const opts: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    };
    this.sceneRT?.dispose();
    this.sceneRT = new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    for (const l of this.levels) {
      l.a.dispose();
      l.b.dispose();
    }
    this.levels = [];
    let lw = w >> 1;
    let lh = h >> 1;
    for (let i = 0; i < 5; i++) {
      lw = Math.max(1, lw);
      lh = Math.max(1, lh);
      this.levels.push({
        a: new THREE.WebGLRenderTarget(lw, lh, opts),
        b: new THREE.WebGLRenderTarget(lw, lh, opts),
        w: lw,
        h: lh,
      });
      lw >>= 1;
      lh >>= 1;
    }
  }

  private pass(mat: THREE.Material, target: THREE.WebGLRenderTarget | null): void {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, time: number): void {
    if (this.isSoftwareGl || !this.sceneRT) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    const r = this.renderer;
    const p = this.params;
    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);
    this.brightMat.uniforms.threshold.value = p.threshold;
    let src = this.sceneRT.texture;
    for (const l of this.levels) {
      this.brightMat.uniforms.tSrc.value = src;
      this.pass(l === this.levels[0] ? this.brightMat : this.copyMat(src), l.a);
      this.blurMat.uniforms.tSrc.value = l.a.texture;
      this.blurMat.uniforms.dir.value.set(1 / l.w, 0);
      this.pass(this.blurMat, l.b);
      this.blurMat.uniforms.tSrc.value = l.b.texture;
      this.blurMat.uniforms.dir.value.set(0, 1 / l.h);
      this.pass(this.blurMat, l.a);
      src = l.a.texture;
    }
    const u = this.compMat.uniforms;
    u.tScene.value = this.sceneRT.texture;
    this.levels.forEach((l, i) => {
      u['b' + i].value = l.a.texture;
    });
    u.bloom.value = p.bloom;
    u.exposure.value = p.exposure;
    u.speedBlur.value = p.speedBlur;
    u.tint.value.copy(p.tint);
    u.saturation.value = p.saturation;
    u.time.value = time % 100;
    this.pass(this.compMat, null);
  }

  private copyMat(src: THREE.Texture): THREE.ShaderMaterial {
    this.blurMat.uniforms.tSrc.value = src;
    this.blurMat.uniforms.dir.value.set(0, 0);
    return this.blurMat;
  }

  dispose(): void {
    this.sceneRT?.dispose();
    for (const l of this.levels) {
      l.a.dispose();
      l.b.dispose();
    }
    this.quad.geometry.dispose();
    this.brightMat.dispose();
    this.blurMat.dispose();
    this.compMat.dispose();
  }
}
