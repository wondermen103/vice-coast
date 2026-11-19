// SkyAndSun: day/night cycle + dynamic weather (Golden Hour, Tropical Storm, Midnight Neon, Coastal Noon)
// with HDR sun/cloud dome, lightning flash pulses, 3D rain streaks, fog continuity, and PMREM reflections.
import * as THREE from 'three';
import { clamp, damp, lerp, smooth } from '../core/MathUtil.ts';
import { WEATHER_SPECS, type WeatherMode, nextWeatherMode } from '../core/WeatherRules.ts';

const SKY_FRAG = `uniform vec3 top; uniform vec3 horizon; uniform vec3 below; uniform vec3 sunDir; uniform vec3 sunColor; uniform float time; uniform float night; uniform float cloudBoost; uniform float lightning;
varying vec3 vDir;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir); float y = d.y;
  vec3 c = mix(horizon, top, pow(clamp(y, 0.0, 1.0), 0.45));
  float s = max(dot(d, sunDir), 0.0);
  float sunVis = (1.0 - night) * clamp(1.0 - cloudBoost * 2.2, 0.12, 1.0);
  c += sunColor * (pow(s, 8.0) * 0.34 + pow(s, 90.0) * 0.9) * sunVis;
  c += sunColor * smoothstep(0.9994, 0.9997, s) * 14.0 * sunVis;
  if (y > 0.0) {
    vec2 uv = d.xz / (y + 0.12) * 1.6 + vec2(time * 0.0045, time * 0.0018);
    float cl = smoothstep(0.50 - cloudBoost, 0.84 - cloudBoost * 0.65, fbm(uv * vec2(1.0, 2.6)));
    vec3 stormTint = mix(vec3(1.0), vec3(0.45, 0.52, 0.64), clamp(cloudBoost * 2.5, 0.0, 1.0));
    vec3 cc = mix(horizon * 1.25, sunColor * 1.6 + vec3(0.25, 0.12, 0.2), pow(s, 3.0)) * (1.0 - night * 0.78) * stormTint;
    c = mix(c, cc, cl * 0.82 * smoothstep(0.0, 0.12, y));
    float st = step(0.9972, h(floor(d.xz / (y + 0.3) * 260.0))) * night * (1.0 - clamp(cloudBoost * 2.5, 0.0, 1.0)) * smoothstep(0.1, 0.4, y);
    c += vec3(st * 2.0);
  } else c = mix(horizon, below, smoothstep(0.0, -0.08, y));
  c += vec3(0.65, 0.78, 1.0) * lightning * 0.95;
  gl_FragColor = vec4(c, 1.0);
}`;

const KEYS = [
  { e: -0.25, top: '#05091f', hor: '#1c2352', sun: '#5f76ff', si: 0.25, hi: 0.44 },
  { e: -0.04, top: '#1c2463', hor: '#b8507d', sun: '#ff6a5a', si: 0.65, hi: 0.56 },
  { e: 0.08, top: '#324da6', hor: '#ff9560', sun: '#ff9248', si: 2.65, hi: 0.82 },
  { e: 0.3, top: '#357cd8', hor: '#ffd2a0', sun: '#ffd7a6', si: 3.05, hi: 0.98 },
  { e: 0.7, top: '#2778df', hor: '#bfe2ff', sun: '#fff4e2', si: 3.25, hi: 1.08 },
];

export class SkyAndSun {
  public hour = 17.5;
  public weather: WeatherMode = 'golden';
  public rainAmount = 0;
  public wetness = 0;
  public sunDir = new THREE.Vector3();
  public night = 0;
  public lightning = 0;
  public sun: THREE.DirectionalLight;
  public fill: THREE.HemisphereLight;
  public uniforms: Record<string, THREE.IUniform>;
  private dome: THREE.Mesh;
  private pmrem: THREE.PMREMGenerator;
  private envScene: THREE.Scene;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private envHour = -99;
  private envWeather: WeatherMode | null = null;
  private rainLines: THREE.LineSegments;
  private rainPos: Float32Array;
  private rainCount = 460;
  private thunderCd = 7;
  private tmpColor = new THREE.Color();
  private tmpColor2 = new THREE.Color();
  private lightDir = new THREE.Vector3();

