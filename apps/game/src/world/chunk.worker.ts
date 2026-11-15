/// <reference lib="webworker" />
import type { ChunkData, ChunkMeshes } from '@blr/engine';
import { buildChunkMeshes } from '@blr/engine';

export interface ChunkRequest {
  key: string;
  url: string;
}
export type ChunkResponse =
  | { key: string; ok: true; meshes: ChunkMeshes; cx: number; cz: number }
  | { key: string; ok: false; error: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async (event: MessageEvent<ChunkRequest>) => {
  const { key, url } = event.data;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const chunk = (await response.json()) as ChunkData;
    const meshes = buildChunkMeshes(chunk);
    const transfer: ArrayBuffer[] = [
      meshes.trees.buffer as ArrayBuffer,
      meshes.tanks.buffer as ArrayBuffer,
    ];
    for (const mesh of [meshes.walls, meshes.solid, meshes.ground]) {
      transfer.push(
        mesh.position.buffer as ArrayBuffer,
        mesh.normal.buffer as ArrayBuffer,
        mesh.color.buffer as ArrayBuffer,
        mesh.index.buffer as ArrayBuffer,
      );
      if (mesh.uv) transfer.push(mesh.uv.buffer as ArrayBuffer);
    }
    const message: ChunkResponse = { key, ok: true, meshes, cx: chunk.cx, cz: chunk.cz };
    scope.postMessage(message, transfer);
  } catch (error) {
    const message: ChunkResponse = { key, ok: false, error: String(error) };
    scope.postMessage(message);
  }
};
