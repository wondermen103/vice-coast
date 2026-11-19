// MeshKit: merged, vertex-coloured geometry with automatic world-scaled UVs for crisp procedural PBR tiling.
import * as THREE from 'three';

const _v = new THREE.Vector3();

export interface BoxOpts {
  tx?: number;
  tz?: number;
  sx?: number;
  sz?: number;
  rotY?: number;
  m?: THREE.Matrix4;
  uvScale?: number;
}

export interface CylOpts {
  axisX?: boolean;
  open?: boolean;
  capColor?: [number, number, number];
  m?: THREE.Matrix4;
  uvScale?: number;
}

export class MeshKit {
  public pos: number[] = [];
  public nor: number[] = [];
  public col: number[] = [];
  public uvs: number[] = [];
  public idx: number[] = [];

  face(
    a: number[],
    b: number[],
    c: number[],
    d: number[] | null,
    color: number[],
    center: number[],
    uvScale = 0.25,
  ): void {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const m = d
      ? [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2]
      : [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const pts = d ? [a, b, c, d] : [a, b, c];
    if (
      n[0] * (m[0] - center[0]) +
        n[1] * (m[1] - center[1]) +
        n[2] * (m[2] - center[2]) <
      0
    ) {
      pts.reverse();
      n = [-n[0], -n[1], -n[2]];
    }
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    const nx = n[0] / l;
    const ny = n[1] / l;
    const nz = n[2] / l;
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);

    const base = this.pos.length / 3;
    for (const p of pts) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.col.push(color[0], color[1], color[2]);
      // Triplanar world-scaled UV so tiled PBR textures never stretch
      if (ay >= ax && ay >= az) {
        this.uvs.push(p[0] * uvScale, p[2] * uvScale);
      } else if (ax >= az) {
        this.uvs.push(p[2] * uvScale, p[1] * uvScale);
      } else {
        this.uvs.push(p[0] * uvScale, p[1] * uvScale);
      }
    }
    this.idx.push(base, base + 1, base + 2);
    if (d) this.idx.push(base, base + 2, base + 3);
  }

  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number[],
    o: BoxOpts = {},
  ): this {
    const tx = o.tx ?? 1;
    const tz = o.tz ?? 1;
    const sz = o.sz ?? 0;
    const sx = o.sx ?? 0;
    const uvs = o.uvScale ?? 0.25;
    const c: number[][] = [];
    for (let i = 0; i < 8; i++) {
      const xi = i & 1 ? 1 : -1;
      const yi = i & 2 ? 1 : -1;
      const zi = i & 4 ? 1 : -1;
      const top = yi > 0;
      let p = [
        ((xi * w) / 2) * (top ? tx : 1) + (top ? sx : 0),
        (yi * h) / 2,
        ((zi * d) / 2) * (top ? tz : 1) + (top ? sz : 0),
      ];
      if (o.rotY) {
        const cs = Math.cos(o.rotY);
        const sn = Math.sin(o.rotY);
        p = [p[0] * cs + p[2] * sn, p[1], -p[0] * sn + p[2] * cs];
      }
      p = [p[0] + x, p[1] + y, p[2] + z];
      if (o.m) {
        _v.set(p[0], p[1], p[2]).applyMatrix4(o.m);
        p = [_v.x, _v.y, _v.z];
      }
      c.push(p);
    }
    let ctr = [x, y, z];
    if (o.m) {
      _v.set(x, y, z).applyMatrix4(o.m);
      ctr = [_v.x, _v.y, _v.z];
    }
    const q = (a: number, b: number, cc: number, dd: number) =>
      this.face(c[a], c[b], c[cc], c[dd], color, ctr, uvs);
    q(0, 1, 3, 2);
    q(4, 5, 7, 6);
    q(0, 1, 5, 4);
    q(2, 3, 7, 6);
    q(0, 2, 6, 4);
    q(1, 3, 7, 5);
    return this;
  }

  cyl(
    x: number,
    y: number,
    z: number,
    rt: number,
    rb: number,
    h: number,
    seg: number,
    color: number[],
    o: CylOpts = {},
  ): this {
    const uvs = o.uvScale ?? 0.25;
    const ring = (r: number, yy: number) => {
      const out: number[][] = [];
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        let p = [Math.cos(a) * r, yy, Math.sin(a) * r];
        if (o.axisX) p = [p[1], p[0], p[2]];
        if (o.m) {
          _v.set(p[0], p[1], p[2]).applyMatrix4(o.m);
          p = [_v.x, _v.y, _v.z];
        }
        out.push([p[0] + x, p[1] + y, p[2] + z]);
      }
      return out;
    };
    const b = ring(rb, -h / 2);
    const t = ring(rt, h / 2);
    let ctr = [x, y, z];
    if (o.m) {
      _v.set(0, 0, 0).applyMatrix4(o.m);
      ctr = [_v.x + x, _v.y + y, _v.z + z];
    }
    const cb = o.axisX ? [x - h / 2, y, z] : [x, y - h / 2, z];
    const ct = o.axisX ? [x + h / 2, y, z] : [x, y + h / 2, z];
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      this.face(b[i], b[j], t[j], t[i], color, ctr, uvs);
      if (!o.open) {
        this.face(cb, b[i], b[j], null, o.capColor || color, ct, uvs);
        this.face(ct, t[i], t[j], null, o.capColor || color, cb, uvs);
      }
    }
    return this;
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

export const rgb = (hex: string, k = 1): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r * k, c.g * k, c.b * k];
};
