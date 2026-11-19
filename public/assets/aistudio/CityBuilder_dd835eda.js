// CityBuilder: ground, roads and every building per district; shader windows that light at night and glint gold.
import * as THREE from 'three';
import {
    MeshKit,
    rgb
} from '../render/MeshKit.js';
import {
    neonTexture
} from '../render/Textures.js';
import {
    Rng,
    clamp
} from '../core/MathUtil.js';
import {
    BLOCK,
    ROAD,
    GRID,
    SIZE,
    WALK,
    BEACH_W,
    lots
} from './CityLayout.js';

const PASTEL = ['#f4a3b5', '#9fe0c8', '#ffc69a', '#c9aaf0', '#9fd0f5', '#f7e1ad', '#ff9f8a', '#a6e3e9'];
const TOWER = ['#3f7d9c', '#5aa6b8', '#2f5f80', '#c7a46a', '#6b8fb3', '#86c2c9'];
const NEONWALL = ['#3a2350', '#2c3350', '#4a2a3a', '#253e45', '#51304f'];
const PORT = ['#b5583a', '#3d7f86', '#c99a3e', '#7a8a96', '#9d4c4c'];
const HOTELS = ['HOTEL AURORA', 'CASA LUNA', 'MARÉ AZUL', 'VILLA FLAMINGO', 'EL CORAL', 'SOL Y SAL', 'BRISA INN', 'PALOMA'];
const CLUBS = ['CLUB MEDUSA', 'LA PERLA', 'NOCHE ROSA', 'VOLTAGE', 'TACO LOCO', 'PINK PALMS', 'DISCO MARINA', 'KARAOKE 88', 'LUXE', 'MAMBO'];
const NEONCOL = ['#ff3fd0', '#35e6ff', '#ffb02e', '#7dff6a', '#ff4a5a', '#b06bff'];

