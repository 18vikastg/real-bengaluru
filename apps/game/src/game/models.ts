import type { NpcLook } from '@blr/content';
import * as THREE from 'three';

/**
 * Low-poly people, autos and street furniture, built from primitives. One
 * kit owns every geometry, material and texture it hands out, so the whole
 * lot can be disposed together.
 */
export interface Figure {
  group: THREE.Group;
  legs: [THREE.Object3D, THREE.Object3D];
  arms: [THREE.Object3D, THREE.Object3D];
}

export class ModelKit {
  private readonly owned: { dispose: () => void }[] = [];
  private readonly colours = new Map<string, THREE.MeshStandardMaterial>();

  private readonly leg = this.own(new THREE.BoxGeometry(0.17, 0.82, 0.2).translate(0, -0.41, 0));
  private readonly arm = this.own(new THREE.BoxGeometry(0.12, 0.6, 0.14).translate(0, -0.28, 0));
  private readonly torso = this.own(new THREE.BoxGeometry(0.46, 0.62, 0.26));
  private readonly head = this.own(new THREE.SphereGeometry(0.15, 14, 10));
  private readonly hair = this.own(
    new THREE.SphereGeometry(0.162, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
  );
  private readonly cap = this.own(new THREE.CylinderGeometry(0.165, 0.175, 0.09, 14));
  private readonly brim = this.own(new THREE.BoxGeometry(0.2, 0.025, 0.14));
  private readonly bag = this.own(new THREE.BoxGeometry(0.34, 0.42, 0.16));
  private readonly box = this.own(new THREE.BoxGeometry(1, 1, 1));
  private readonly wheel = this.own(
    new THREE.CylinderGeometry(0.25, 0.25, 0.14, 14).rotateZ(Math.PI / 2),
  );
  private readonly pole = this.own(new THREE.CylinderGeometry(0.06, 0.06, 1, 8));
  private readonly gem = this.own(new THREE.OctahedronGeometry(0.16));
  private readonly beam = this.own(new THREE.CylinderGeometry(2.6, 2.6, 1, 24, 1, true));
  private readonly ring = this.own(new THREE.RingGeometry(2.4, 3.2, 32).rotateX(-Math.PI / 2));

  private own<T extends { dispose: () => void }>(resource: T): T {
    this.owned.push(resource);
    return resource;
  }

  colour(hex: string, emissive = 0): THREE.MeshStandardMaterial {
    const key = `${hex}:${emissive}`;
    let material = this.colours.get(key);
    if (!material) {
      material = this.own(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85 }));
      if (emissive > 0) {
        material.emissive.set(hex);
        material.emissiveIntensity = emissive;
      }
      this.colours.set(key, material);
    }
    return material;
  }

  private part(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    scale?: [number, number, number],
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true;
    return mesh;
  }

  /** A person about 1.75 m tall, facing +z. Legs and arms pivot at hip and shoulder. */
  figure(look: NpcLook, backpack = false): Figure {
    const group = new THREE.Group();
    const trousers = this.colour(look.trousers);
    const shirt = this.colour(look.shirt);
    const skin = this.colour(look.skin);
    const legs: [THREE.Object3D, THREE.Object3D] = [
      this.part(this.leg, trousers, -0.12, 0.82, 0),
      this.part(this.leg, trousers, 0.12, 0.82, 0),
    ];
    const arms: [THREE.Object3D, THREE.Object3D] = [
      this.part(this.arm, shirt, -0.3, 1.42, 0),
      this.part(this.arm, shirt, 0.3, 1.42, 0),
    ];
    group.add(...legs, ...arms);
    group.add(this.part(this.torso, shirt, 0, 1.13, 0));
    group.add(this.part(this.head, skin, 0, 1.6, 0));
    group.add(this.part(this.hair, this.colour(look.hair), 0, 1.615, -0.012));
    if (look.cap) {
      group.add(this.part(this.cap, this.colour(look.cap), 0, 1.74, 0));
      group.add(this.part(this.brim, this.colour(look.cap), 0, 1.705, 0.2));
    }
    if (backpack) group.add(this.part(this.bag, this.colour('#3b3f4a'), 0, 1.16, -0.2));
    return { group, legs, arms };
  }

  /** A three-wheeler, nose towards -z, origin on the ground under its middle. */
  auto(): THREE.Group {
    const group = new THREE.Group();
    const green = this.colour('#1f8a4c');
    const yellow = this.colour('#f5c518');
    const dark = this.colour('#15171c');
    group.add(this.part(this.box, green, 0, 0.66, 0.2, [1.36, 0.72, 2.1]));
    group.add(this.part(this.box, green, 0, 0.6, -1.12, [0.82, 0.6, 0.6]));
    group.add(this.part(this.box, yellow, 0, 1.62, 0.18, [1.44, 0.12, 2.25]));
    group.add(this.part(this.box, yellow, 0, 1.28, 1.18, [1.4, 0.62, 0.1]));
    group.add(this.part(this.box, dark, 0, 1.28, -0.84, [1.2, 0.56, 0.05]));
    for (const x of [-0.66, 0.66]) {
      group.add(this.part(this.box, dark, x, 1.3, -0.84, [0.06, 0.6, 0.06]));
      group.add(this.part(this.box, dark, x, 1.3, 1.16, [0.06, 0.6, 0.06]));
      group.add(this.part(this.wheel, dark, x, 0.25, 0.86));
    }
    group.add(this.part(this.wheel, dark, 0, 0.25, -1.24));
    const lamp = this.part(this.gem, this.colour('#fff2c4', 1.4), 0, 0.78, -1.44, [0.7, 0.7, 0.4]);
    lamp.castShadow = false;
    group.add(lamp);
    return group;
  }

  /** A hatchback, nose towards -z. */
  car(colour: string): THREE.Group {
    const group = new THREE.Group();
    const dark = this.colour('#15171c');
    group.add(this.part(this.box, this.colour(colour), 0, 0.62, 0, [1.7, 0.62, 3.9]));
    group.add(this.part(this.box, dark, 0, 1.18, 0.25, [1.52, 0.52, 2.1]));
    for (const z of [-1.25, 1.3]) {
      for (const x of [-0.82, 0.82])
        group.add(this.part(this.wheel, dark, x, 0.3, z, [1, 1.2, 1.2]));
    }
    return group;
  }

  /** A city bus, nose towards -z. */
  bus(colour: string): THREE.Group {
    const group = new THREE.Group();
    const dark = this.colour('#15171c');
    group.add(this.part(this.box, this.colour('#eceae4'), 0, 1.25, 0, [2.5, 1.5, 10.6]));
    group.add(this.part(this.box, this.colour(colour), 0, 2.5, 0, [2.5, 1.0, 10.6]));
    group.add(this.part(this.box, dark, 0, 2.2, 0, [2.54, 0.75, 9.6]));
    group.add(this.part(this.box, dark, 0, 2.15, -5.28, [2.2, 1.0, 0.08]));
    for (const z of [-3.6, 3.4]) {
      for (const x of [-1.15, 1.15]) {
        group.add(this.part(this.wheel, dark, x, 0.5, z, [1.6, 2, 2]));
      }
    }
    return group;
  }

  /** A stop sign on a pole with its name floating above. */
  sign(colour: string, title: string, subtitle: string): THREE.Group {
    const group = new THREE.Group();
    group.add(this.part(this.pole, this.colour('#3a3d44'), 0, 1.5, 0, [1, 3, 1]));
    group.add(this.part(this.box, this.colour(colour, 0.25), 0, 3.05, 0, [1.7, 0.62, 0.1]));
    const label = this.label(title, subtitle, colour);
    label.position.y = 3.85;
    group.add(label);
    return group;
  }

  /** The little spinning marker over someone you can talk to. */
  marker(): THREE.Mesh {
    const mesh = new THREE.Mesh(this.gem, this.colour('#f5c518', 0.9));
    mesh.position.y = 2.75;
    return mesh;
  }

  /** A pillar of light over a mission destination. */
  beacon(): THREE.Group {
    const group = new THREE.Group();
    const material = this.own(
      new THREE.MeshBasicMaterial({
        color: '#f5c518',
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
      }),
    );
    const beam = new THREE.Mesh(this.beam, material);
    beam.scale.y = 90;
    beam.position.y = 45;
    const ringMaterial = this.own(
      new THREE.MeshBasicMaterial({
        color: '#f5c518',
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        fog: false,
      }),
    );
    const ring = new THREE.Mesh(this.ring, ringMaterial);
    ring.position.y = 0.25;
    group.add(beam, ring);
    return group;
  }

  /** A name card that always faces the camera. */
  label(title: string, subtitle: string, accent = '#f5c518'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 144;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = 'rgba(13, 15, 20, 0.82)';
      context.beginPath();
      context.roundRect(8, 8, 496, 128, 22);
      context.fill();
      context.fillStyle = accent;
      context.fillRect(8, 30, 8, 84);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#f2ede2';
      context.font = '700 50px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      context.fillText(title, 256, subtitle ? 54 : 72, 470);
      if (subtitle) {
        context.fillStyle = 'rgba(242, 237, 226, 0.72)';
        context.font = '500 30px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        context.fillText(subtitle, 256, 104, 470);
      }
    }
    const texture = this.own(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = this.own(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    );
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.3, 0.65, 1);
    return sprite;
  }

  dispose(): void {
    for (const resource of this.owned) resource.dispose();
    this.owned.length = 0;
    this.colours.clear();
  }
}
