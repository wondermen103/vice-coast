// PersonModel: jointed people (two-bone limbs, head, hair, shades, gun) and walk/run/aim/fallen animation.
import * as THREE from 'three';
import {
    MeshKit,
    rgb
} from '../render/MeshKit.js';

const MAT = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.75
});
export const SKINS = ['#f1c7a5', '#d9a07a', '#b97850', '#8a5636', '#5e3a24', '#e8b48f'];
export const HAIRS = ['#1c1410', '#3b2414', '#6b4423', '#c99a4e', '#111', '#8a2b1c', '#e6d3a0'];
export const SHIRTS = ['#ff6f91', '#3ec1d3', '#ffd23f', '#f4f1ea', '#6a994e', '#ff8c42', '#8e44ad', '#2e86de', '#e63946', '#f7a1c4'];
export const PANTS = ['#2b2d42', '#3d405b', '#c2b280', '#e9e3d5', '#1d3557', '#5c4033', '#4a4e69'];

function part(build) {
    const k = new MeshKit();
    build(k);
    const m = new THREE.Mesh(k.geometry(), MAT);
    m.castShadow = true;
    return m;
}

export function buildPerson(look) {
    const skin = rgb(look.skin),
        shirt = rgb(look.shirt),
        pants = rgb(look.pants),
        hair = rgb(look.hair),
        shoe = rgb(look.shoe || '#222');
    const root = new THREE.Group(),
        body = new THREE.Group();
    root.add(body);
    const s = look.scale || 1;
    body.scale.setScalar(s);
    const hips = new THREE.Group();
    hips.position.y = 0.95;
    body.add(hips);
    hips.add(part((k) => {
        k.box(0, 0.04, 0, 0.34, 0.2, 0.2, pants);
    }));
    const chest = new THREE.Group();
    chest.position.y = 0.12;
    hips.add(chest);
    chest.add(part((k) => {
        k.box(0, 0.22, 0, 0.36, 0.44, 0.21, shirt, {
            tx: 1.18,
            tz: 1.05
        });
        if (look.vest) k.box(0, 0.24, 0, 0.4, 0.36, 0.25, rgb(look.vest), {
            tx: 1.1
        });
        if (look.badge) k.box(-0.1, 0.34, -0.13, 0.05, 0.05, 0.02, rgb('#ffd34a', 1.5));
        if (look.tee) {
            k.box(0, 0.25, -0.113, 0.13, 0.42, 0.02, rgb(look.tee));
            k.box(0, 0.43, -0.12, 0.1, 0.02, 0.02, rgb('#e8c25a', 1.3));
        }
        k.box(0, 0.5, 0, 0.09, 0.08, 0.09, skin);
    }));
    const head = new THREE.Group();
    head.position.y = 0.66;
    chest.add(head);
    const hg = new THREE.SphereGeometry(0.118, 12, 10);
    hg.scale(0.95, 1.12, 1.05);
    const hc = new Float32Array(hg.attributes.position.count * 3);
    for (let i = 0; i < hc.length; i += 3) hc.set(skin, i);
    hg.setAttribute('color', new THREE.BufferAttribute(hc, 3));
    const hm = new THREE.Mesh(hg, MAT);
    hm.castShadow = true;
    head.add(hm);
    if (!look.cap) { // hair: a cap of the head sphere, a little larger and pushed back
        const hairG = new THREE.SphereGeometry(0.128, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
        hairG.scale(0.98, 1.08, 1.1);
        hairG.translate(0, 0.012, 0.012);
        const hcol = new Float32Array(hairG.attributes.position.count * 3);
        for (let i = 0; i < hcol.length; i += 3) hcol.set(hair, i);
        hairG.setAttribute('color', new THREE.BufferAttribute(hcol, 3));
        head.add(new THREE.Mesh(hairG, MAT));
    }
    head.add(part((k) => {
        for (const x of [-0.115, 0.115]) k.box(x, 0, 0.005, 0.025, 0.05, 0.04, skin);
        if (look.longHair) k.box(0, -0.04, 0.08, 0.24, 0.26, 0.12, hair);
        if (look.cap) {
            k.box(0, 0.1, 0.01, 0.25, 0.08, 0.25, rgb(look.cap));
            k.box(0, 0.07, -0.15, 0.2, 0.025, 0.12, rgb(look.cap));
        }
        k.box(0, -0.005, -0.118, 0.035, 0.05, 0.04, skin);
        if (look.shades) k.box(0, 0.025, -0.115, 0.2, 0.045, 0.03, rgb('#0b0b0f'));
        else
            for (const x of [-0.045, 0.045]) k.box(x, 0.025, -0.112, 0.03, 0.02, 0.01, rgb('#1a1a1a'));
    }));
    const limb = (x, y, upperLen, lowerLen, upperCol, lowerCol, w, end, parent) => {
        const top = new THREE.Group();
        top.position.set(x, y, 0);
        parent.add(top);
        top.add(part((k) => k.box(0, -upperLen / 2, 0, w, upperLen, w * 1.08, upperCol, {
            tx: 1.12,
            tz: 1.1
        })));
        const mid = new THREE.Group();
        mid.position.y = -upperLen;
        top.add(mid);
        mid.add(part((k) => {
            k.box(0, -lowerLen / 2, 0, w * 0.86, lowerLen, w * 0.92, lowerCol, {
                tx: 1.12
            });
            end(k);
        }));
        return {
            top,
            mid
        };
    };
    const sleeve = look.longSleeve ? shirt : skin;
    const armL = limb(-0.235, 0.42, 0.29, 0.27, shirt, sleeve, 0.085, (k) => k.box(0, -0.3, 0, 0.07, 0.08, 0.06, skin), chest);
    const armR = limb(0.235, 0.42, 0.29, 0.27, shirt, sleeve, 0.085, (k) => k.box(0, -0.3, 0, 0.07, 0.08, 0.06, skin), chest);
    const shoeBox = (k) => k.box(0, -0.47, -0.05, 0.12, 0.08, 0.27, shoe);
    const legL = limb(-0.095, -0.02, 0.45, 0.45, pants, look.shorts ? skin : pants, 0.14, shoeBox, hips);
    const legR = limb(0.095, -0.02, 0.45, 0.45, pants, look.shorts ? skin : pants, 0.14, shoeBox, hips);
    const gun = part((k) => {
        k.box(0, -0.31, -0.08, 0.04, 0.08, 0.22, rgb('#1a1c20'));
        k.box(0, -0.37, -0.02, 0.035, 0.1, 0.05, rgb('#1a1c20'));
    });
    gun.visible = false;
    armR.mid.add(gun);
    return {
        root,
        body,
        hips,
        chest,
        head,
        armL,
        armR,
        legL,
        legR,
        gun
    };
}

// Poses the rig. mode: 'idle' | 'walk' | 'run' | 'dead'; aim adds a raised gun arm.
export function animatePerson(r, phase, mode, aim, dt) {
    if (mode === 'dead') {
        r.body.rotation.x = THREE.MathUtils.lerp(r.body.rotation.x, -Math.PI / 2, Math.min(1, dt * 6));
        r.body.position.y = THREE.MathUtils.lerp(r.body.position.y, 0.12, Math.min(1, dt * 6));
        r.armL.top.rotation.z = -1.2;
        r.armR.top.rotation.z = 1.2;
        r.legL.top.rotation.x = 0.1;
        r.legR.top.rotation.x = -0.15;
        return;
    }
    r.body.rotation.x = 0;
    r.body.position.y = 0;
    if (mode === 'drive') { // seated at the wheel: thighs forward, shins down, hands on the rim
        r.body.position.y = -0.42;
        r.legL.top.rotation.x = r.legR.top.rotation.x = 1.45;
        r.legL.mid.rotation.x = r.legR.mid.rotation.x = -1.25;
        r.armL.top.rotation.x = r.armR.top.rotation.x = 1.05;
        r.armL.mid.rotation.x = r.armR.mid.rotation.x = 0.35;
        r.armL.top.rotation.z = -0.12;
        r.armR.top.rotation.z = 0.12;
        return;
    }
    const amp = mode === 'run' ? 0.95 : mode === 'walk' ? 0.5 : 0,
        sn = Math.sin(phase),
        cs = Math.cos(phase);
    r.legL.top.rotation.x = sn * amp;
    r.legR.top.rotation.x = -sn * amp;
    r.legL.mid.rotation.x = -Math.max(0, -cs) * amp * 1.3 - (amp ? 0.05 : 0);
    r.legR.mid.rotation.x = -Math.max(0, cs) * amp * 1.3 - (amp ? 0.05 : 0);
    r.armL.top.rotation.x = -sn * amp * 0.8;
    r.armL.mid.rotation.x = 0.25 + amp * 0.5;
    r.armL.top.rotation.z = -0.08;
    r.armR.top.rotation.x = sn * amp * 0.8;
    r.armR.mid.rotation.x = 0.25 + amp * 0.5;
    r.armR.top.rotation.z = 0.08;
    r.hips.position.y = 0.95 + Math.abs(cs) * amp * 0.06;
    r.chest.rotation.x = mode === 'run' ? 0.18 : 0.02;
    r.chest.rotation.y = sn * amp * 0.12;
    if (aim) {
        r.armR.top.rotation.set(Math.PI / 2 - r.chest.rotation.x, 0, 0);
        r.armR.mid.rotation.x = 0;
        r.armL.top.rotation.set(Math.PI / 2.4, 0, 0.5);
        r.armL.mid.rotation.x = 0.3;
        r.chest.rotation.y = 0;
    }
    r.gun.visible = !!aim;
}

let seedN = 0;
export function randomLook(rng, extra = {}) {
    seedN++;
    return Object.assign({
        skin: rng.pick(SKINS),
        hair: rng.pick(HAIRS),
        shirt: rng.pick(SHIRTS),
        pants: rng.pick(PANTS),
        shorts: rng.chance(0.35),
        shades: rng.chance(0.3),
        longHair: rng.chance(0.4),
        cap: rng.chance(0.15) ? rng.pick(SHIRTS) : null,
        scale: rng.range(0.94, 1.06),
        shoe: rng.pick(['#222', '#f2f2f2', '#7a4a2a'])
    }, extra);
}