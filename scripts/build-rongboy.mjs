import {build} from 'esbuild';
await build({entryPoints:['scenes/rongboy/rules-entry.ts'],bundle:true,format:'esm',outfile:'scenes/rongboy/rules.js',define:{'import.meta.env.BASE_URL':'"./"'},logLevel:'warning'});
await import('./build.mjs');
