// Minimap: rotating radar with GPS route and blips, and the full-city pause map.
import {
    BLOCK,
    ROAD,
    GRID,
    SIZE,
    SEA_X,
    PIER_Z,
    DISTRICTS,
    blockDistrict,
    route
} from '../world/CityLayout.js';
import {
    PLACES,
    SIDE
} from '../missions/StoryMissions.js';

const MIN = -110,
    SPAN = SIZE + 220;
export class Minimap {
    constructor(G) {
        this.G = G;
        this.routeT = 0;
        this.path = null;
        this.map = document.createElement('canvas');
        this.map.width = this.map.height = SPAN * 2;
        this.drawCity(this.map.getContext('2d'));
        this.radar = document.getElementById('radar');
        this.ctx = this.radar.getContext('2d');
    }

    drawCity(g) {
        g.scale(2, 2);
        g.translate(-MIN, -MIN);
        let seed = 7;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // fixed seed: same map every run
        g.fillStyle = '#7fc8a0';
        g.fillRect(MIN, MIN, SPAN, SPAN); // inland scrub
        const sea = g.createLinearGradient(MIN, 0, SEA_X, 0);
        sea.addColorStop(0, '#0f4f86');
        sea.addColorStop(1, '#2fb2d6');
        g.fillStyle = sea;
        g.fillRect(MIN, MIN, SEA_X - MIN, SPAN);
        g.strokeStyle = 'rgba(255,255,255,0.22)';
        g.lineWidth = 1.2; // swell lines
        for (let z = MIN; z < MIN + SPAN; z += 9) {
            g.beginPath();
            g.moveTo(SEA_X - 3, z);
            g.quadraticCurveTo(SEA_X - 10, z + 4, SEA_X - 3 - (z % 5), z + 8);
            g.stroke();
        }
        g.fillStyle = '#f6dc98';
        g.fillRect(SEA_X, MIN, -ROAD / 2 - SEA_X, SPAN);
        g.fillStyle = '#e94f64';
        for (let z = MIN + 6; z < MIN + SPAN; z += 23) {
            g.beginPath();
            g.arc(SEA_X + 7 + (z % 3) * 3, z, 1.8, 0, Math.PI * 2);
            g.fill();
        } // parasols
        g.fillStyle = '#3a3e4c';
        g.fillRect(-ROAD / 2, -ROAD / 2, SIZE + ROAD, SIZE + ROAD);
        for (let bx = 0; bx < GRID; bx++)
            for (let bz = 0; bz < GRID; bz++) {
                const key = blockDistrict(bx, bz),
                    d = DISTRICTS[key],
                    x0 = bx * BLOCK + ROAD / 2,
                    z0 = bz * BLOCK + ROAD / 2,
                    w = BLOCK - ROAD;
                g.fillStyle = '#d9d2c4';
                g.fillRect(x0, z0, w, w); // sidewalk
                g.globalAlpha = 0.62;
                g.fillStyle = d.color;
                g.fillRect(x0 + 1.5, z0 + 1.5, w - 3, w - 3);
                g.globalAlpha = 1; // district ground tint: each district reads as one colour even when the map is small
                if ((bx * 7 + bz * 3) % 11 === 4) { // a park block: lawn, path, trees
                    g.fillStyle = '#5fbf6a';
                    g.fillRect(x0 + 2, z0 + 2, w - 4, w - 4);
                    g.strokeStyle = '#efe3c2';
                    g.lineWidth = 2;
                    g.beginPath();
                    g.moveTo(x0 + 2, z0 + 2);
                    g.lineTo(x0 + w - 2, z0 + w - 2);
                    g.stroke();
                    g.fillStyle = '#2f8a46';
                    for (let i = 0; i < 9; i++) {
                        g.beginPath();
                        g.arc(x0 + 5 + rnd() * (w - 10), z0 + 5 + rnd() * (w - 10), 2.4, 0, Math.PI * 2);
                        g.fill();
                    }
                    continue;
                }
                // building footprints in the district's colour, each with a darker roof edge
                const n = key === 'downtown' ? 2 : 3,
                    cell = (w - 4) / n;
                for (let i = 0; i < n; i++)
                    for (let j = 0; j < n; j++) {
                        const fx = x0 + 2 + i * cell + 1,
                            fz = z0 + 2 + j * cell + 1,
                            fw = cell - 2 - rnd() * 3,
                            fh = cell - 2 - rnd() * 3;
                        g.fillStyle = d.map;
                        g.fillRect(fx, fz, fw, fh);
                        g.fillStyle = 'rgba(40,20,50,0.18)';
                        g.fillRect(fx + fw - 2, fz, 2, fh);
                        g.fillRect(fx, fz + fh - 2, fw, 2);
                    }
                if (key === 'neon') {
                    g.fillStyle = '#ff4fd8';
                    g.fillRect(x0 + 1, z0 + w / 2 - 1, w - 2, 2);
                } // neon strip
            }
        g.fillStyle = '#2f8a46';
        for (let z = 4; z < SIZE; z += 11) {
            g.beginPath();
            g.arc(-ROAD / 2 - 3, z, 2.2, 0, Math.PI * 2);
            g.fill();
        } // Malecón palms
        g.fillStyle = '#8b6a4c';
        g.fillRect(-ROAD / 2 - 158, PIER_Z - 4.5, 150, 9);
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(-ROAD / 2 - 160, PIER_Z, 5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#e94f64';
        g.beginPath();
        g.arc(-ROAD / 2 - 160, PIER_Z, 2.5, 0, Math.PI * 2);
        g.fill(); // Faro Celeste
        g.strokeStyle = 'rgba(255,214,90,0.55)';
        g.lineWidth = 1;
        g.setLineDash([4, 4]); // lane markings
        for (let k = 0; k <= GRID; k++) {
            g.beginPath();
            g.moveTo(k * BLOCK, 0);
            g.lineTo(k * BLOCK, SIZE);
            g.moveTo(0, k * BLOCK);
            g.lineTo(SIZE, k * BLOCK);
            g.stroke();
        }
        g.setLineDash([]);
    }

    icon(g, x, y, color, label, r = 7) {
        g.fillStyle = color;
        g.strokeStyle = '#111';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        if (label) {
            g.fillStyle = '#111';
            g.font = `bold ${r * 1.4}px "Segoe UI", sans-serif`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(label, x, y + 0.5);
        }
    }

    // Everything that shows on both maps, in world coordinates.
    blips() {
        const G = this.G,
            out = [],
            t = performance.now() / 1000;
        for (const k of ['guns', 'sully', 'safehouse']) out.push({
            x: PLACES[k][0],
            z: PLACES[k][1],
            color: k === 'guns' ? '#ff7a59' : k === 'sully' ? '#48e39a' : '#ffffff',
            label: k === 'guns' ? '¡' : k === 'sully' ? 'S' : 'H',
            r: 6,
            shop: true
        });
        out.push(...G.missions.blips());
        for (const u of G.police.units)
            if (!u.dead) out.push({
                x: u.x,
                z: u.z,
                color: u.roadblock ? '#ffd23f' : Math.sin(t * 10 + u.id) > 0 ? '#ff3344' : '#3a7bff',
                label: u.roadblock ? '!' : '',
                r: u.roadblock ? 5.5 : 4.5
            }); // roadblocks in amber, as on the dispatch board
        if (G.police.heli.active) out.push({
            x: G.police.heli.x,
            z: G.police.heli.z,
            color: '#ff3344',
            label: 'H',
            r: 6
        });
        return out;
    }

    update(dt) {
        const G = this.G,
            P = G.player,
            g = this.ctx,
            W = this.radar.width,
            R = W / 2;
        const tgt = G.missions.target();
        if ((this.routeT -= dt) <= 0) {
            this.routeT = 0.5;
            this.path = tgt ? route(P.x, P.z, tgt[0], tgt[1]) : null;
        }
        const zoom = P.vehicle ? 1.15 - Math.min(0.45, Math.abs(P.vehicle.speed) / 90) : 1.5;
        g.save();
        g.clearRect(0, 0, W, W);
        g.beginPath();
        g.arc(R, R, R - 3, 0, Math.PI * 2);
        g.clip();
        g.translate(R, R);
        g.rotate(G.cam.yaw);
        g.scale(zoom, zoom);
        g.drawImage(this.map, (MIN - P.x) * 1, (MIN - P.z) * 1, SPAN, SPAN);
        if (this.path) {
            g.strokeStyle = '#ffd84a';
            g.lineWidth = 5 / zoom;
            g.lineJoin = 'round';
            g.beginPath();
            this.path.forEach(([x, z], i) => (i ? g.lineTo(x - P.x, z - P.z) : g.moveTo(x - P.x, z - P.z)));
            g.stroke();
        }
        // the PCPD search zone: centred on where they last saw you, it follows you while you are in sight and shrinks as you evade
        if (G.wanted.level) {
            const [lx, lz] = G.wanted.lastSeen, rad = (26 + G.wanted.level * 9) * (1 - 0.5 * G.wanted.evadeProgress());
            g.fillStyle = G.wanted.seen ? 'rgba(255,40,60,0.2)' : 'rgba(60,110,255,0.2)';
            g.strokeStyle = G.wanted.seen ? 'rgba(255,60,80,0.9)' : 'rgba(90,140,255,0.9)';
            g.lineWidth = 3 / zoom;
            g.setLineDash([8 / zoom, 5 / zoom]);
            g.beginPath();
            g.arc(lx - P.x, lz - P.z, rad, 0, Math.PI * 2);
            g.fill();
            g.stroke();
            g.setLineDash([]);
        }
        for (const b of this.blips()) {
            let dx = b.x - P.x,
                dz = b.z - P.z;
            const d = Math.hypot(dx, dz),
                lim = (R - 12) / zoom;
            if (d > lim) {
                if (b.r < 6 && !b.goal) continue;
                dx *= lim / d;
                dz *= lim / d;
            }
            g.save();
            g.translate(dx, dz);
            g.rotate(-G.cam.yaw);
            if (b.shop && d < 40) {
                g.strokeStyle = b.color;
                g.lineWidth = 3 / zoom;
                g.beginPath();
                g.arc(0, 0, 13 / zoom, 0, Math.PI * 2);
                g.stroke();
            } // a shop in reach gets a ring
            this.icon(g, 0, 0, b.color, b.label, (b.r || (b.small ? 4 : 7)) / zoom * 1.1);
            g.restore();
        }
        g.restore();
        // player arrow (always pointing where the player faces relative to the camera)
        g.save();
        g.translate(R, R);
        g.rotate(G.cam.yaw - P.heading);
        g.fillStyle = '#fff';
        g.strokeStyle = '#111';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, -11);
        g.lineTo(8, 9);
        g.lineTo(0, 4);
        g.lineTo(-8, 9);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
        // north marker on the rim
        const a = G.cam.yaw - Math.PI / 2;
        this.icon(g, R + Math.cos(a) * (R - 14), R + Math.sin(a) * (R - 14), '#111', '', 9);
        g.fillStyle = '#fff';
        g.font = 'bold 12px "Segoe UI"';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('N', R + Math.cos(a) * (R - 14), R + Math.sin(a) * (R - 14) + 0.5);
        const wanted = G.wanted.level > 0,
            flash = Math.sin(performance.now() / 120) > 0;
        g.lineWidth = 6;
        g.strokeStyle = wanted ? (flash ? '#ff2a3d' : '#2f6bff') : 'rgba(255,255,255,0.9)';
        g.beginPath();
        g.arc(R, R, R - 3, 0, Math.PI * 2);
        g.stroke();
    }

