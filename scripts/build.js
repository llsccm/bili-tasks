import * as esbuild from 'esbuild'

const result = await esbuild.build({
  entryPoints: {
    bilitask: 'src/index.ts',
    login: 'src/login.ts'
  },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  charset: 'utf8',
  metafile: true
})

console.log(await esbuild.analyzeMetafile(result.metafile))
