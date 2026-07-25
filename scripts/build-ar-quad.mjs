// Generates public/ar/card-quad.gltf — the ONE generic model L1 AR reuses for
// every dancer. It's a card-proportioned (5:7), metric, unlit quad standing on
// the ground plane (bottom edge at y=0), with a 1×1 placeholder base-color
// texture. At runtime <model-viewer> swaps that texture for the dancer's
// /u/<handle>/card/ar-image PNG, so there are zero per-user assets. Re-run with:
//   node scripts/build-ar-quad.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'ar', 'card-quad.gltf');

// Metric card: 0.30 m wide × 0.42 m tall (5:7), standing upright, facing +Z.
const HW = 0.15; // half-width
const H = 0.42; // height

// 4 verts (x,y,z), 4 uvs (u,v; glTF v runs top→bottom), 2 triangles.
const positions = [-HW, 0, 0, HW, 0, 0, HW, H, 0, -HW, H, 0];
const uvs = [0, 1, 1, 1, 1, 0, 0, 0];
const indices = [0, 1, 2, 0, 2, 3];

const posBuf = Buffer.alloc(positions.length * 4);
positions.forEach((v, i) => posBuf.writeFloatLE(v, i * 4));
const uvBuf = Buffer.alloc(uvs.length * 4);
uvs.forEach((v, i) => uvBuf.writeFloatLE(v, i * 4));
const idxBuf = Buffer.alloc(indices.length * 2);
indices.forEach((v, i) => idxBuf.writeUInt16LE(v, i * 2));

const bin = Buffer.concat([posBuf, uvBuf, idxBuf]);
const posOff = 0;
const uvOff = posBuf.length;
const idxOff = posBuf.length + uvBuf.length;

// 1×1 opaque-white PNG placeholder (swapped at runtime).
const WHITE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const gltf = {
  asset: { version: '2.0', generator: 'tangomap build-ar-quad' },
  extensionsUsed: ['KHR_materials_unlit'],
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'card' }],
  meshes: [
    {
      name: 'card',
      primitives: [
        { attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0, mode: 4 },
      ],
    },
  ],
  materials: [
    {
      name: 'card',
      doubleSided: true,
      extensions: { KHR_materials_unlit: {} },
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
        baseColorTexture: { index: 0 },
      },
    },
  ],
  textures: [{ sampler: 0, source: 0 }],
  images: [{ uri: `data:image/png;base64,${WHITE_PNG}` }],
  samplers: [{ magFilter: 9729, minFilter: 9729, wrapS: 33071, wrapT: 33071 }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [-HW, 0, 0], max: [HW, H, 0] },
    { bufferView: 1, componentType: 5126, count: 4, type: 'VEC2' },
    { bufferView: 2, componentType: 5123, count: 6, type: 'SCALAR' },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: posOff, byteLength: posBuf.length, target: 34962 },
    { buffer: 0, byteOffset: uvOff, byteLength: uvBuf.length, target: 34962 },
    { buffer: 0, byteOffset: idxOff, byteLength: idxBuf.length, target: 34963 },
  ],
  buffers: [{ byteLength: bin.length, uri: `data:application/octet-stream;base64,${bin.toString('base64')}` }],
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(gltf));
console.log(`wrote ${OUT} (${bin.length} B geometry)`);
