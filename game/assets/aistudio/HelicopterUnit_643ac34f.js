// HelicopterUnit: PCPD Air-1 at 3★ (navy livery, white doors, lightbar): circles the player with a searchlight; its gunner fires at 4★+.
import * as THREE from 'three';
import {
    MeshKit,
    rgb
} from '../render/MeshKit.js';
import {
    glowTexture
} from '../render/Textures.js';
import {
    damp,
    wrapAngle
} from '../core/MathUtil.js';

export class HelicopterUnit {
    constructor(G) {
        this.G = G;
        this.active = false;
        this.spotting = false;
        this.x = 0;
        this.z = 0;
        this.y = 60;
        this.heading = 0;
        this.t = 0;
        this.fireCd = 2;
        const k = new MeshKit(),
            navy = rgb('#1a2740'),
            white = rgb('#eef1f4'),
            glass = rgb('#0b1420'),
            gold = rgb('#e8b43a');
        // navy airframe with a white belly band and gold pinstripe: a dark, readable silhouette against the sunset
        k.box(0, 0, 0, 1.9, 1.7, 4.2, navy, {
            tx: 0.85,
            tz: 0.8
        });
        k.box(0, -0.15, -1.9, 1.7, 1.3, 1.2, glass, {
            tx: 0.7,
            tz: 0.5,
            sz: 0.25
        });
        k.box(0, -0.45, 0.4, 1.95, 0.55, 3.6, white);
        k.box(0, -0.12, 0.4, 1.97, 0.12, 3.4, gold);
        k.box(0, 0.35, 4.2, 0.45, 0.45, 4.6, navy, {
            tx: 0.7
        });
        k.box(0, 0.3, 4.2, 0.47, 0.1, 4.4, gold);
        k.box(0, 1.1, 6.3, 0.15, 1.6, 0.9, navy);
        k.box(0, 0.4, 6.1, 1.8, 0.1, 0.5, navy);
        k.box(0, 0.75, -0.2, 1.4, 0.35, 1.8, navy, {
            tx: 0.8
        });
        for (const s of [-1, 1]) {
            k.box(s * 0.85, -1.25, 0, 0.12, 0.12, 3.6, rgb('#333'));
            k.box(s * 0.7, -0.95, -0.8, 0.08, 0.6, 0.08, rgb('#333'));
            k.box(s * 0.7, -0.95, 0.9, 0.08, 0.6, 0.08, rgb('#333'));
        }
        k.box(0, 1.0, 0.2, 0.5, 0.4, 0.6, rgb('#333'));
        // white PCPD doors on both flanks and a red/blue lightbar on the cabin roof: police at a glance, even as a thumbnail
        for (const s of [-1, 1]) {
            k.box(s * 0.97, 0.12, -0.3, 0.04, 0.9, 1.5, white);
            k.box(s * 0.99, 0.12, -0.3, 0.04, 0.22, 1.5, rgb('#2a6bff'));
        }
        k.box(-0.35, 1.02, -1.0, 0.6, 0.18, 0.3, rgb('#ff2a3a'));
        k.box(0.35, 1.02, -1.0, 0.6, 0.18, 0.3, rgb('#2a6bff'));
        this.group = new THREE.Group();
        this.group.scale.setScalar(1.25);
        const body = new THREE.Mesh(k.geometry(), new THREE.MeshPhysicalMaterial({
            vertexColors: true,
            roughness: 0.35,
            metalness: 0.3,
            clearcoat: 0.8
        }));
        body.castShadow = true;
        this.group.add(body);
        const rk = new MeshKit();
        rk.box(0, 0, 0, 11, 0.06, 0.32, rgb('#222'));
        rk.box(0, 0, 0, 0.32, 0.06, 11, rgb('#222'));
        this.rotor = new THREE.Mesh(rk.geometry(), new THREE.MeshStandardMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.75
        }));
        this.rotor.position.y = 1.3;
        this.group.add(this.rotor);
        // a faint spinning disc under the blades: reads as a rotor in motion, not a cross of sticks
        const disc = new THREE.Mesh(new THREE.CircleGeometry(5.6, 40), new THREE.MeshBasicMaterial({
            color: 0x1a1a22,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            side: THREE.DoubleSide
        }));
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = 1.28;
        this.group.add(disc);
        // a white nose cap and a bright cabin band, so the airframe pops against the sunset sky
        const hk = new MeshKit();
        hk.box(0, 0.62, -0.9, 1.92, 0.18, 2.6, white);
        hk.box(0, 0.25, -2.45, 1.5, 0.5, 0.25, white);
        const hull = new THREE.Mesh(hk.geometry(), body.material);
        this.group.add(hull);
        const tk = new MeshKit();
        tk.box(0, 0, 0, 0.05, 1.8, 0.2, rgb('#222'));
        tk.box(-0.3, -0.75, -0.5, 1.7, 0.06, 0.38, rgb('#1d2a4a')); // horizontal stabiliser across the boom: a truer airframe silhouette
        this.tail = new THREE.Mesh(tk.geometry(), this.rotor.material);
        this.tail.position.set(0.3, 1.1, 6.4);
        this.group.add(this.tail);
        const blink = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTexture(),
            color: 0xff3040,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false
        }));
        blink.position.set(0, 1.9, 6.3);
        blink.scale.setScalar(2.2);
        this.group.add(blink);
        this.blink = blink;
        // police strobes on the skids' ends: red to port, blue to starboard
        for (const [s, col] of [
                [-1, 0xff2a3a],
                [1, 0x2a6bff]
            ]) {
            const st = new THREE.Sprite(new THREE.SpriteMaterial({
                map: glowTexture(),
                color: col,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                fog: false
            }));
            st.position.set(s * 1.05, -0.9, -1.2);
            st.scale.setScalar(1.6);
            this.group.add(st);
        }
        // searchlight: an additive cone from the nose to the ground, and a disc where it lands
        this.cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 5.5, 1, 20, 1, true), new THREE.MeshBasicMaterial({
            color: new THREE.Color(1.0, 0.95, 0.8),
            transparent: true,
            opacity: 0.11,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: false
        }));
        this.cone.geometry.translate(0, -0.5, 0);
        this.spot = new THREE.Mesh(new THREE.CircleGeometry(5.5, 28), new THREE.MeshBasicMaterial({
            map: glowTexture(),
            color: new THREE.Color(1.6, 1.5, 1.2),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false
        }));
        this.spot.rotation.x = -Math.PI / 2;
        G.scene.add(this.cone, this.spot, this.group);
        this.hide();
    }

    hide() {
        this.group.visible = false;
        this.cone.visible = false;
        this.spot.visible = false;
    }

    setActive(on) {
        if (on && !this.active) {
            const P = this.G.player;
            this.x = P.x + 140;
            this.z = P.z + 120;
            this.y = 55;
            this.group.visible = true;
        }
        if (!on && this.active) this.leaving = 8;
        this.active = on;
    }

    update(dt) {
        const G = this.G,
            P = G.player;
        if (!this.active && !(this.leaving > 0)) return;
        this.t += dt;
        this.spotting = this.active && Math.hypot(this.x - P.x, this.z - P.z) < 110; // the searchlight has the player: dispatch reads this as SPOTLIGHT
        if (this.frozen) {
            this.place(P.x, P.z);
            this.rotor.rotation.y += dt * 38;
            return;
        }
        let tx, tz, ty;
        if (this.active) {
            const a = this.t * 0.25;
            tx = P.x + Math.cos(a) * 24;
            tz = P.z + Math.sin(a) * 24;
            ty = 30;
        } else {
            this.leaving -= dt;
            tx = this.x + 40;
            tz = this.z - 40;
            ty = 80;
            if (this.leaving <= 0) {
                this.hide();
                return;
            }
        }
        this.x = damp(this.x, tx, 0.9, dt);
        this.z = damp(this.z, tz, 0.9, dt);
        this.y = damp(this.y, ty, 0.7, dt);
        const face = Math.atan2(-(P.x - this.x), -(P.z - this.z));
        this.heading += wrapAngle(face - this.heading) * Math.min(1, dt * 1.5);
        this.place(P.x, P.z);
        this.rotor.rotation.y += dt * 38;
        this.tail.rotation.x += dt * 50;
        this.blink.visible = Math.sin(this.t * 6) > 0.6;
        G.audio ? .heli(Math.hypot(this.x - P.x, this.z - P.z, this.y));
        if (this.active && G.wanted.level >= 4 && (this.fireCd -= dt) <= 0) {
            this.fireCd = 1.6;
            G.combat.npcShoot({
                x: this.x,
                z: this.z,
                y: this.y - 1.5,
                heading: face,
                rig: null
            }, P, 0.22, 6);
        }
    }

    // Positions the body and points the searchlight at (sx, sz).
    place(sx, sz) {
        this.group.position.set(this.x, this.y, this.z);
        this.group.rotation.set(0.12, this.heading, Math.sin(this.t * 0.7) * 0.05);
        const from = new THREE.Vector3(this.x, this.y - 1.2, this.z),
            to = new THREE.Vector3(sx, 0.05, sz);
        const len = from.distanceTo(to);
        this.cone.position.copy(from);
        this.cone.scale.set(1, len, 1);
        this.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
        this.spot.position.copy(to);
        this.cone.visible = this.spot.visible = this.active;
    }
}