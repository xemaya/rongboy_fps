// Bundles each page (engine + library + three.js + page code) into one self-contained HTML file in dist/.
//   node scripts/build.mjs                  build every page
//   node scripts/build.mjs lakeside         build one page
//   node scripts/build.mjs --serve [page]   rebuild on change and serve dist/ (port 5173, or the next free one)
//   node scripts/build.mjs --serve --port 5192 [page]   same, on a fixed port
// A page is a folder with main.js + index.html: scenes/<name>/ or tools/<name>/ (tools/showcase).
import * as esbuild from 'esbuild';
import { readFile, writeFile, rename, mkdir, readdir, stat, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const serve = args.includes('--serve');
// --port <n> pins the dev-server port (same as PORT=<n>); its value is not a page name
const portAt = args.indexOf('--port');
const portArg = portAt >= 0 ? Number(args[portAt + 1]) : 0;
const only = args.filter((a, i) => !a.startsWith('--') && (portAt < 0 || i !== portAt + 1));

async function pages() {
  const out = [];
  for (const dir of ['scenes', 'tools']) {
    const base = path.join(root, dir);
    if (!existsSync(base)) continue;
    for (const name of await readdir(base)) {
      const p = path.join(base, name);
      if ((await stat(p)).isDirectory() && existsSync(path.join(p, 'main.js')) && existsSync(path.join(p, 'index.html'))) out.push({ name, dir: p });
    }
  }
  return only.length ? out.filter((p) => only.includes(p.name)) : out;
}

let emitSequence = 0;
async function atomicWrite(file, content) {
  const temp = file + '.' + process.pid + '.' + emitSequence++ + '.tmp';
  await writeFile(temp, content);
  await rename(temp, file);
}

async function emit(page, js) {
  const outFile = path.join(root, 'dist', page.name + '.html');
  const html = await readFile(path.join(page.dir, 'index.html'), 'utf8');
  await mkdir(path.dirname(outFile), { recursive: true });
  // a function replacement keeps `$` sequences in the bundle literal
  const full = html.replace('/*__BUNDLE__*/', () => js.replace(/<\/script/g, '<\\/script'));
  await atomicWrite(outFile, full);
  // The same page as a fragment (no doctype / html / head / body) for hosts that wrap it in their own skeleton.
  const head = full.slice(full.indexOf('<title>'), full.indexOf('</style>') + 8);
  const body = full.slice(full.indexOf('<body>') + 6, full.lastIndexOf('</body>'));
  const fragment = head.replace('</title>', '</title>\n<meta name="claude:viewport-fit-sides" content="cover">') + body;
  await atomicWrite(outFile.replace(/\.html$/, '.fragment.html'), fragment);
  // A page may list extra files to place next to it (copy.json: ["assets/.../file", ...], paths from the repo root),
  // e.g. the opening film's pre-rendered mp4. Missing files are skipped: the page has to cope without them.
  const copyList = path.join(page.dir, 'copy.json');
  if (existsSync(copyList)) for (const rel of JSON.parse(await readFile(copyList, 'utf8'))) {
    const from = path.join(root, rel);
    if (existsSync(from)) await copyFile(from, path.join(root, 'dist', path.basename(rel)));
  }
  console.log(`[build] ${path.relative(root, outFile)}  ${(Buffer.byteLength(js) / 1024).toFixed(0)} kB of script`);
}

const options = (page) => ({
  entryPoints: [path.join(page.dir, 'main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  loader: { '.glb': 'binary', '.mp3': 'binary' },
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
          await emit(page, res.outputFiles[0].text);
        });
      },
    },
  ],
});

const list = await pages();
if (!list.length) throw new Error('no page matches ' + only.join(', '));
if (serve) {
  for (const p of list) await (await esbuild.context(options(p))).watch();
  const server = createServer(async (req, res) => {
    const name = decodeURIComponent((req.url || '/').split('?')[0].replace(/^\/+/, '')) || list[0].name + '.html';
    // POST /__shot?name=<n> with a JPEG data URL as the body: saved to shots/<n>.jpg (gitignored). Pages use it to
    // hand a canvas frame to whoever is checking the picture when the browser window itself cannot be captured.
    if (req.method === 'POST' && name === '__shot') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const shot = (new URL(req.url, 'http://x').searchParams.get('name') || 'shot').replace(/[^\w.-]/g, '_');
      await mkdir(path.join(root, 'shots'), { recursive: true });
      await writeFile(path.join(root, 'shots', shot + '.jpg'), Buffer.from(Buffer.concat(chunks).toString().replace(/^data:image\/\w+;base64,/, ''), 'base64'));
      res.writeHead(200).end('ok');
      return;
    }
    try {
      const file = path.join(root, 'dist', path.basename(name));
      const html = await readFile(file);
      // dist/ also holds the opening film's mp4: answer range requests so the <video> element can seek
      if (file.endsWith('.mp4')) {
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || ''), a = m && m[1] ? +m[1] : 0, b = m && m[2] ? Math.min(+m[2], html.length - 1) : html.length - 1;
        res.writeHead(m ? 206 : 200, { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-length': b - a + 1, ...(m ? { 'content-range': `bytes ${a}-${b}/${html.length}` } : {}) });
        res.end(html.subarray(a, b + 1));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(html);
    } catch {
      res.writeHead(404).end('not built: ' + name);
    }
  });
  // 5173 is often taken by another dev server: walk up until a free port is found
  let port = portArg || Number(process.env.PORT) || 5173;
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && port < 5200) server.listen(++port, '127.0.0.1');
    else throw e;
  });
  server.on('listening', () => console.log(list.map((p) => `[serve] http://localhost:${port}/${p.name}.html`).join('\n')));
  server.listen(port, '127.0.0.1');
} else {
  for (const p of list) await esbuild.build(options(p));
}
