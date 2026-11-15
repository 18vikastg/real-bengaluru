# tools/assets

Asset compression pipeline (starts in M1): gltf-transform with Meshopt/Draco
geometry compression and KTX2 textures, plus a size budget check so the first
download stays under 25 MB.
