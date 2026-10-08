import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, loadEnv } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixedEnv = {
  VITE_VAPT_API_BASE_URL: 'https://api.vapt.app.br',
  VITE_PAYMENT_ENVIRONMENT: 'sandbox',
  VITE_MENU_IMAGE_STORAGE_MODE: 'disabled',
  VITE_REALTIME_ENABLED: 'false',
  VITE_TURNSTILE_ENABLED: 'true',
  VITE_TURNSTILE_SITE_KEY: '0x4AAAAAAEhvIktjmb6yaq09',
};
const allowedKeys = new Set([...Object.keys(fixedEnv), 'VITE_VAPID_PUBLIC_KEY']);
const keys = (value, names) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));

export function checkFrontendProductionConfig(config) {
  const failure = { ok: false, failures: ['Invalid public frontend configuration'] };
  try {
    const { $schema, ...settings } = config;
    if (!keys(settings, ['name', 'account_id', 'keep_vars', 'compatibility_date', 'workers_dev', 'preview_urls', 'routes', 'assets']) ||
      settings.name !== 'vapt-web' || settings.account_id !== '3ce69408aa5112617a282957aba71932' || settings.keep_vars !== true ||
      settings.compatibility_date !== '2026-09-24' || settings.workers_dev !== false || settings.preview_urls !== true ||
      !Array.isArray(settings.routes) || settings.routes.length !== 1 ||
      !keys(settings.routes[0], ['pattern', 'custom_domain']) || settings.routes[0].pattern !== 'vapt.app.br' || settings.routes[0].custom_domain !== true ||
      !keys(settings.assets, ['directory', 'not_found_handling']) || settings.assets.directory !== './dist-production' ||
      settings.assets.not_found_handling !== 'single-page-application') return failure;
    return { ok: true, failures: [] };
  } catch { return failure; }
}

// One-shot production build process: pin runtime semantics as well as Vite mode.
// Dynamic import.meta.env contains every exposed key; disable env-file injection
// and add only approved public values, both for dynamic and direct reads.
export function productionBuildOptions(publicEnv = {}) {
  const vapid = publicEnv.VITE_VAPID_PUBLIC_KEY ?? '';
  if (typeof vapid !== 'string' || (vapid !== '' &&
    (!/^[A-Za-z0-9_-]{87}$/.test(vapid) || Buffer.from(vapid, 'base64url').length !== 65 || Buffer.from(vapid, 'base64url')[0] !== 4))) {
    throw new Error('Invalid public VAPID key');
  }
  process.env.NODE_ENV = 'production';
  delete process.env.VITE_USER_NODE_ENV;
  return { root, mode: 'production', envFile: false, envPrefix: [],
    define: Object.fromEntries(Object.entries({ ...fixedEnv, VITE_VAPID_PUBLIC_KEY: vapid })
      .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])),
    build: { outDir: 'dist-production' } };
}

export function checkProductionBundle(code) {
  if (typeof code !== 'string' || !code.includes(fixedEnv.VITE_VAPT_API_BASE_URL) || !code.includes(fixedEnv.VITE_TURNSTILE_SITE_KEY) ||
    /api\.preview\.invalid|br8r5p\.easypanel\.host/.test(code) ||
    [...code.matchAll(/VITE_[A-Z0-9_]+/g)].some(([key]) => !allowedKeys.has(key))) {
    return { ok: false, failures: ['Invalid public production bundle'] };
  }
  return { ok: true, failures: [] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const command = process.argv[2];
    if (!['--check', '--build', '--verify-artifact'].includes(command) || process.argv.length !== 3) throw Error();
    const config = JSON.parse(readFileSync(resolve(root, 'wrangler.production.jsonc'), 'utf8'));
    if (!checkFrontendProductionConfig(config).ok) throw Error();
    if (command === '--build') {
      // Read only the one optional public key; never forward unrelated env values.
      const publicEnv = loadEnv('production', root, 'VITE_VAPID_PUBLIC_KEY');
      await build(productionBuildOptions(publicEnv));
    }
    if (command !== '--check') {
      const directory = resolve(root, 'dist-production');
      const files = readdirSync(resolve(directory, 'assets')).filter(name => name.endsWith('.js')).sort();
      const bundles = files.map(name => readFileSync(resolve(directory, 'assets', name), 'utf8')).join('\n');
      if (!checkProductionBundle(bundles).ok) throw Error();
      const artifactSha256 = createHash('sha256').update(readFileSync(resolve(directory, 'index.html'))).update(bundles).digest('hex');
      console.log(JSON.stringify({ ok: true, jsFiles: files.length, artifactSha256, noPublication: true }));
    } else console.log(JSON.stringify({ ok: true, noPublication: true }));
  } catch {
    console.log(JSON.stringify({ ok: false, failures: ['Production build/configuration verification failed'], noPublication: true }));
    process.exitCode = 1;
  }
}
