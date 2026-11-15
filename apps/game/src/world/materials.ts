import { TREE_COLORS } from '@blr/engine';
import * as THREE from 'three';

/** Draws the repeating facade tile: a 4 x 4 grid of windows on a white wall (tinted per building by vertex colour). */
function facadeTextures(): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
  const size = 1024;
  const cell = size / 4;
  const base = document.createElement('canvas');
  const glow = document.createElement('canvas');
  base.width = base.height = glow.width = glow.height = size;
  const b = base.getContext('2d');
  const g = glow.getContext('2d');
  if (!b || !g) throw new Error('2D canvas is unavailable');

  b.fillStyle = '#ffffff';
  b.fillRect(0, 0, size, size);
  g.fillStyle = '#000000';
  g.fillRect(0, 0, size, size);

  // Fixed pattern so the look is identical on every run.
  const lit = [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1];
  const glass = ['#33414f', '#2c3947', '#3b4a59', '#303d4a'];
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      const x = column * cell + cell * 0.24;
      const y = row * cell + cell * 0.2;
      const w = cell * 0.52;
      const h = cell * 0.5;
      // Floor line between storeys.
      b.fillStyle = '#e4e0d8';
      b.fillRect(column * cell, row * cell + cell - 10, cell, 10);
      // Frame, glass, mullion, sill.
      b.fillStyle = '#d2cec4';
      b.fillRect(x - 8, y - 8, w + 16, h + 16);
      b.fillStyle = glass[(row * 3 + column) % glass.length] as string;
      b.fillRect(x, y, w, h);
      b.fillStyle = '#c9c5bb';
      b.fillRect(x + w / 2 - 4, y, 8, h);
      b.fillStyle = '#bdb8ad';
      b.fillRect(x - 16, y + h + 8, w + 32, 12);
      if (lit[row * 4 + column]) {
        g.fillStyle = (row + column) % 2 ? '#ffd28a' : '#ffe4b0';
        g.fillRect(x, y, w, h);
      }
    }
  }

  const finish = (canvas: HTMLCanvasElement) => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  };
  return { map: finish(base), emissiveMap: finish(glow) };
}

export interface WorldMaterials {
  wall: THREE.MeshStandardMaterial;
  solid: THREE.MeshStandardMaterial;
  ground: THREE.MeshStandardMaterial;
  trunk: THREE.MeshStandardMaterial;
  canopy: THREE.MeshStandardMaterial;
  tank: THREE.MeshStandardMaterial;
  trunkGeometry: THREE.BufferGeometry;
  canopyGeometry: THREE.BufferGeometry;
  tankGeometry: THREE.BufferGeometry;
  treeColors: THREE.Color[];
  dispose: () => void;
}

export function createWorldMaterials(): WorldMaterials {
  const { map, emissiveMap } = facadeTextures();
  const wall = new THREE.MeshStandardMaterial({
    map,
    emissiveMap,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0,
    vertexColors: true,
    roughness: 0.88,
  });
  const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const ground = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const trunk = new THREE.MeshStandardMaterial({ color: '#5b4331', roughness: 1 });
  const canopy = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const tank = new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.5 });
  // Unit-sized geometry; instances scale it.
  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.26, 1, 6).translate(0, 0.5, 0);
  const canopyGeometry = new THREE.IcosahedronGeometry(1, 1);
  const tankGeometry = new THREE.CylinderGeometry(0.75, 0.75, 1.5, 10).translate(0, 1.15, 0);
  const all = [
    wall,
    solid,
    ground,
    trunk,
    canopy,
    tank,
    trunkGeometry,
    canopyGeometry,
    tankGeometry,
    map,
    emissiveMap,
  ];
  return {
    wall,
    solid,
    ground,
    trunk,
    canopy,
    tank,
    trunkGeometry,
    canopyGeometry,
    tankGeometry,
    treeColors: TREE_COLORS.map((hex) => new THREE.Color(hex)),
    dispose: () => all.forEach((resource) => resource.dispose()),
  };
}