    // The full-city map for the pause screen.
    drawFull(canvas) {
        // cropped to the city and its beach, so the districts fill the frame
        const g = canvas.getContext('2d'),
            X0 = -62,
            Z0 = -14,
            VIEW = SIZE + 28 - X0,
            s = canvas.width / VIEW,
            P = this.G.player;
        g.drawImage(this.map, (X0 - MIN) * 2, (Z0 - MIN) * 2, VIEW * 2, VIEW * 2, 0, 0, canvas.width, canvas.height);
        g.save();
        g.scale(s, s);
        g.translate(-X0, -Z0);
        g.font = 'italic 900 22px "Segoe UI", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        const labels = [
            ['malecon', 30, 390],
            ['heights', 220, 66],
            ['downtown', 262, 320],
            ['neon', 250, 534],
            ['port', 504, 200],
            ['beach', -40, 120]
        ];
        for (const [k, x, z] of labels) {
            g.save();
            g.translate(x, z);
            if (k === 'beach' || k === 'malecon') g.rotate(-Math.PI / 2);
            g.strokeStyle = 'rgba(15,10,30,0.9)';
            g.lineWidth = 5;
            g.strokeText(DISTRICTS[k].name.toUpperCase(), 0, 0);
            g.fillStyle = DISTRICTS[k].color;
            g.fillText(DISTRICTS[k].name.toUpperCase(), 0, 0);
            g.restore();
        }
        const tgt = this.G.missions.target();
        if (tgt) {
            const p = route(P.x, P.z, tgt[0], tgt[1]);
            g.lineJoin = 'round';
            g.strokeStyle = '#1a0b00';
            g.lineWidth = 13;
            g.beginPath();
            p.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z)));
            g.stroke();
            g.strokeStyle = '#ffd84a';
            g.lineWidth = 8;
            g.stroke();
        }
        // Golden Conches still to find: small gold shells, so the side hunt reads on the map
        const shells = this.G.missions.shells;
        SIDE.shells.forEach(([x, z], i) => {
            if (!shells.has(i)) {
                g.fillStyle = '#ffcf3a';
                g.strokeStyle = '#3a2400';
                g.lineWidth = 2.5;
                g.beginPath();
                g.moveTo(x, z - 9);
                g.lineTo(x + 8, z + 6);
                g.lineTo(x - 8, z + 6);
                g.closePath();
                g.fill();
                g.stroke();
            }
        });
        for (const b of this.blips()) this.icon(g, b.x, b.z, b.color, b.label, (b.r || 7) * 1.9);
        // named pins: each shop, the garage, the safehouse and the next job get a readable tag
        const cur = this.G.missions.current(),
            tags = [
                ['guns', 'GUNS', '#ff7a59'],
                ['sully', 'GARAGE', '#48e39a'],
                ['safehouse', 'SAFEHOUSE', '#ffffff']
            ];
        if (cur && !this.G.missions.active) tags.push([cur.giver, 'JOB · ' + cur.title.toUpperCase(), '#ffd84a']);
        // larger tags (24 px world type): the pause map is often seen shrunk, and the names must still read
        g.font = '900 24px "Segoe UI", sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        for (const [k, text, col] of tags) {
            const [x, z] = PLACES[k], w = g.measureText(text).width + 18, tx = Math.min(x + 18, SIZE + 20 - w);
            g.fillStyle = 'rgba(14,8,28,0.9)';
            g.fillRect(tx, z - 16, w, 32);
            g.fillStyle = col;
            g.fillRect(tx, z - 16, 6, 32);
            g.fillText(text, tx + 12, z + 1);
        }
        g.translate(P.x, P.z);
        g.rotate(-P.heading);
        g.fillStyle = '#fff';
        g.strokeStyle = '#111';
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(0, -12);
        g.lineTo(9, 10);
        g.lineTo(0, 5);
        g.lineTo(-9, 10);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
    }
}