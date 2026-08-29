#!/usr/bin/env node
/**
 * Artboard Export
 *
 * Renders design/previews/*.html to PNGs in design/artboards/, in both themes.
 *
 * The HTML is the reference, not the PNG: the previews read the same generated
 * tokens the product does, so they cannot describe a palette we no longer ship.
 * The exports exist so the system can be looked at in a pull request, on a
 * phone, or by someone who has not cloned the repo.
 *
 * Usage:
 *   npm run design:artboards
 *
 * Requires Google Chrome. This is deliberately not a dependency — nothing in the
 * build needs it, and adding a headless browser to install just to regenerate
 * reference images would be a poor trade for contributors.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { promisify } = require('util');

// Async on purpose. The static server below runs in this same process, so a
// synchronous spawn would block the event loop and Chrome would wait forever
// for a response that cannot be sent until Chrome exits.
const run = promisify(execFile);

const ROOT = path.join(__dirname, '..');
const PREVIEWS = path.join(ROOT, 'design', 'previews');
const ARTBOARDS = path.join(ROOT, 'design', 'artboards');

/**
 * Reference sheets, captured in both themes at 2× so the type stays legible.
 * width × height are CSS pixels.
 */
const SHEETS = [
    { name: 'foundations', width: 1280, height: 4200 },
    { name: 'components', width: 1280, height: 2100 },
];
const THEMES = ['dark', 'light'];
const SCALE = 2;

/**
 * Product assets that ship in public/. Same mechanism, one theme, exact size —
 * a social card is a fixed canvas, not a page that reflows.
 *
 * The og-image is built here rather than screenshotted from the app on purpose:
 * it renders at roughly 600×315 in a feed, where an interface screenshot is an
 * unreadable smear. Building it from the tokens also means it cannot show a
 * palette the product no longer has, which the previous one did.
 */
const ASSETS = [
    { name: 'og-image', width: 1200, height: 630, out: path.join('public', 'og-image.png') },
];

const CHROME_CANDIDATES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
];

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
};

function findChrome() {
    const fromEnv = process.env.CHROME_PATH;
    if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

    const found = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
    if (found) return found;

    throw new Error(
        'Could not find Chrome or Chromium. Set CHROME_PATH to the binary, or\n' +
        '  regenerate the artboards on a machine that has one — the HTML previews\n' +
        '  in design/previews/ are the reference and work without this script.'
    );
}

/**
 * Serve design/previews over HTTP. Chrome will not load a relative stylesheet
 * from a file:// page, so the artboards render unstyled without this.
 */
function serve() {
    const server = http.createServer((req, res) => {
        const name = path.basename((req.url || '/').split('?')[0]) || 'index.html';
        const file = path.join(PREVIEWS, name);

        if (!file.startsWith(PREVIEWS) || !fs.existsSync(file)) {
            res.writeHead(404).end('not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain' });
        res.end(fs.readFileSync(file));
    });
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
}

async function capture(chrome, port, page, out, width, height, scale) {
    // A throwaway profile per capture. Without it the second launch attaches to
    // the first instance through the profile lock and never exits, which hangs
    // the whole export.
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'composeyogi-artboard-'));

    try {
        await run(chrome, [
            '--headless=new',
            '--disable-gpu',
            '--hide-scrollbars',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-extensions',
            '--disable-background-networking',
            `--user-data-dir=${profile}`,
            `--screenshot=${out}`,
            `--window-size=${width},${height}`,
            `--force-device-scale-factor=${scale}`,
            '--virtual-time-budget=5000',
            `http://127.0.0.1:${port}/${page}`,
        ], { timeout: 90_000 });
    } finally {
        fs.rmSync(profile, { recursive: true, force: true });
    }
}

async function main() {
    const chrome = findChrome();
    fs.mkdirSync(ARTBOARDS, { recursive: true });

    const { server, port } = await serve();
    const written = [];

    try {
        for (const sheet of SHEETS) {
            for (const theme of THEMES) {
                const out = path.join(ARTBOARDS, `${sheet.name}-${theme}.png`);
                await capture(
                    chrome, port, `${sheet.name}.html?theme=${theme}`,
                    out, sheet.width, sheet.height, SCALE
                );
                written.push(
                    `  ${path.relative(ROOT, out)}  ${Math.round(fs.statSync(out).size / 1024)} KB`
                );
            }
        }
        for (const asset of ASSETS) {
            const out = path.join(ROOT, asset.out);
            await capture(chrome, port, `${asset.name}.html`, out, asset.width, asset.height, 1);
            written.push(`  ${asset.out}  ${Math.round(fs.statSync(out).size / 1024)} KB`);
        }
    } finally {
        server.close();
    }

    console.log(`✓ Exported ${written.length} files\n${written.join('\n')}`);
}

main().catch((error) => {
    console.error(`✗ ${error.message}`);
    process.exit(1);
});
