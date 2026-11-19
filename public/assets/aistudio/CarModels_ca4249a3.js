// CarModels: original vehicles as bevelled side-silhouette extrusions, clear-coat paint, lamps, PCPD livery.
import * as THREE from 'three';
import {
    MeshKit,
    rgb
} from '../render/MeshKit.js';
import {
    glowTexture
} from '../render/Textures.js';

// p = [nose height, beltline, hood share, boot share, windscreen run, rear-glass run]
export const CAR_SPECS = {
    comet: {
        name: 'Veloz Comet RS',
        len: 4.5,
        wid: 1.95,
        h: 1.2,
        p: [0.62, 0.86, 0.36, 0.17, 0.85, 0.95],
        kind: 'sport',
        top: 58,
        acc: 15,
        grip: 7.5,
        mass: 1.1
    },
    marea: {
        name: 'Marea Sedan',
        len: 4.7,
        wid: 1.88,
        h: 1.45,
        p: [0.74, 0.97, 0.27, 0.22, 0.62, 0.55],
        kind: 'sedan',
        top: 44,
        acc: 10,
        grip: 6,
        mass: 1.2
    },
    palma: {
        name: 'Palma Cabrio',
        len: 4.3,
        wid: 1.85,
        h: 1.25,
        p: [0.66, 0.9, 0.33, 0.25, 0.3, 0.2],
        kind: 'cabrio',
        top: 50,
        acc: 12,
        grip: 6.5,
        mass: 1
    },
    tortuga: {
        name: 'Tortuga 4x4',
        len: 4.8,
        wid: 2.02,
        h: 1.92,
        p: [0.98, 1.18, 0.22, 0.04, 0.5, 0.18],
        kind: 'suv',
        top: 42,
        acc: 10,
        grip: 5.5,
        mass: 1.6
    },
    taxi: {
        name: 'Celeste Cab',
        len: 4.7,
        wid: 1.88,
        h: 1.47,
        p: [0.74, 0.97, 0.27, 0.22, 0.62, 0.55],
        kind: 'taxi',
        top: 44,
        acc: 10,
        grip: 6,
        mass: 1.2
    },
    aureo: {
        name: 'Aureo GT',
        len: 4.6,
        wid: 2.0,
        h: 1.14,
        p: [0.58, 0.82, 0.4, 0.14, 0.9, 1.1],
        kind: 'sport',
        top: 64,
        acc: 17,
        grip: 8,
        mass: 1.1
    },
    police: {
        name: 'PCPD Interceptor',
        len: 4.95,
        wid: 1.96,
        h: 1.48,
        p: [0.76, 0.99, 0.28, 0.2, 0.62, 0.55],
        kind: 'police',
        top: 56,
        acc: 14,
        grip: 7,
        mass: 1.5
    },
    swat: {
        name: 'PCPD Tactical',
        len: 5.6,
        wid: 2.25,
        h: 2.55,
        p: [1.05, 1.25, 0.14, 0.0, 0.42, 0.04],
        kind: 'van',
        top: 44,
        acc: 11,
        grip: 6,
        mass: 2.6
    },
    van: {
        name: 'Muelle Van',
        len: 5.3,
        wid: 2.08,
        h: 2.35,
        p: [1.0, 1.2, 0.14, 0.0, 0.45, 0.04],
        kind: 'van',
        top: 38,
        acc: 8,
        grip: 5,
        mass: 2
    },
};
export const PAINTS = ['#d7263d', '#f4f1ea', '#1b998b', '#2e86de', '#f7b32b', '#ff6f91', '#222831', '#8e44ad', '#ff8c42', '#3ec1d3', '#c0c5cc', '#6a994e'];
export const TRAFFIC_MODELS = ['marea', 'marea', 'palma', 'tortuga', 'taxi', 'comet', 'van', 'marea', 'tortuga'];

