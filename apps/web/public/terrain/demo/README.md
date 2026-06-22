# Railway3D Synthetic Terrain Fixture

`0/0/0.png` is a generated Terrarium-style DEM tile for the PR-004 map shell.
It is fully synthetic and does not contain real-world elevation data. Regenerate
it with:

```bash
node apps/web/scripts/generate-synthetic-terrain.mjs
```

The tile exists only to verify same-origin terrain loading, attribution, WebGL
context handling, GitHub Pages base paths, and flat-map fallback behavior.
