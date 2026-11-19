// SkyAndSun: day/night cycle: sky shader with HDR sun and clouds, sun/fill light, fog, PMREM sky reflections.
import * as THREE from 'three';
import {
    clamp,
    lerp,
    smooth
} from '../core/MathUtil.js';

const SKY_FRAG = `uniform vec3 top; uniform vec3 horizon; uniform vec3 below; uniform vec3 sunDir; uniform vec3 sunColor; uniform float time; uniform float night;
varying vec3 vDir;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir); float y = d.y;
  vec3 c = mix(horizon, top, pow(clamp(y, 0.0, 1.0), 0.45));
  float s = max(dot(d, sunDir), 0.0);
  c += sunColor * (pow(s, 8.0) * 0.32 + pow(s, 90.0) * 0.9) * (1.0 - night);
  c += sunColor * smoothstep(0.9994, 0.9997, s) * 16.0 * (1.0 - night);
  if (y > 0.0) {
    vec2 uv = d.xz / (y + 0.12) * 1.6 + vec2(time * 0.004, time * 0.0015);
    float cl = smoothstep(0.52, 0.85, fbm(uv * vec2(1.0, 2.6)));
    vec3 cc = mix(horizon * 1.25, sunColor * 1.6 + vec3(0.25, 0.12, 0.2), pow(s, 3.0)) * (1.0 - night * 0.8);
    c = mix(c, cc, cl * 0.75 * smoothstep(0.0, 0.12, y));
    float st = step(0.9975, h(floor(d.xz / (y + 0.3) * 260.0))) * night * smoothstep(0.1, 0.4, y);
    c += vec3(st * 2.0);
  } else c = mix(horizon, below, smoothstep(0.0, -0.08, y));
  gl_FragColor = vec4(c, 1.0);
}`;

const KEYS = [ // by sun elevation (sine): sky top, horizon, sun colour, sun intensity, sky-fill intensity
    {
        e: -0.25,
        top: '#060a22',
        hor: '#1d2150',
        sun: '#5a6cff',
        si: 0.15,
        hi: 0.35
    },
    {
        e: -0.04,
        top: '#1b2260',
        hor: '#b0507a',
        sun: '#ff6a5a',
        si: 0.5,
        hi: 0.5
    },
    {
        e: 0.08,
        top: '#3a4fa6',
        hor: '#ff9b6a',
        sun: '#ff9248',
        si: 2.6,
        hi: 0.75
    },
    {
        e: 0.3,
        top: '#3f7fd8',
        hor: '#ffd2a0',
        sun: '#ffd7a6',
        si: 3.0,
        hi: 0.95
    },
    {
        e: 0.7,
        top: '#2f7de0',
        hor: '#bfe2ff',
        sun: '#fff4e2',
        si: 3.3,
        hi: 1.05
    },
];

export class SkyAndSun {
    constructor(G) {
        this.G = G;
        this.hour = 18.5;
        this.sunDir = new THREE.Vector3();
        this.night = 0;
        this.uniforms = {
            top: {
                value: new THREE.Color()
            },
            horizon: {
                value: new THREE.Color()
            },
            below: {
                value: new THREE.Color('#2a4a6a')
            },
            sunDir: {
                value: this.sunDir
            },
            sunColor: {
                value: new THREE.Color()
            },
            time: {
                value: 0
            },
            night: {
                value: 0
            },
        };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            side: THREE.BackSide,
            depthWrite: false,
            fog: false,
            vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
            fragmentShader: SKY_FRAG,
        });
        this.dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
        this.dome.renderOrder = -10;
        this.dome.frustumCulled = false;
        G.scene.add(this.dome);

        this.sun = new THREE.DirectionalLight(0xffffff, 3);
        this.sun.castShadow = true;
        const sc = this.sun.shadow.camera;
        sc.left = -80;
        sc.right = 80;
        sc.top = 80;
        sc.bottom = -80;
        sc.near = 1;
        sc.far = 400;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.bias = -0.0004;
        this.sun.shadow.normalBias = 0.04;
        G.scene.add(this.sun, this.sun.target);
        this.fill = new THREE.HemisphereLight(0xbfd8ff, 0x8a6a50, 1);
        G.scene.add(this.fill);
        G.scene.fog = new THREE.FogExp2(0xffb080, 0.0017);

        this.pmrem = new THREE.PMREMGenerator(G.renderer);
        this.envScene = new THREE.Scene();
        this.envScene.add(new THREE.Mesh(this.dome.geometry, mat));
        this.envHour = -99;
    }

    palette(e) {
        let a = KEYS[0],
            b = KEYS[KEYS.length - 1];
        for (let i = 0; i < KEYS.length - 1; i++)
            if (e >= KEYS[i].e && e <= KEYS[i + 1].e) {
                a = KEYS[i];
                b = KEYS[i + 1];
                break;
            }
        if (e < KEYS[0].e) b = a;
        if (e > b.e) a = b;
        const t = a === b ? 0 : smooth(clamp((e - a.e) / (b.e - a.e), 0, 1));
        const mix = (p, q) => new THREE.Color(p).lerp(new THREE.Color(q), t);
        return {
            top: mix(a.top, b.top),
            hor: mix(a.hor, b.hor),
            sun: mix(a.sun, b.sun),
            si: lerp(a.si, b.si, t),
            hi: lerp(a.hi, b.hi, t)
        };
    }

    update(dt, focus) {
        const G = this.G;
        const ang = ((this.hour - 6) / 13.5) * Math.PI;
        this.sunDir.set(Math.cos(ang), Math.sin(ang) * 0.92, 0.75 * Math.cos(ang)).normalize(); // rises south-east, sets north-west over the sea
        const e = this.sunDir.y;
        const p = this.palette(e);
        this.night = clamp((0.05 - e) / 0.2, 0, 1);
        const u = this.uniforms;
        u.top.value.copy(p.top);
        u.horizon.value.copy(p.hor);
        u.sunColor.value.copy(p.sun);
        u.time.value += dt;
        u.night.value = this.night;
        u.below.value.copy(p.hor).multiplyScalar(0.55);
        const lightDir = this.sunDir.clone();
        if (lightDir.y < 0.12) lightDir.y = 0.12; // keep a usable key light at the horizon (moonlight at night)
        lightDir.normalize();
        this.sun.color.copy(this.night > 0.5 ? new THREE.Color('#8aa0ff') : p.sun);
        this.sun.intensity = Math.max(p.si, 0.25);
        this.sun.target.position.set(focus.x, 0, focus.z);
        this.sun.position.set(focus.x + lightDir.x * 160, lightDir.y * 160, focus.z + lightDir.z * 160);
        this.fill.color.copy(p.top).lerp(new THREE.Color('#ffffff'), 0.35);
        this.fill.groundColor.copy(p.hor).multiplyScalar(0.55);
        this.fill.intensity = p.hi;
        G.scene.fog.color.copy(p.hor).lerp(p.top, 0.12);
        this.dome.position.copy(G.camera.position);
        if (Math.abs(this.hour - this.envHour) > 0.35) {
            this.envHour = this.hour;
            this.envRT ? .dispose();
            this.envRT = this.pmrem.fromScene(this.envScene, 0, 1, 2000);
            G.scene.environment = this.envRT.texture;
        }
    }

    clockText() {
        const h = Math.floor(this.hour) % 24,
            m = Math.floor((this.hour % 1) * 60);
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
}