const geoCache = new Map();
const sharedGlow = () => new THREE.SpriteMaterial({
    map: glowTexture(),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
});
const extrude = (shape, width, bevel = 0.07) => {
    const g = new THREE.ExtrudeGeometry(shape, {
        depth: width - bevel * 2,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel * 0.8,
        bevelSegments: 2,
        curveSegments: 10
    });
    g.translate(0, 0, -(width - bevel * 2) / 2);
    g.rotateY(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
};

// Side silhouettes (x = along the car, front at -L/2; y = up), cached per model.
function bodyGeometry(model) {
    if (geoCache.has(model)) return geoCache.get(model);
    const s = CAR_SPECS[model],
        L = s.len,
        W = s.wid,
        [noseY, belt, hoodF, bootF, ws, rear] = s.p;
    const f = -L / 2,
        r = L / 2,
        base = 0.36,
        R = 0.45,
        wz = L * 0.33,
        trunk = belt - 0.03;
    const b = new THREE.Shape();
    b.moveTo(f, base + 0.02);
    b.lineTo(f - 0.02, base + 0.28);
    b.quadraticCurveTo(f, noseY, f + 0.22, noseY + 0.03);
    b.lineTo(f + L * hoodF, belt);
    b.lineTo(r - L * bootF, belt + 0.01);
    b.quadraticCurveTo(r - 0.04, trunk, r, trunk - 0.14);
    b.lineTo(r + 0.02, base + 0.08);
    b.lineTo(r - 0.05, base);
    b.lineTo(wz + R, base);
    b.absarc(wz, 0.38, R, 0, Math.PI, false);
    b.lineTo(-wz + R, base);
    b.absarc(-wz, 0.38, R, 0, Math.PI, false);
    b.lineTo(f, base + 0.02);
    const body = extrude(b, W, 0.09);
    let glass = null,
        roof = null;
    if (s.kind !== 'cabrio') {
        const g0 = f + L * hoodF - 0.04,
            g3 = r - L * bootF + 0.04,
            g1 = g0 + ws,
            g2 = Math.max(g1 + 0.2, g3 - rear);
        const gs = new THREE.Shape();
        gs.moveTo(g0, belt - 0.02);
        gs.lineTo(g1, s.h - 0.02);
        gs.lineTo(g2, s.h - 0.02);
        gs.lineTo(g3, belt - 0.02);
        gs.lineTo(g0, belt - 0.02);
        glass = extrude(gs, W * 0.86, 0.06);
        const rs = new THREE.Shape();
        rs.moveTo(g1 + 0.02, s.h - 0.05);
        rs.lineTo(g2 - 0.02, s.h - 0.05);
        rs.lineTo(g2 - 0.06, s.h + 0.03);
        rs.lineTo(g1 + 0.08, s.h + 0.03);
        rs.lineTo(g1 + 0.02, s.h - 0.05);
        roof = extrude(rs, W * 0.84, 0.05);
        roof.userData = {
            g0,
            g1,
            g2,
            g3
        };
    }
    const out = {
        body,
        glass,
        roof
    };
    geoCache.set(model, out);
    return out;
}

export function buildCar(model, paint) {
    const s = CAR_SPECS[model],
        L = s.len,
        W = s.wid,
        [, belt, hoodF] = s.p;
    const police = s.kind === 'police' || model === 'swat';
    const geo = bodyGeometry(model);
    const g = new THREE.Group();
    const paintMat = new THREE.MeshPhysicalMaterial({
        color: police ? '#f4f6f8' : paint,
        roughness: 0.3,
        metalness: 0.45,
        clearcoat: 1,
        clearcoatRoughness: 0.06
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: '#0b141c',
        roughness: 0.04,
        metalness: 0.9,
        clearcoat: 1
    });
    const darkMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.35,
        metalness: 0.6
    });
    const lampMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        fog: false
    });
    const add = (geom, mat) => {
        const m = new THREE.Mesh(geom, mat);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
        return m;
    };
    add(geo.body, paintMat);
    if (geo.glass) {
        add(geo.glass, glassMat);
        add(geo.roof, paintMat);
    }
    const k = new MeshKit(),
        lamps = new MeshKit();
    const trim = rgb('#121418'),
        chrome = rgb('#d4d9e0');
    // bumpers, sills, grille, mirrors, pillars
    k.box(0, 0.5, -L / 2 - 0.05, W * 0.96, 0.2, 0.16, trim);
    k.box(0, 0.5, L / 2 + 0.05, W * 0.96, 0.2, 0.16, trim);
    k.box(0, 0.66, -L / 2 - 0.06, W * 0.46, 0.12, 0.05, s.kind === 'sport' ? trim : chrome);
    for (const x of [-1, 1]) k.box(x * (W / 2 + 0.01), 0.42, 0, 0.05, 0.1, L * 0.4, trim);
    if (geo.roof) {
        const {
            g0,
            g1,
            g2
        } = geo.roof.userData;
        for (const x of [-1, 1]) {
            k.box(x * (W / 2 + 0.12), belt + 0.08, g0 + 0.12, 0.22, 0.12, 0.16, trim);
            k.box(x * W * 0.42, (belt + s.h) / 2, (g1 + g2) / 2, 0.05, s.h - belt, 0.14, trim);
        }
    } else {
        for (const x of [-1, 1]) k.box(x * W * 0.42, belt + 0.25, -L / 2 + L * hoodF + 0.15, 0.05, 0.5, 0.08, trim);
        k.box(0, belt + 0.06, 0.2, W * 0.78, 0.1, L * 0.3, rgb('#6b4228'));
    }
    if (s.kind === 'sport') k.box(0, belt + 0.22, L / 2 - 0.22, W * 0.92, 0.05, 0.3, trim);
    if (s.kind === 'taxi') {
        k.box(0, s.h + 0.16, -0.1, 0.7, 0.22, 0.3, rgb('#ffd23f', 1.4));
    }
    // lamps (HDR so they bloom)
    for (const x of [-1, 1]) {
        lamps.box(x * W * 0.33, 0.72, -L / 2 - 0.02, W * 0.24, 0.1, 0.08, rgb('#fff6e0', 3.2));
        lamps.box(x * W * 0.34, 0.8, L / 2 + 0.04, W * 0.24, 0.1, 0.06, rgb('#ff1a2a', 2.4));
    }
    const decal = new MeshKit();
    if (police) { // navy doors and a gold stripe over the white body
        const dz = model === 'swat' ? 0 : -0.1,
            dl = model === 'swat' ? L * 0.7 : L * 0.42;
        for (const x of [-1, 1]) {
            decal.box(x * (W / 2 + 0.005), 0.68, dz, 0.02, 0.44, dl, rgb('#14254a'));
            decal.box(x * (W / 2 + 0.012), 0.92, dz, 0.02, 0.07, L * 0.8, rgb('#e8b43a'));
        }
        decal.box(0, belt + 0.002, -L / 2 + L * hoodF * 0.5, W * 0.7, 0.02, L * hoodF * 0.8, rgb('#14254a'));
    }
    if (s.kind === 'taxi')
        for (const x of [-1, 1]) decal.box(x * (W / 2 + 0.005), 0.72, 0, 0.02, 0.1, L * 0.8, rgb('#111'));
    add(k.geometry(), darkMat);
    add(lamps.geometry(), lampMat);
    if (decal.pos.length) add(decal.geometry(), new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.3,
        metalness: 0.3
    }));
    // wheels: tyre, rim and hub, spun and steered by Vehicle
    const wk = new MeshKit();
    wk.cyl(0, 0, 0, 0.37, 0.37, 0.27, 16, trim, {
        axisX: true
    });
    wk.cyl(0, 0, 0, 0.25, 0.25, 0.29, 8, chrome, {
        axisX: true
    });
    wk.box(0, 0, 0, 0.3, 0.06, 0.4, rgb('#777'));
    const wg = wk.geometry(),
        wheels = [],
        wz = L * 0.33;
    for (const z of [-wz, wz])
        for (const x of [-1, 1]) {
            const w = new THREE.Mesh(wg, darkMat);
            w.position.set(x * (W / 2 - 0.14), 0.37, z);
            w.castShadow = true;
            w.userData.front = z < 0;
            g.add(w);
            wheels.push(w);
        }
    // headlight / tail-light glow sprites (dusk and night, brake lights)
    const glows = [];
    for (const x of [-1, 1]) {
        const hg = new THREE.Sprite(sharedGlow());
        hg.material.color.set('#ffe9c4');
        hg.position.set(x * W * 0.33, 0.72, -L / 2 - 0.3);
        hg.scale.setScalar(1.7);
        g.add(hg);
        glows.push(hg);
        const tg = new THREE.Sprite(sharedGlow());
        tg.material.color.set('#ff2030');
        tg.position.set(x * W * 0.34, 0.8, L / 2 + 0.25);
        tg.scale.setScalar(1.0);
        g.add(tg);
        glows.push(tg);
    }
    let bar = null;
    if (police) {
        const top = s.h + 0.12,
            bz = -0.1;
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.34), new THREE.MeshStandardMaterial({
            color: '#222'
        }));
        base.position.set(0, top - 0.08, bz);
        g.add(base);
        const red = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.16, 0.3), new THREE.MeshBasicMaterial({
            color: new THREE.Color(4, 0.2, 0.25),
            fog: false
        }));
        const blue = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.16, 0.3), new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.2, 0.6, 5),
            fog: false
        }));
        red.position.set(-0.38, top, bz);
        blue.position.set(0.38, top, bz);
        const rg = new THREE.Sprite(sharedGlow()),
            bg = new THREE.Sprite(sharedGlow());
        rg.material.color.setRGB(1, 0.12, 0.15);
        bg.material.color.setRGB(0.15, 0.35, 1);
        rg.position.copy(red.position);
        bg.position.copy(blue.position);
        rg.scale.setScalar(4.2);
        bg.scale.setScalar(4.2);
        g.add(red, blue, rg, bg);
        bar = {
            red,
            blue,
            rg,
            bg
        };
    }
    return {
        group: g,
        wheels,
        glows,
        bar,
        paintMat
    };
}