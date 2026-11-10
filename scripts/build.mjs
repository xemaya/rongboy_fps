// Bundles the lakeside demo (engine + three.js + demo code) into one self-contained HTML file: dist/lakeside.html
//   node scripts/build.mjs            build once
//   node scripts/build.mjs --serve    rebuild on change and serve it (port 5173, or the next free one)
import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serve = process.argv.includes('--serve');
const outFile = path.join(root, 'dist/lakeside.html');

async function emit(js) {
  const html = await readFile(path.join(root, 'demo/lakeside/index.html'), 'utf8');
  await mkdir(path.dirname(outFile), { recursive: true });
  // a function replacement keeps `$` sequences in the bundle literal
  const page = html.replace('/*__BUNDLE__*/', () => js.replace(/<\/script/g, '<\\/script'));
  await writeFile(outFile, page);
  // The same page as a fragment (no doctype / html / head / body) for hosts that wrap it in their own skeleton.
  const head = page.slice(page.indexOf('<title>'), page.indexOf('</style>') + 8);
  const body = page.slice(page.indexOf('<body>') + 6, page.lastIndexOf('</body>'));
  const fragment = head.replace('</title>', '</title>\n<meta name="claude:viewport-fit-sides" content="cover">') + body;
  await writeFile(outFile.replace(/\.html$/, '.fragment.html'), fragment);
  console.log(`[build] ${path.relative(root, outFile)}  ${(Buffer.byteLength(js) / 1024).toFixed(0)} kB of script`);
}
const options = {
  entryPoints: [path.join(root, 'demo/lakeside/main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: !serve,
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
  plugins: [
    {
      name: 'inline-html',
      setup(build) {
        build.onEnd(async (res) => {
          if (res.errors.length || !res.outputFiles) return;
          await emit(res.outputFiles[0].text);
        });
      },
    },
  ],
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const server = createServer(async (req, res) => {
    try {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(await readFile(outFile));
    } catch {
      res.writeHead(503).end('building');
    }
  });
  // 5173 is often taken by another dev server: walk up until a free port is found
  let port = Number(process.env.PORT) || 5173;
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && port < 5200) server.listen(++port, '127.0.0.1');
    else throw e;
  });
  server.on('listening', () => console.log(`[serve] http://localhost:${port}/lakeside.html`));
  server.listen(port, '127.0.0.1');
} else {
  await esbuild.build(options);
}
