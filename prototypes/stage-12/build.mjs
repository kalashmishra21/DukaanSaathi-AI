import { build } from 'esbuild';

await build({
  entryPoints: ['core-three.js', 'liquid-preview.js'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2022'],
  outdir: '.',
  entryNames: '[name].bundle',
  legalComments: 'linked',
});
