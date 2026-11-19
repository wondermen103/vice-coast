// Props: palms, lamps, beach, Faro Celeste pier and lighthouse, cranes, billboards, and the sea shader.
import * as THREE from 'three';
import {
    MeshKit,
    rgb
} from '../render/MeshKit.js';
import {
    glowTexture,
    billboardTexture
} from '../render/Textures.js';
import {
    Rng
} from '../core/MathUtil.js';
import {
    BLOCK,
    ROAD,
    GRID,
    SIZE,
    SEA_X,
    PIER_Z
} from './CityLayout.js';

const SEA_FRAG = `uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 deep; uniform vec3 shallow; uniform vec3 skyCol; uniform float time;
varying vec3 vW;
float w(vec2 p, vec2 d, float f, float s){ return sin(dot(p, d) * f + time * s); }
void main(){
  vec2 p = vW.xz;
  vec3 n = normalize(vec3(w(p, vec2(0.8, 0.6), 0.35, 1.3) * 0.08 + w(p, vec2(-0.3, 0.95), 1.1, 2.1) * 0.04 + w(p, vec2(0.6,-0.7), 2.7, 3.4) * 0.02,
                          1.0, w(p, vec2(0.2, 1.0), 0.5, 1.7) * 0.08 + w(p, vec2(0.9, -0.2), 1.7, 2.6) * 0.035));
  vec3 v = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  float shore = smoothstep(-90.0, -64.0, vW.x);
  vec3 c = mix(deep, shallow, shore * 0.8);
  c = mix(c, skyCol, 0.25 + fres * 0.6);
  vec3 h = normalize(sunDir + v);
  c += sunColor * pow(max(dot(n, h), 0.0), 220.0) * 14.0;
  c += sunColor * pow(max(dot(n, h), 0.0), 30.0) * 0.35;
  float foam = smoothstep(0.6, 1.0, sin(vW.x * 0.9 + time * 1.6 + sin(vW.z * 0.2) * 2.0)) * smoothstep(-74.0, -64.0, vW.x);
  c = mix(c, vec3(1.0), foam * 0.6);
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;

const ADS = [
    ['CELESTE COLA', 'taste the sunset', '#ff5a5a', '#ffb35a'],
    ['RADIO OLA 104.5', 'dembow all night', '#7a3cff', '#ff4fd8'],
    ['VELOZ MOTORS', 'the new Comet RS', '#1f8fff', '#33e0c8'],
    ['PAPAYA AIR', 'fly the coast', '#ff8a3d', '#ffd23f'],
    ['ISLA BANK', 'your money, your island', '#0e7c66', '#4ad9a8']
];

export class Props {
    constructor(G) {
        this.G = G;
        this.rng = new Rng(4242);
        this.palms = new MeshKit();
        this.misc = new MeshKit();
        this.lamps = [];
        this.glows = [];
    }

    build(city) {
        const G = this.G,
            r = this.rng;
        this.city = city;
        // palms: a double row along the Malecón, in parks, and through Palm Heights
        for (let z = -30; z < SIZE + 30; z += 13) {
            this.palm(-ROAD / 2 - 1.6, z + r.range(-1, 1), r.range(8, 12));
            this.palm(-ROAD / 2 - 12 - r.range(0, 6), z + 6, r.range(7, 13));
        }
        for (let i = 0; i < 26; i++) this.palm(-ROAD / 2 - 16 - r.range(0, 30), r.range(-40, SIZE + 40), r.range(6, 11));
        for (const lot of city.parks)
            for (let i = 0; i < 14; i++) this.palm(r.range(lot.x0 + 6, lot.x1 - 6), r.range(lot.z0 + 6, lot.z1 - 6), r.range(7, 12));
        for (let bx = 0; bx < 6; bx++)
            for (let bz = 0; bz < 2; bz++)
                for (let i = 0; i < 3; i++) this.palm(bx * BLOCK + 12 + i * 24, bz * BLOCK + ROAD / 2 + 2, r.range(7, 10));
        for (let k = 1; k <= 5; k++)
            for (let z = 20; z < SIZE; z += 26)
                if (k <= 2) this.palm(k * BLOCK - ROAD / 2 - 1.5, z, r.range(8, 11));
        // street lamps on every block corner, facing the road
        for (let kx = 0; kx <= GRID; kx++)
            for (let kz = 0; kz < GRID; kz++)
                for (const s of [-1, 1]) this.lamp(kx * BLOCK + s * (ROAD / 2 + 0.8), kz * BLOCK + BLOCK / 2, -s, 0);
        // beach: umbrellas, loungers and lifeguard towers
        const umb = ['#ff5a5a', '#2fb5e8', '#ffd23f', '#3ad29f', '#ff7fd1'];
        for (let i = 0; i < 70; i++) {
            const x = r.range(-56, -24),
                z = r.range(-40, SIZE + 40);
            if (Math.abs(z - PIER_Z) < 8) continue;
            this.umbrella(x, z, rgb(r.pick(umb)));
        }
        for (let z = 30; z < SIZE; z += 140) this.lifeguard(-50, z);
        this.pier();
        this.cranes();
        this.billboards(city);
        const palmMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.85
        });
        const pm = new THREE.Mesh(this.palms.geometry(), palmMat);
        pm.castShadow = true;
        pm.receiveShadow = true;
        G.scene.add(pm);
        const mm = new THREE.Mesh(this.misc.geometry(), new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.6,
            metalness: 0.1
        }));
        mm.castShadow = true;
        mm.receiveShadow = true;
        G.scene.add(mm);
        this.sea();
        return this;
    }

    palm(x, z, h) {
        const k = this.palms,
            r = this.rng,
            lean = r.range(-0.5, 0.5),
            lz = r.range(-0.4, 0.4),
            seg = 7;
        let px = x,
            py = 0,
            pz = z;
        for (let i = 0; i < seg; i++) {
            const t = i / seg,
                sh = h / seg;
            const nx = x + lean * Math.pow(t + 1 / seg, 2) * 3,
                nz = z + lz * Math.pow(t + 1 / seg, 2) * 3;
            k.box(px, py + sh / 2, pz, 0.55 - t * 0.2, sh * 1.05, 0.55 - t * 0.2, rgb(i % 2 ? '#8a6243' : '#a37752'), {
                sx: nx - px,
                sz: nz - pz,
                tx: 0.92,
                tz: 0.92
            });
            px = nx;
            pz = nz;
            py += sh;
        }
        const m = new THREE.Matrix4(),
            q = new THREE.Quaternion(),
            e = new THREE.Euler();
        const greens = ['#3f8f3a', '#4fa443', '#2f7a35', '#5aae4a'];
        for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2 + r.range(-0.2, 0.2),
                droop = r.range(0.35, 0.75);
            for (let s = 0; s < 3; s++) { // three segments per frond so it arcs down
                const len = 1.9,
                    dist = 0.9 + s * 1.75,
                    dy = -Math.pow(s, 1.6) * droop * 0.9 + 0.3;
                e.set(0, -a, -(0.15 + s * droop * 0.55));
                q.setFromEuler(e);
                m.compose(new THREE.Vector3(px + Math.cos(a) * dist, py + dy, pz + Math.sin(a) * dist), q, new THREE.Vector3(1, 1, 1));
                k.box(0, 0, 0, len, 0.08, 1.15 - s * 0.3, rgb(greens[(i + s) % 4]), {
                    m,
                    tz: 0.6
                });
            }
        }
        k.box(px, py - 0.2, pz, 0.8, 0.7, 0.8, rgb('#6b4b2e'));
        this.G.collision.addCircle(x, z, 0.4, 6);
    }

    lamp(x, z, dx, dz) {
        const k = this.misc,
            g = rgb('#3a3f48');
        k.box(x, 3.5, z, 0.18, 7, 0.18, g);
        k.box(x + dx * 1.1, 7, z + dz * 1.1, 2.4 * Math.abs(dx) + 0.15, 0.15, 2.4 * Math.abs(dz) + 0.15, g);
        k.box(x + dx * 2.1, 6.85, z + dz * 2.1, 0.6, 0.18, 0.4, rgb('#fff1c9', 3));
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTexture(),
            color: 0xffc070,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false
        }));
        s.position.set(x + dx * 2.1, 6.7, z + dz * 2.1);
        s.scale.setScalar(3.2);
        this.G.scene.add(s);
        this.lamps.push(s);
        this.G.collision.addCircle(x, z, 0.2, 7);
    }

    umbrella(x, z, col) {
        const k = this.misc;
        k.box(x, 1.2, z, 0.08, 2.4, 0.08, rgb('#ddd'));
        k.cyl(x, 2.45, z, 0.05, 1.5, 0.5, 8, col);
        k.box(x + 1.2, 0.25, z + 0.4, 0.8, 0.2, 1.9, rgb('#ffffff'));
    }

    lifeguard(x, z) {
        const k = this.misc;
        for (const [a, b] of [
                [-1, -1],
                [1, -1],
                [-1, 1],
                [1, 1]
            ]) k.box(x + a, 1.5, z + b, 0.2, 3, 0.2, rgb('#f2f2f2'));
        k.box(x, 3.6, z, 3, 2, 3, rgb('#ff8fb1'));
        k.box(x, 4.9, z, 3.6, 0.5, 3.6, rgb('#45c4d6'), {
            tx: 0.6,
            tz: 0.6
        });
        k.box(x + 1.6, 3.8, z, 0.1, 1, 2, rgb('#fff6c0', 1.2));
    }

    pier() {
        const k = this.misc,
            len = 150,
            x0 = -ROAD / 2 - 8,
            z = PIER_Z;
        k.box(x0 - len / 2, 2.4, z, len, 0.5, 9, rgb('#9c7553'));
        for (let x = x0 - 4; x > x0 - len; x -= 6)
            for (const s of [-4, 4]) {
                k.box(x, 0.6, z + s, 0.5, 4, 0.5, rgb('#5e4630'));
                k.box(x, 3.3, z + s * 1.02, 0.15, 1.2, 0.15, rgb('#f2f2f2'));
            }
        k.box(x0 - len / 2, 3.9, z - 4.1, len, 0.12, 0.12, rgb('#f2f2f2'));
        k.box(x0 - len / 2, 3.9, z + 4.1, len, 0.12, 0.12, rgb('#f2f2f2'));
        // Faro Celeste: striped lighthouse at the end of the pier, with a sweeping beam
        const lx = x0 - len + 4;
        for (let i = 0; i < 6; i++) k.cyl(lx, 3 + i * 2.5 + 1.25, z, 2.2 - (i + 1) * 0.18, 2.2 - i * 0.18, 2.5, 12, rgb(i % 2 ? '#f6f2ea' : '#d8413a'));
        k.cyl(lx, 19.2, z, 1.3, 1.3, 2.4, 10, rgb('#ffe9a8', 4));
        k.cyl(lx, 21, z, 0.1, 1.8, 1.4, 10, rgb('#2c3a4a'));
        this.beam = new THREE.Mesh(new THREE.ConeGeometry(5, 90, 16, 1, true), new THREE.MeshBasicMaterial({
            color: 0xffe7a0,
            transparent: true,
            opacity: 0.18,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: false
        }));
        this.beam.geometry.translate(0, -45, 0);
        this.beam.geometry.rotateZ(Math.PI / 2);
        this.beamPivot = new THREE.Group();
        this.beamPivot.position.set(lx, 19.2, z);
        this.beamPivot.add(this.beam);
        this.G.scene.add(this.beamPivot);
        const arch = this.misc;
        arch.box(x0 - 3, 4.5, z - 4.6, 0.6, 9, 0.6, rgb('#fff'));
        arch.box(x0 - 3, 4.5, z + 4.6, 0.6, 9, 0.6, rgb('#fff'));
        this.city.sign('MUELLE CELESTE', '#35e6ff', x0 - 3, 8.2, z, 1, 0, 10.5);
    }

    cranes() {
        const k = this.misc;
        for (const z of [100, 260, 420]) {
            const x = 7 * BLOCK + 40,
                y = rgb('#f2a33a');
            for (const [a, b] of [
                    [-3, -3],
                    [3, -3],
                    [-3, 3],
                    [3, 3]
                ]) k.box(x + a, 14, z + b, 0.7, 28, 0.7, y);
            k.box(x, 28.5, z - 4, 4, 1.4, 46, y);
            k.box(x, 26.5, z + 1, 4, 3, 4, rgb('#3b4a5a'));
            k.box(x, 22, z - 20, 0.1, 13, 0.1, rgb('#222'));
            k.box(x, 15.5, z - 20, 2.4, 2.6, 6, rgb('#3d7f86'));
            this.G.collision.addBox(x - 3.4, z - 3.4, x + 3.4, z + 3.4, 28);
        }
    }

    billboards(city) {
        const tall = city.buildingTops.filter((b) => b.h > 16 && b.h < 40);
        for (let i = 0; i < 12 && i < tall.length; i++) {
            const b = tall[(i * 7) % tall.length],
                ad = ADS[i % ADS.length];
            const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({
                map: billboardTexture(ad[0], ad[1], ad[2], ad[3]),
                color: 0xcccccc
            }));
            m.position.set(b.x, b.h + 5.5, b.z);
            m.rotation.y = i % 2 ? Math.PI / 2 : -Math.PI / 2;
            this.G.scene.add(m);
            this.misc.box(b.x, b.h + 1, b.z, 0.4, 2, 0.4, rgb('#333'));
        }
    }

    sea() {
        const sky = this.G.sky;
        this.seaUniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
            sunDir: {
                value: sky.sunDir
            },
            sunColor: {
                value: new THREE.Color()
            },
            deep: {
                value: new THREE.Color('#0d4a6e')
            },
            shallow: {
                value: new THREE.Color('#2bb5b8')
            },
            skyCol: {
                value: new THREE.Color()
            },
            time: {
                value: 0
            }
        }]);
        this.seaUniforms.sunDir.value = sky.sunDir;
        const mat = new THREE.ShaderMaterial({
            uniforms: this.seaUniforms,
            fog: true,
            fragmentShader: '#include <common>\n#include <fog_pars_fragment>\n' + SEA_FRAG,
            vertexShader: '#include <fog_pars_vertex>\nvarying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}'
        });
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(1800, 2400), mat);
        sea.rotation.x = -Math.PI / 2;
        sea.position.set(SEA_X - 900 + 6, -0.25, SIZE / 2);
        this.G.scene.add(sea);
    }

    update(dt, sky) {
        const u = this.seaUniforms;
        u.time.value += dt;
        u.sunColor.value.copy(sky.sun.color).multiplyScalar(1 - sky.night * 0.85);
        u.skyCol.value.copy(sky.uniforms.horizon.value);
        const n = sky.night;
        for (const s of this.lamps) {
            s.visible = n > 0.05 || sky.sunDir.y < 0.2;
            s.material.opacity = Math.min(1, 0.4 + n);
        }
        this.beamPivot.rotation.y += dt * 0.9;
        this.beam.visible = n > 0.1 || sky.sunDir.y < 0.15;
    }
}