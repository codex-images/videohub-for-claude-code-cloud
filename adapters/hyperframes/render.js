// render.js: generic frame-by-frame render script for VideoHub, for player-based projects (Remotion, HyperFrames, ...).
// Follows VideoHub's examples/hello-film/render.js. The page opens in puppeteer-core; for every frame we wait for the
// promise returned by window.renderOut(t) (it resolves only after the player shows that exact frame) and take a screenshot.
// Chunks of 2 seconds are encoded one by one, so a stopped render resumes where it left off. Audio is muxed by
// render.mux in .videohub/project.json.
//   node render.js [workers]      -> render/chunks/c_000.mp4 ...
//   ONLY=2,3 node render.js       -> only chunks 2 and 3
//   PREVIEW=1 node render.js      -> half size, render/preview/video.mp4
//   node render.js snap 1.5 4     -> snaps/<t>.jpg
// Settings (env or .videohub/project.json -> live): FPS, DUR (seconds), VW, VH (page size), AUDIO (mix for standalone runs).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn, spawnSync, execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
function load(name, near) {
  const tries = [() => require(name)];
  for (const d of [process.env.VIDEOHUB_DIR, process.env.VIDEOHUB_HOME, near].filter(Boolean)) tries.push(() => require(require.resolve(name, { paths: [d] })));
  for (const t of tries) { try { return t(); } catch (e) { } }
  return null;
}
function browserPath() {
  const c = [process.env.CHROME, process.env.VIDEOHUB_BROWSER, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
  const f = c.find(x => { try { return fs.statSync(fs.realpathSync(x)).isFile(); } catch { return false; } });
  if (!f) { console.error('no Chrome/Chromium found (set VIDEOHUB_BROWSER)'); process.exit(2); }
  return f;
}
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const PREVIEW = process.env.PREVIEW === '1';
const LIVE = (() => { try { return JSON.parse(fs.readFileSync('.videohub/project.json', 'utf8')).live || {}; } catch { return {}; } })();
const FPS = +(process.env.FPS || LIVE.fps || 30), CH = Math.round(2 * FPS);   // CH = frames per chunk (2 seconds)
const DATA = (() => { try { return JSON.parse(fs.readFileSync('data.json', 'utf8')); } catch { return {}; } })();
const VW = +(process.env.VW || LIVE.w || DATA.width || 1080), VH = +(process.env.VH || LIVE.h || DATA.height || 1920);
const DUR = +(process.env.DUR || LIVE.dur || 10);
const PAGE = process.env.PAGE || 'index.html';
const fps = PREVIEW ? Math.min(FPS, 30) : FPS, scale = PREVIEW ? 0.5 : 1, TOTAL = Math.round(DUR * fps);
const OUT = PREVIEW ? path.resolve('render/preview') : path.resolve('render/chunks');
const ENCODER_ARGS = {
  nvenc: ['-c:v', 'h264_nvenc', '-preset', 'p7', '-tune', 'hq', '-rc', 'vbr', '-cq', '20', '-b:v', '0', '-maxrate', '60M', '-bufsize', '120M'],
  x264: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16'],
};
const probe = args => spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=gray:s=640x360:r=30', '-frames:v', '5', '-pix_fmt', 'yuv420p', ...args, '-f', 'null', '-'], { stdio: 'ignore', timeout: 20000 }).status === 0;
function pickEncoder() {
  const want = String(process.env.VIDEOHUB_ENCODER || 'x264').toLowerCase();
  if (want === 'nvenc' && probe(ENCODER_ARGS.nvenc)) return { name: 'nvenc', args: ENCODER_ARGS.nvenc };
  if (want !== 'x264' && want !== 'auto') console.log(`encoder ${want}: using x264`);
  return { name: 'x264', args: ENCODER_ARGS.x264 };
}
let ENC = null;
function encoder(out) {
  const size = scale !== 1 ? `${Math.round(VW * scale)}:${Math.round(VH * scale)}:flags=bicubic:` : '';
  return spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', ...ENC.args,
    '-vf', `scale=${size}out_color_matrix=bt709:out_range=tv`, '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_range', 'tv', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
}
async function openPage(br) {
  const p = await br.newPage();
  p.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await p.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(path.resolve(PAGE)).href + '?render=1');
  await p.waitForFunction('window.READY === true', { timeout: 180000 });
  const cdp = await p.target().createCDPSession();
  const shot = async (t, format = 'png') => {
    const err = await p.evaluate(async t => { try { await window.renderOut(t); return null; } catch (e) { return String(e.stack || e); } }, t);
    if (err) console.error('t=' + t, err);
    const { data } = await cdp.send('Page.captureScreenshot', { format, ...(format === 'jpeg' ? { quality: 92 } : {}), optimizeForSpeed: true, clip: { x: 0, y: 0, width: VW, height: VH, scale } });
    return Buffer.from(data, 'base64');
  };
  return { page: p, shot };
}
async function shotChunk(w, a, b, tmp, hold) {
  const ff = hold.ff = encoder(tmp), closed = new Promise(r => ff.on('close', r));
  ff.stdin.on('error', () => { });
  for (let f = a; f < b; f++) { const buf = await w.shot(f / fps); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
  ff.stdin.end(); return { ff, code: await closed };
}
(async () => {
  const puppeteer = load('puppeteer-core');
  if (!puppeteer) { console.error('puppeteer-core not found (VIDEOHUB_DIR)'); process.exit(2); }
  const exe = browserPath();
  const launch = () => puppeteer.launch({ executablePath: exe, headless: 'new', protocolTimeout: 0, args: ['--no-sandbox', '--allow-file-access-from-files', '--force-device-scale-factor=1', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'] });
  if (process.argv[2] === 'snap') {
    const br = await launch(), w = await openPage(br); fs.mkdirSync('snaps', { recursive: true });
    for (const a of process.argv.slice(3)) fs.writeFileSync(`snaps/${a}.jpg`, await w.shot(+a, 'jpeg'));
    await br.close(); return;
  }
  const W = Math.max(1, +process.argv[2] || +process.env.WK || 2);
  fs.mkdirSync(OUT, { recursive: true });
  const chunkFrames = PREVIEW ? TOTAL : CH, nCh = Math.ceil(TOTAL / chunkFrames);
  const cf = c => path.join(OUT, `c_${String(c).padStart(3, '0')}.mp4`);
  const only = !PREVIEW && process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
  const queue = []; for (let c = 0; c < nCh; c++) if ((PREVIEW || !fs.existsSync(cf(c))) && (!only || only.includes(c))) queue.push(c);
  console.log(`${queue.length}/${nCh} chunks to render`);
  if (!queue.length) { console.log('done 0s'); return; }
  ENC = pickEncoder(); console.log(`encoder: ${ENC.name}`);
  const T0 = Date.now(); let done = 0, frames = 0;
  const budget = n => 120000 + n * 4000;
  await Promise.all(Array.from({ length: Math.min(W, queue.length) }, async (_, id) => {
    let br = await launch(), w = await openPage(br);
    const restart = async () => { try { await Promise.race([br.close(), new Promise(r => setTimeout(r, 5000))]); } catch (e) { } try { br.process() && br.process().kill(); } catch (e) { } br = await launch(); w = await openPage(br); };
    while (queue.length) {
      const c = queue.shift(), a = c * chunkFrames, b = Math.min(TOTAL, a + chunkFrames), tmp = cf(c) + '.tmp.mp4';
      for (let attempt = 1; ; attempt++) {
        const hold = {}; let timer = null;
        const run = shotChunk(w, a, b, tmp, hold).then(r => r.code);
        const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`chunk ${c} took longer than ${budget(b - a) / 1000}s`)), budget(b - a)); });
        try { const code = await Promise.race([run, timeout]); if (code !== 0) throw new Error(`ffmpeg failed on chunk ${c} (code ${code})`); break; }
        catch (e) { run.catch(() => { }); try { hold.ff && hold.ff.kill(); } catch (x) { } if (attempt >= 4) throw e; console.log(`[w${id}] chunk ${c}: ${e.message}; trying again (${attempt}/3)`); await restart(); }
        finally { clearTimeout(timer); }
      }
      fs.renameSync(tmp, cf(c));
      done++; frames += b - a; console.log(`[w${id}] chunk ${c} ok — ${done} done, ${queue.length} queued, ${((Date.now() - T0) / 1000).toFixed(0)}s`);
    }
    await br.close();
  }));
  const sec = (Date.now() - T0) / 1000;
  console.log(`rendered ${frames} frames in ${sec.toFixed(1)}s (${(frames / sec).toFixed(1)} fps, encoder ${ENC.name})`);
  if (PREVIEW) { fs.renameSync(cf(0), path.join(OUT, 'video.mp4')); console.log('preview done: render/preview/video.mp4'); return; }
  if (only) { console.log('partial done'); return; }
  fs.writeFileSync('render/list.txt', Array.from({ length: nCh }, (_, c) => `file '${cf(c).split(path.sep).join('/')}'`).join('\n'));
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'render/list.txt', '-c', 'copy', 'render/video.mp4']);
  if (!process.env.VIDEOHUB_JOB) {
    const name = path.basename(process.cwd());
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', 'render/video.mp4', '-i', process.env.AUDIO || 'audio/mix.mp3', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', `${name}_render.mp4`]);
    console.log(`done: ${name}_render.mp4`);
  }
})().catch(e => { console.error(e); process.exit(1); });
