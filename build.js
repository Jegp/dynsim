import * as esbuild from 'esbuild';

// ESM bundle
await esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/dynsim.esm.js',
  minify: true,
  sourcemap: true,
});

// UMD-style IIFE bundle (for <script> tag / CDN)
// Auto-calls autoInit() so it works as a drop-in replacement
// for the original dynamical_systems.js
await esbuild.build({
  entryPoints: ['src/umd-entry.js'],
  bundle: true,
  format: 'iife',
  globalName: 'DynSim',
  outfile: 'dist/dynsim.umd.js',
  minify: true,
  sourcemap: true,
});

console.log('Build complete: dist/dynsim.esm.js, dist/dynsim.umd.js');
