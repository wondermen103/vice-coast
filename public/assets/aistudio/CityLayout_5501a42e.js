// CityLayout: Puerto Celeste's grid, districts, street names, lots and GPS routes (x east, z south, sea west).
export const BLOCK = 72,
    ROAD = 16,
    GRID = 8,
    LANE = 3.6,
    WALK = 4;
export const SIZE = GRID * BLOCK; // 576 m from the Malecón to Muelle Way
export const BEACH_W = 56,
    SEA_X = -ROAD / 2 - BEACH_W; // sand from x=-8 to x=-64, sea beyond
export const PIER_Z = 3 * BLOCK + 36; // the Faro Celeste pier, between Calle Brisa and Avenida Sol

export const DISTRICTS = {
    malecon: {
        name: 'Malecón Celeste',
        color: '#f7a072',
        map: '#f3c9a6'
    },
    heights: {
        name: 'Palm Heights',
        color: '#7ccf8a',
        map: '#c9e6b5'
    },
    downtown: {
        name: 'Downtown Cristal',
        color: '#6fc3ff',
        map: '#bcd3e6'
    },
    neon: {
        name: 'Neon Row',
        color: '#ff4fd8',
        map: '#e2bfe0'
    },
    port: {
        name: 'Old Port',
        color: '#ffc04a',
        map: '#d8cbb4'
    },
    beach: {
        name: 'Playa Celeste',
        color: '#ffe08a',
        map: '#f2dfa6'
    },
};

export const AVENUES = ['Paseo del Malecón', 'Avenida Coral', 'Calle Ventana', 'Avenida Cristal', 'Calle Luna', 'Avenida Faro', 'Calle Ancla', 'Dockside Road', 'Muelle Way'];
export const STREETS = ['Calle Norte', 'Palm Drive', 'Avenida Sol', 'Calle Brisa', 'Calle Marea', 'Calle Neón', 'Avenida Ola', 'Calle Sur', 'Harbor Road'];

export function blockDistrict(bx, bz) {
    if (bx >= 6) return 'port';
    if (bz <= 1) return 'heights';
    if (bx <= 1) return 'malecon';
    if (bz >= 5) return 'neon';
    return 'downtown';
}

export function districtAt(x, z) {
    if (x < -ROAD / 2) return 'beach';
    const bx = Math.max(0, Math.min(GRID - 1, Math.floor(x / BLOCK))),
        bz = Math.max(0, Math.min(GRID - 1, Math.floor(z / BLOCK)));
    return blockDistrict(bx, bz);
}

export function streetAt(x, z) {
    const kx = Math.round(x / BLOCK),
        kz = Math.round(z / BLOCK);
    const dx = Math.abs(x - kx * BLOCK),
        dz = Math.abs(z - kz * BLOCK);
    if (dx < dz && kx >= 0 && kx <= GRID) return AVENUES[kx];
    if (kz >= 0 && kz <= GRID) return STREETS[kz];
    return AVENUES[0];
}

// Every city block: its rectangle inside the sidewalks and its district.
export function lots() {
    const out = [];
    for (let bx = 0; bx < GRID; bx++)
        for (let bz = 0; bz < GRID; bz++) {
            const x0 = bx * BLOCK + ROAD / 2,
                z0 = bz * BLOCK + ROAD / 2;
            out.push({
                bx,
                bz,
                x0,
                z0,
                x1: x0 + BLOCK - ROAD,
                z1: z0 + BLOCK - ROAD,
                district: blockDistrict(bx, bz)
            });
        }
    return out;
}

export function onRoad(x, z) {
    const fx = Math.abs(x - Math.round(x / BLOCK) * BLOCK),
        fz = Math.abs(z - Math.round(z / BLOCK) * BLOCK);
    const inside = x > -ROAD / 2 && x < SIZE + ROAD / 2 && z > -ROAD / 2 && z < SIZE + ROAD / 2;
    return inside && (fx < ROAD / 2 || fz < ROAD / 2);
}

// Nearest point on a road centre line, with the axis it runs along.
export function nearestRoad(x, z) {
    const kx = Math.max(0, Math.min(GRID, Math.round(x / BLOCK))),
        kz = Math.max(0, Math.min(GRID, Math.round(z / BLOCK)));
    const cz = Math.max(0, Math.min(SIZE, z)),
        cx = Math.max(0, Math.min(SIZE, x));
    const a = {
            x: kx * BLOCK,
            z: cz,
            axis: 'z',
            k: kx
        },
        b = {
            x: cx,
            z: kz * BLOCK,
            axis: 'x',
            k: kz
        };
    return Math.hypot(a.x - x, a.z - z) < Math.hypot(b.x - x, b.z - z) ? a : b;
}

// GPS: breadth-first search over the 9x9 intersections, returned as world points.
export function route(fx, fz, tx, tz) {
    const s = nearestRoad(fx, fz),
        t = nearestRoad(tx, tz);
    const node = (x, z) => [Math.max(0, Math.min(GRID, Math.round(x / BLOCK))), Math.max(0, Math.min(GRID, Math.round(z / BLOCK)))];
    const [sx, sz] = node(s.x, s.z), [ex, ez] = node(t.x, t.z);
    const key = (a, b) => a * 16 + b,
        prev = new Map([
            [key(sx, sz), null]
        ]),
        q = [
            [sx, sz]
        ];
    while (q.length) {
        const [a, b] = q.shift();
        if (a === ex && b === ez) break;
        for (const [da, db] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ]) {
            const na = a + da,
                nb = b + db;
            if (na < 0 || nb < 0 || na > GRID || nb > GRID || prev.has(key(na, nb))) continue;
            prev.set(key(na, nb), [a, b]);
            q.push([na, nb]);
        }
    }
    const pts = [
        [t.x, t.z]
    ];
    let cur = [ex, ez];
    while (cur) {
        pts.push([cur[0] * BLOCK, cur[1] * BLOCK]);
        cur = prev.get(key(cur[0], cur[1]));
    }
    pts.push([s.x, s.z], [fx, fz]);
    return pts.reverse();
}