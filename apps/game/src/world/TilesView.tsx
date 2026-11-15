import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { GoogleCloudAuthPlugin, ReorientationPlugin } from '3d-tiles-renderer/plugins';
import { TilesAttributionOverlay, TilesPlugin, TilesRenderer } from '3d-tiles-renderer/r3f';

/** Sony World junction, Koramangala. */
const LAT = 12.9368;
const LON = 77.6266;
const DEG = Math.PI / 180;

/**
 * Prototype viewer for Google Photorealistic 3D Tiles (Map Tiles API).
 * Needs VITE_GOOGLE_MAPS_API_KEY at build time. Tiles are streamed live from
 * Google and never stored, and the attribution overlay must stay visible:
 * both are conditions of the Map Tiles API terms.
 */
export function TilesView() {
  const apiToken = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  // Stable references: a new args object would re-create the plugin and drop loaded tiles.
  const authArgs = useMemo(
    () => [{ apiToken: apiToken ?? '', autoRefreshToken: true }],
    [apiToken],
  );
  const originArgs = useMemo(() => [{ lat: LAT * DEG, lon: LON * DEG, height: 830 }], []);
  if (!apiToken) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="max-w-md">
          <h1 className="font-display text-4xl font-black uppercase italic">3D Tiles prototype</h1>
          <p className="mt-4 text-sm text-paper/70">
            This view needs a Google Maps Platform key with the Map Tiles API enabled, set as{' '}
            <code className="text-auto">VITE_GOOGLE_MAPS_API_KEY</code> in the Vercel project, then
            a redeploy.
          </p>
        </div>
      </div>
    );
  }
  return (
    <Canvas
      className="!absolute inset-0"
      camera={{ fov: 55, near: 1, far: 20000, position: [-250, 220, 420] }}
    >
      <color attach="background" args={['#a9cfe8']} />
      <ambientLight intensity={2.2} />
      <TilesRenderer key={apiToken}>
        <TilesPlugin plugin={GoogleCloudAuthPlugin} args={authArgs} />
        <TilesPlugin plugin={ReorientationPlugin} args={originArgs} />
        <TilesAttributionOverlay />
      </TilesRenderer>
      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / 2 - 0.05}
        maxDistance={3000}
      />
    </Canvas>
  );
}