  constructor(private G: any) {
    this.uniforms = {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      below: { value: new THREE.Color('#2a4a6a') },
      sunDir: { value: this.sunDir },
      sunColor: { value: new THREE.Color() },
      time: { value: 0 },
      night: { value: 0 },
      cloudBoost: { value: 0 },
      lightning: { value: 0 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader:
        'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: SKY_FRAG,
    });

    this.dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    G.scene.add(this.dome);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = !G.isSoftwareGl;
    const sc = this.sun.shadow.camera;
    sc.left = -80;
    sc.right = 80;
    sc.top = 80;
    sc.bottom = -80;
    sc.near = 1;
    sc.far = 400;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    G.scene.add(this.sun, this.sun.target);

    this.fill = new THREE.HemisphereLight(0xbfd8ff, 0x8a6a50, 1);
    G.scene.add(this.fill);
    G.scene.fog = new THREE.FogExp2(0xffb080, 0.00145);

    this.pmrem = new THREE.PMREMGenerator(G.renderer);
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(this.dome.geometry, mat));

    // Pooled 3D rain streaks around the camera for Tropical Storm & Midnight drizzle
    this.rainPos = new Float32Array(this.rainCount * 6);
    for (let i = 0; i < this.rainCount; i++) {
      const rx = (Math.random() - 0.5) * 90;
      const ry = Math.random() * 44;
      const rz = (Math.random() - 0.5) * 90;
      this.rainPos[i * 6] = rx;
      this.rainPos[i * 6 + 1] = ry;
      this.rainPos[i * 6 + 2] = rz;
      this.rainPos[i * 6 + 3] = rx - 0.16;
      this.rainPos[i * 6 + 4] = ry - 1.5;
      this.rainPos[i * 6 + 5] = rz - 0.12;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    const rm = new THREE.LineBasicMaterial({
      color: 0xcfe4ff,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(rg, rm);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    G.scene.add(this.rainLines);
  }

  setWeather(mode: WeatherMode, syncHour = true): void {
    this.weather = mode;
    const spec = WEATHER_SPECS[mode];
    if (syncHour) this.hour = spec.defaultHour;
    this.envHour = -99; // force reflection map refresh
  }

  cycleWeather(): WeatherMode {
    const next = nextWeatherMode(this.weather);
    this.setWeather(next, true);
    return next;
  }

  spec() {
    return WEATHER_SPECS[this.weather];
  }

  private palette(e: number) {
    let a = KEYS[0];
    let b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (e >= KEYS[i].e && e <= KEYS[i + 1].e) {
        a = KEYS[i];
        b = KEYS[i + 1];
        break;
      }
    }
    if (e < KEYS[0].e) b = a;
    if (e > b.e) a = b;
    const t = a === b ? 0 : smooth(clamp((e - a.e) / (b.e - a.e), 0, 1));
    const mix = (p: string, q: string) => new THREE.Color(p).lerp(new THREE.Color(q), t);
    return {
      top: mix(a.top, b.top),
      hor: mix(a.hor, b.hor),
      sun: mix(a.sun, b.sun),
      si: lerp(a.si, b.si, t),
      hi: lerp(a.hi, b.hi, t),
    };
  }

  update(dt: number, focus: { x: number; z: number }): void {
    const G = this.G;
    const spec = WEATHER_SPECS[this.weather];
    this.rainAmount = damp(this.rainAmount, spec.rainIntensity, 2.2, dt);
    this.wetness = damp(this.wetness, spec.rainIntensity > 0.1 ? 1 : 0, 1.4, dt);

    // Storm lightning flashes
    if (this.weather === 'storm') {
      this.thunderCd -= dt;
      if (this.thunderCd <= 0) {
        this.lightning = 1;
        this.thunderCd = 9 + Math.random() * 14;
        G.audio?.thunder?.();
      }
    }
    this.lightning = Math.max(0, this.lightning - dt * 3.8);

    const ang = ((this.hour - 6) / 13.5) * Math.PI;
    this.sunDir
      .set(Math.cos(ang), Math.sin(ang) * 0.92, 0.75 * Math.cos(ang))
      .normalize();
    const e = this.sunDir.y;
    const p = this.palette(e);
    this.night = clamp((0.05 - e) / 0.2, 0, 1);

    // Blend storm gloom into horizon/top
    const stormMix = this.weather === 'storm' ? 0.56 : 0;
    if (stormMix > 0) {
      this.tmpColor.set('#273347');
      this.tmpColor2.set('#5a6a7d');
      p.top.lerp(this.tmpColor, stormMix);
      p.hor.lerp(this.tmpColor2, stormMix);
    }

    const u = this.uniforms;
    u.top.value.copy(p.top);
    u.horizon.value.copy(p.hor);
    u.sunColor.value.copy(p.sun);
    u.time.value += dt;
    u.night.value = this.night;
    u.cloudBoost.value = damp(u.cloudBoost.value, spec.cloudBoost, 1.8, dt);
    u.lightning.value = this.lightning;
    u.below.value.copy(p.hor).multiplyScalar(0.55);

    this.lightDir.copy(this.sunDir);
    if (this.lightDir.y < 0.12) this.lightDir.y = 0.12;
    this.lightDir.normalize();

    this.sun.color.copy(this.night > 0.5 ? this.tmpColor.set('#8aa4ff') : p.sun);
    if (this.lightning > 0.1) {
      this.sun.color.lerp(this.tmpColor2.set('#dceaff'), this.lightning * 0.7);
    }
    this.sun.intensity = Math.max(p.si * spec.sunDim, 0.3) + this.lightning * 2.2;
    this.sun.target.position.set(focus.x, 0, focus.z);
    this.sun.position.set(
      focus.x + this.lightDir.x * 160,
      this.lightDir.y * 160,
      focus.z + this.lightDir.z * 160,
    );

    this.fill.color.copy(p.top).lerp(this.tmpColor.set('#ffffff'), 0.35);
    this.fill.groundColor.copy(p.hor).multiplyScalar(0.55);
    this.fill.intensity = p.hi + this.lightning * 0.5;

    const fog = G.scene.fog as THREE.FogExp2;
    fog.color.copy(p.hor).lerp(p.top, 0.12);
    fog.density = damp(fog.density, spec.fogDensity, 1.8, dt);

    this.dome.position.copy(G.camera.position);

    // Update 3D rain streaks around camera
    if (this.rainAmount > 0.05) {
      this.rainLines.visible = true;
      (this.rainLines.material as THREE.LineBasicMaterial).opacity =
        0.15 + this.rainAmount * 0.34;
      const cx = G.camera.position.x;
      const cy = G.camera.position.y;
      const cz = G.camera.position.z;
      const fall = (28 + this.rainAmount * 14) * dt;
      for (let i = 0; i < this.rainCount; i++) {
        const idx = i * 6;
        let x = this.rainPos[idx];
        let y = this.rainPos[idx + 1] - fall;
        let z = this.rainPos[idx + 2];
        if (y < 0.2 || Math.abs(x - cx) > 48 || Math.abs(z - cz) > 48) {
          x = cx + (Math.random() - 0.5) * 86;
          y = cy + 16 + Math.random() * 26;
          z = cz + (Math.random() - 0.5) * 86;
        }
        this.rainPos[idx] = x;
        this.rainPos[idx + 1] = y;
        this.rainPos[idx + 2] = z;
        this.rainPos[idx + 3] = x - 0.18;
        this.rainPos[idx + 4] = y - 1.55;
        this.rainPos[idx + 5] = z - 0.12;
      }
      this.rainLines.geometry.attributes.position.needsUpdate = true;
    } else {
      this.rainLines.visible = false;
    }

    if (
      Math.abs(this.hour - this.envHour) > 0.45 ||
      this.envWeather !== this.weather
    ) {
      this.envHour = this.hour;
      this.envWeather = this.weather;
      this.envRT?.dispose();
      this.envRT = this.pmrem.fromScene(this.envScene, 0, 1, 2000);
      G.scene.environment = this.envRT.texture;
    }
  }

  clockText(): string {
    const h = Math.floor(this.hour) % 24;
    const m = Math.floor((this.hour % 1) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
}