export function windowMaterial(shared, opts) {
    const m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.78,
        metalness: 0.05
    });
    m.onBeforeCompile = (s) => {
        Object.assign(s.uniforms, shared, {
            uCell: {
                value: new THREE.Vector2(opts.cw, opts.ch)
            },
            uGlass: {
                value: opts.glass
            }
        });
        s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNorm;')
            .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNorm = normalize(mat3(modelMatrix) * objectNormal);');
        s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNorm; uniform float uNight; uniform float uGlint; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec2 uCell; uniform float uGlass;')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 n = normalize(vWNorm);
        if (abs(n.y) < 0.5) {
          float u = abs(n.x) > 0.5 ? vWPos.z : vWPos.x; float v = vWPos.y;
          vec2 cell = vec2(u / uCell.x, (v - 0.4) / uCell.y); vec2 f = fract(cell);
          float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.28, f.y) * step(f.y, 0.9) * step(3.8, v);
          float sf = fract(u / 6.0);
          float shop = (1.0 - step(3.1, v)) * step(0.5, v) * step(0.1, sf) * step(sf, 0.9) * (1.0 - uGlass);
          float rnd = fract(sin(dot(floor(cell) + floor(vWPos.xz / 31.0) * 17.0, vec2(12.9898, 78.233))) * 43758.5453);
          float frame = (1.0 - step(0.1, f.x) * step(f.x, 0.9) * step(0.2, f.y) * step(f.y, 0.96)) * step(3.8, v) * (1.0 - uGlass);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.05, 0.09), win * 0.92 + shop * 0.8);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25 + 0.08, frame * 0.5);
          roughnessFactor = mix(roughnessFactor, 0.12, max(win, shop));
          metalnessFactor = mix(metalnessFactor, 0.6, win * (0.1 + uGlass * 0.8));
          vec3 warm = mix(vec3(1.0, 0.7, 0.4), vec3(0.55, 0.85, 1.0), step(0.82, rnd));
          totalEmissiveRadiance += win * step(0.52, rnd) * uNight * warm * 1.5 + shop * warm * (0.12 + uNight * 0.7);
          float facing = max(dot(n, normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0);
          totalEmissiveRadiance += win * uSunCol * pow(facing, 2.0) * uGlint * (0.25 + rnd * 0.9);
        } }`);
    };
    return m;
}

export class CityBuilder {
    constructor(G) {
        this.G = G;
        this.rng = new Rng(1977);
        this.shared = {
            uNight: {
                value: 0
            },
            uGlint: {
                value: 0
            },
            uSunDir: {
                value: new THREE.Vector3(0, 1, 0)
            },
            uSunCol: {
                value: new THREE.Color()
            }
        };
        this.walls = new MeshKit();
        this.towers = new MeshKit();
        this.trim = new MeshKit();
        this.glow = new MeshKit();
        this.ground = new MeshKit();
        this.signs = [];
        this.parks = [];
        this.buildingTops = [];
    }

    build() {
        const G = this.G;
        this.buildGround();
        for (const lot of lots()) this.buildLot(lot);
        const wallMat = windowMaterial(this.shared, {
            cw: 3.1,
            ch: 3.4,
            glass: 0
        });
        const towerMat = windowMaterial(this.shared, {
            cw: 2.2,
            ch: 3.6,
            glass: 1
        });
        this.glowMat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            fog: false
        });
        const add = (kit, mat, shadow = true) => {
            const m = new THREE.Mesh(kit.geometry(), mat);
            m.castShadow = shadow;
            m.receiveShadow = true;
            G.scene.add(m);
            return m;
        };
        add(this.walls, wallMat);
        add(this.towers, towerMat);
        add(this.trim, new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.7
        }));
        add(this.ground, new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.62,
            metalness: 0.0
        }), false);
        add(this.glow, this.glowMat, false);
        return this;
    }

    buildGround() {
        const g = this.ground,
            c = this.G.collision;
        g.box(SIZE / 2, -0.05, SIZE / 2, SIZE + 100, 0.1, SIZE + 100, rgb('#2a2a31')); // asphalt
        g.box(SIZE + 330, -0.06, SIZE / 2, 500, 0.1, 1400, rgb('#b8a477')); // dunes east
        g.box(SIZE / 2, -0.06, -300, 1400, 0.1, 500, rgb('#b8a477'));
        g.box(SIZE / 2, -0.06, SIZE + 300, 1400, 0.1, 500, rgb('#b8a477'));
        g.box(-ROAD / 2 - BEACH_W / 2, -0.02, SIZE / 2, BEACH_W, 0.12, SIZE + 700, rgb('#ecd2a0')); // Playa Celeste
        g.box(-ROAD / 2 - 3, 0.12, SIZE / 2, 6, 0.24, SIZE + 100, rgb('#e7b49c')); // Malecón promenade
        for (let z = -40; z < SIZE + 40; z += 4) this.trim.box(-ROAD / 2 - 6.2, 0.55, z, 0.35, 0.7, 3.2, rgb('#f6efe6'));
        // lane markings and crosswalks
        const yel = rgb('#f2c230', 1.1),
            wht = rgb('#e8e8e8');
        for (let k = 0; k <= GRID; k++)
            for (let j = 0; j < GRID; j++) {
                const a = j * BLOCK + ROAD / 2 + 3,
                    b = (j + 1) * BLOCK - ROAD / 2 - 3,
                    mid = (a + b) / 2,
                    len = b - a,
                    p = k * BLOCK;
                for (const o of [-0.18, 0.18]) {
                    g.box(p + o, 0.015, mid, 0.14, 0.02, len, yel);
                    g.box(mid, 0.015, p + o, len, 0.02, 0.14, yel);
                }
                for (let s = -2; s <= 2; s++)
                    for (const e of [a - 1.6, b + 1.6]) {
                        g.box(p + s * 2.6, 0.016, e, 1.3, 0.02, 2.4, wht);
                        g.box(e, 0.016, p + s * 2.6, 2.4, 0.02, 1.3, wht);
                    }
            }
        c.addBox(SIZE + 40, -2000, SIZE + 400, 2000, 3);
    }

    slab(x0, z0, x1, z1, h, color) {
        this.ground.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, color);
    }

    buildLot(lot) {
        const r = this.rng,
            d = lot.district;
        this.slab(lot.x0, lot.z0, lot.x1, lot.z1, 0.2, rgb('#c8c0b4'));
        const ix0 = lot.x0 + WALK,
            iz0 = lot.z0 + WALK,
            ix1 = lot.x1 - WALK,
            iz1 = lot.z1 - WALK;
        const park = (d === 'heights' && lot.bx === 2 && lot.bz === 0) || (lot.bx === 3 && lot.bz === 3);
        const inner = park || d === 'heights' ? '#79b35c' : d === 'port' ? '#8b867c' : '#b9b0a3';
        this.slab(ix0, iz0, ix1, iz1, 0.24, rgb(inner));
        if (park) {
            this.parks.push(lot);
            return;
        }
        const W = ix1 - ix0;
        if (d === 'downtown') {
            if (r.chance(0.5)) this.tower(ix0 + W / 2, iz0 + W / 2, 30, 30, r.range(60, 115));
            else {
                this.tower(ix0 + 11, iz0 + W / 2, 20, 38, r.range(38, 80));
                this.tower(ix1 - 12, iz0 + W / 2, 22, 30, r.range(45, 95));
            }
        } else if (d === 'malecon') {
            for (const [a, b] of [
                    [0, 0],
                    [0, 1],
                    [1, 0],
                    [1, 1]
                ]) {
                const cx = ix0 + W / 4 + a * W / 2,
                    cz = iz0 + W / 4 + b * W / 2;
                this.hotel(cx, cz, 21, 21, r.range(14, 36), a === 0 && lot.bx === 0);
            }
        } else if (d === 'heights') {
            for (const [a, b] of [
                    [0, 0],
                    [0, 1],
                    [1, 0],
                    [1, 1]
                ]) this.villa(ix0 + W / 4 + a * W / 2, iz0 + W / 4 + b * W / 2);
        } else if (d === 'neon') {
            const n = 3;
            for (let i = 0; i < n; i++)
                for (let j = 0; j < 2; j++) {
                    const w = W / n - 1.5,
                        cx = ix0 + w / 2 + i * (W / n) + 0.75,
                        cz = iz0 + W / 4 + j * W / 2;
                    this.club(cx, cz, w, W / 2 - 2, r.range(8, 22), j === 0 ? -1 : 1);
                }
        } else this.warehouse(lot, ix0, iz0, ix1, iz1);
    }

    solid(cx, cz, w, dd, h) {
        this.G.collision.addBox(cx - w / 2, cz - dd / 2, cx + w / 2, cz + dd / 2, h);
        this.buildingTops.push({
            x: cx,
            z: cz,
            w,
            d: dd,
            h
        });
    }

    tower(cx, cz, w, d, h) {
        const col = rgb(this.rng.pick(TOWER));
        this.towers.box(cx, h / 2, cz, w, h, d, col);
        this.towers.box(cx, h + 4, cz, w * 0.72, 8, d * 0.72, col);
        this.trim.box(cx, h + 8.4, cz, w * 0.75, 0.8, d * 0.75, rgb('#d9d9d9'));
        const neon = rgb(this.rng.pick(['#4ff0ff', '#ffcf5a', '#ff6ad5']), 3.2);
        for (const [ox, oz, sw, sd] of [
                [0, d * 0.36, w * 0.72, 0.3],
                [0, -d * 0.36, w * 0.72, 0.3],
                [w * 0.36, 0, 0.3, d * 0.72],
                [-w * 0.36, 0, 0.3, d * 0.72]
            ]) this.glow.box(cx + ox, h + 7.6, cz + oz, sw + 0.1, 0.5, sd + 0.1, neon);
        this.trim.box(cx, 2, cz, w + 1.2, 0.6, d + 1.2, rgb('#e6e1d6'));
        this.solid(cx, cz, w, d, h);
    }

    hotel(cx, cz, w, d, h, faceBeach) {
        const r = this.rng,
            col = rgb(r.pick(PASTEL)),
            white = rgb('#fbf6ee');
        this.walls.box(cx, h / 2, cz, w, h, d, col);
        this.walls.box(cx, h + 2.5, cz, w * 0.6, 5, d * 0.6, col); // deco setback
        this.trim.box(cx, h + 0.3, cz, w + 0.6, 0.6, d + 0.6, white);
        this.trim.box(cx, h + 5.2, cz, w * 0.62, 0.5, d * 0.62, white);
        for (let y = 7.2; y < h - 1; y += 3.4) this.trim.box(cx - w / 2 - 0.6, y, cz, 1.2, 0.18, d * 0.8, white); // balconies over the boulevard
        this.trim.box(cx - w / 2 + 0.3, h / 2 + 2, cz, 0.8, h - 2, 2.4, white); // deco fin
        this.glow.box(cx - w / 2 - 0.25, 3.3, cz, 0.3, 0.25, d * 0.9, rgb('#ff8adf', 2.4)); // storefront neon strip
        this.trim.box(cx - w / 2 - 1.4, 3.2, cz, 2.6, 0.2, d * 0.8, rgb(r.pick(['#2fb5a5', '#ef6a6a', '#f2b33d'])), {
            tx: 1,
            sx: 0.4
        });
        if (faceBeach && r.chance(0.8)) this.sign(r.pick(HOTELS), r.pick(NEONCOL), cx - w / 2 - 0.35, h - 3.5, cz, -1, 0, Math.min(d * 0.95, 18));
        this.solid(cx, cz, w, d, h);
    }

    villa(cx, cz) {
        const r = this.rng,
            w = r.range(13, 18),
            d = r.range(12, 17),
            h = r.range(4, 8),
            wall = rgb(r.pick(['#f7f1e6', '#f3dfc6', '#e9f0f2', '#f6d9d0']));
        this.walls.box(cx, h / 2, cz, w, h, d, wall);
        this.trim.box(cx, h + 1.4, cz, w + 1.2, 2.8, d + 1.2, rgb('#c4633f'), {
            tx: 0.35,
            tz: 0.55
        });
        this.trim.box(cx + w / 2 + 2, 0.5, cz, 3.5, 0.3, d * 0.7, rgb('#46c3e0', 1.1)); // pool
        this.solid(cx, cz, w, d, h);
    }

    club(cx, cz, w, d, h, side) {
        const r = this.rng;
        this.walls.box(cx, h / 2, cz, w, h, d, rgb(r.pick(NEONWALL)));
        this.trim.box(cx, h + 0.3, cz, w + 0.4, 0.6, d + 0.4, rgb('#1d1a26'));
        const neon = r.pick(NEONCOL),
            fz = cz + side * (d / 2 + 0.3);
        this.glow.box(cx, 3.4, fz, w * 0.9, 0.22, 0.2, rgb(neon, 3));
        this.glow.box(cx, h - 0.6, fz, w * 0.95, 0.18, 0.2, rgb(r.pick(NEONCOL), 2.6));
        this.sign(r.pick(CLUBS), neon, cx, Math.min(h - 2.5, 7 + r.range(0, 4)), fz + side * 0.1, 0, side, Math.min(w * 0.9, 13));
        this.solid(cx, cz, w, d, h);
    }

    warehouse(lot, ix0, iz0, ix1, iz1) {
        const r = this.rng,
            w = ix1 - ix0 - 4,
            d = 26,
            h = r.range(9, 13),
            cz = iz0 + d / 2 + 1,
            cx = (ix0 + ix1) / 2;
        this.walls.box(cx, h / 2, cz, w, h, d, rgb(r.pick(PORT)));
        this.trim.box(cx, h + 1.2, cz, w + 0.6, 2.4, d + 0.6, rgb('#6f7377'), {
            tz: 0.15
        });
        this.trim.box(cx, 2.6, cz + d / 2 + 0.05, 8, 5, 0.2, rgb('#3b3f45'));
        this.solid(cx, cz, w, d, h);
        for (let i = 0; i < 4; i++)
            for (let s = 0; s < r.int(1, 3); s++) {
                const x = ix0 + 5 + i * 6.6,
                    z = iz1 - 7,
                    col = rgb(r.pick(PORT));
                this.trim.box(x, 1.3 + s * 2.6, z, 2.4, 2.6, 12, col);
                for (let k = -5; k <= 5; k += 1) this.trim.box(x, 1.3 + s * 2.6, z + k, 2.5, 2.4, 0.12, col.map((v) => v * 0.75));
                if (s === 0) this.G.collision.addBox(x - 1.2, z - 6, x + 1.2, z + 6, 3);
            }
    }

    // A neon sign standing off a facade. (nx, nz) is the direction it faces.
    sign(text, color, x, y, z, nx, nz, width) {
        const mat = new THREE.MeshBasicMaterial({
            map: neonTexture(text, color),
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false
        });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), mat);
        m.position.set(x + nx * 0.2, y, z + nz * 0.2);
        m.rotation.y = Math.atan2(nx, nz);
        this.G.scene.add(m);
        this.signs.push(m);
        return m;
    }

    update(sky) {
        const s = this.shared,
            e = sky.sunDir.y;
        s.uNight.value = clamp(sky.night * 1.2 + clamp((0.12 - e) * 2, 0, 0.4), 0, 1);
        s.uGlint.value = clamp(1 - e / 0.45, 0, 1) * (1 - sky.night) * 0.75;
        s.uSunDir.value.copy(sky.sunDir);
        s.uSunCol.value.copy(sky.sun.color);
        const k = 1.1 + s.uNight.value * 2.2;
        this.glowMat.color.setScalar(0.6 + s.uNight.value * 0.9);
        for (const m of this.signs) m.material.color.setScalar(k);
    }
}