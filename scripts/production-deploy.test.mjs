import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'vite';

async function feature() {
  const module = await import('./production-deploy.mjs').catch(() => null);
  assert.equal(typeof module?.productionBuildOptions, 'function', 'production build gate not implemented');
  assert.equal(typeof module?.checkFrontendProductionConfig, 'function');
  return module;
}
const valid = () => ({ name: 'vapt-web', account_id: '3ce69408aa5112617a282957aba71932', keep_vars: true,
  compatibility_date: '2026-09-24', workers_dev: false, preview_urls: true,
  routes: [{ pattern: 'vapt.app.br', custom_domain: true }],
  assets: { directory: './dist-production', not_found_handling: 'single-page-application' } });

test('public frontend config retains only authorized custom domain and isolated production assets', async () => {
  assert.deepEqual((await feature()).checkFrontendProductionConfig(valid()), { ok: true, failures: [] });
});
test('rejects unintended Worker/account/ingress, assets and injected bindings without reflecting secrets', async () => {
  const { checkFrontendProductionConfig: check } = await feature();
  for (const mutate of [
    c => { c.name = 'vapt-api-production'; }, c => { c.account_id = 'other'; }, c => { c.keep_vars = false; },
    c => { c.workers_dev = true; }, c => { c.preview_urls = false; },
    c => { c.routes = []; }, c => { c.routes[0].pattern = 'api.vapt.app.br'; },
    c => { c.routes[0].pattern = '*.vapt.app.br'; }, c => { c.routes[0].custom_domain = false; },
    c => { c.routes.push({ pattern: 'other.vapt.app.br', custom_domain: true }); },
    c => { c.assets.directory = './dist'; }, c => { c.assets.not_found_handling = '404-page'; },
    c => { c.vars = { SECRET: 'synthetic-secret' }; }, c => { c.main = 'other.js'; },
  ]) { const config = valid(); mutate(config); const result = check(config);
    assert.equal(result.ok, false); assert.doesNotMatch(JSON.stringify(result), /synthetic-secret/); }
  assert.equal(check(null).ok, false);
});
test('build settings ignore hostile origin, feature flags and unused VITE values', async () => {
  const { productionBuildOptions } = await feature();
  const options = productionBuildOptions({ VITE_VAPT_API_BASE_URL: 'https://other.example', VITE_REALTIME_ENABLED: 'true',
    VITE_MENU_IMAGE_STORAGE_MODE: 'r2', VITE_TURNSTILE_ENABLED: 'false', VITE_PAYMENT_ENVIRONMENT: 'production',
    VITE_UNUSED_SECRET: 'synthetic-secret' });
  assert.equal(options.envFile, false);
  assert.deepEqual(options.envPrefix, []);
  assert.equal(options.build.outDir, 'dist-production');
  assert.equal(options.define['import.meta.env.VITE_VAPT_API_BASE_URL'], '"https://api.vapt.app.br"');
  assert.equal(options.define['import.meta.env.VITE_TURNSTILE_ENABLED'], '"true"');
  assert.equal(options.define['import.meta.env.VITE_REALTIME_ENABLED'], '"false"');
  assert.equal(options.define['import.meta.env.VITE_MENU_IMAGE_STORAGE_MODE'], '"disabled"');
  assert.equal(options.define['import.meta.env.VITE_PAYMENT_ENVIRONMENT'], '"sandbox"');
  assert.equal(Object.keys(options.define).length, 7);
  assert.doesNotMatch(JSON.stringify(options), /synthetic-secret|other\.example/);
});
test('rejects malformed VAPID input instead of putting a credential in the public bundle', async () => {
  const { productionBuildOptions } = await feature();
  assert.throws(() => productionBuildOptions({ VITE_VAPID_PUBLIC_KEY: 'synthetic-secret' }), error => !String(error).includes('synthetic-secret'));
  const publicKey = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url');
  assert.equal(productionBuildOptions({ VITE_VAPID_PUBLIC_KEY: publicKey }).define['import.meta.env.VITE_VAPID_PUBLIC_KEY'], JSON.stringify(publicKey));
});
test('real Vite dynamic import.meta.env bundle excludes parent VITE credentials and preserves target API', async () => {
  const { productionBuildOptions } = await feature();
  const previous = process.env.VITE_UNUSED_SECRET;
  process.env.VITE_UNUSED_SECRET = 'synthetic-secret-never-bundle';
  try {
    const result = await build({ ...productionBuildOptions(), configFile: false, logLevel: 'silent',
      plugins: [{ name: 'test-entry', resolveId: id => id === 'test-entry' ? '\0test-entry' : null,
        load: id => id === '\0test-entry' ? 'globalThis.envProof = import.meta.env;' : null }],
      build: { write: false, minify: false, rollupOptions: { input: 'test-entry' } } });
    const code = result.output.find(item => item.type === 'chunk').code;
    assert.match(code, /https:\/\/api\.vapt\.app\.br/);
    const context = {};
    runInNewContext(code, context);
    assert.equal(context.envProof.VITE_VAPT_API_BASE_URL, 'https://api.vapt.app.br');
    assert.equal(context.envProof.VITE_TURNSTILE_ENABLED, 'true');
    assert.equal(context.envProof.VITE_MENU_IMAGE_STORAGE_MODE, 'disabled');
    assert.equal(context.envProof.VITE_REALTIME_ENABLED, 'false');
    assert.equal(context.envProof.VITE_PAYMENT_ENVIRONMENT, 'sandbox');
    assert.deepEqual(Object.keys(context.envProof).filter(key => key.startsWith('VITE_')).sort(), [
      'VITE_MENU_IMAGE_STORAGE_MODE', 'VITE_PAYMENT_ENVIRONMENT', 'VITE_REALTIME_ENABLED',
      'VITE_TURNSTILE_ENABLED', 'VITE_TURNSTILE_SITE_KEY', 'VITE_VAPID_PUBLIC_KEY', 'VITE_VAPT_API_BASE_URL',
    ]);
    assert.doesNotMatch(code, /VITE_UNUSED_SECRET|synthetic-secret-never-bundle/);
  } finally { if (previous === undefined) delete process.env.VITE_UNUSED_SECRET; else process.env.VITE_UNUSED_SECRET = previous; }
});
test('committed public frontend config passes and preview config is not deployable as public production', async () => {
  const { checkFrontendProductionConfig: check } = await feature();
  assert.deepEqual(check(JSON.parse(readFileSync(new URL('../wrangler.production.jsonc', import.meta.url), 'utf8'))), { ok: true, failures: [] });
  assert.equal(check(JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'))).ok, false);
});
for (const poison of ['NODE_ENV', 'VITE_USER_NODE_ENV']) test(`real production build pins runtime semantics despite ${poison}`, async () => {
  const { productionBuildOptions } = await feature();
  const previousNode = process.env.NODE_ENV;
  const previousViteNode = process.env.VITE_USER_NODE_ENV;
  try {
      delete process.env.NODE_ENV; delete process.env.VITE_USER_NODE_ENV;
      process.env[poison] = 'development';
      const result = await build({ ...productionBuildOptions(), configFile: false, logLevel: 'silent',
        plugins: [{ name: 'test-mode', resolveId: id => id === 'test-mode' ? '\0test-mode' : null,
          load: id => id === '\0test-mode' ? 'globalThis.envProof = import.meta.env;' : null }],
        build: { write: false, minify: false, rollupOptions: { input: 'test-mode' } } });
      const context = {};
      runInNewContext(result.output.find(item => item.type === 'chunk').code, context);
      assert.equal(context.envProof.DEV, false, `${poison} must not make the shipped artifact behave as local development`);
      assert.equal(context.envProof.PROD, true);
  } finally {
    if (previousNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNode;
    if (previousViteNode === undefined) delete process.env.VITE_USER_NODE_ENV; else process.env.VITE_USER_NODE_ENV = previousViteNode;
  }
});
test('artifact gate rejects missing target, old preview and unapproved VITE keys with safe output', async () => {
  const { checkProductionBundle: check } = await feature();
  assert.equal(typeof check, 'function', 'production artifact gate not implemented');
  const bundle = 'https://api.vapt.app.br 0x4AAAAAAEhvIktjmb6yaq09 VITE_VAPT_API_BASE_URL VITE_TURNSTILE_ENABLED';
  assert.deepEqual(check(bundle), { ok: true, failures: [] });
  for (const input of ['', bundle.replace('https://api.vapt.app.br', 'https://other.example'),
    bundle + ' api.preview.invalid', bundle + ' VITE_UNUSED_SECRET=synthetic-secret']) {
    const result = check(input); assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-secret/);
  }
});
test('CLI refuses unexpected command before building or publishing and suppresses supplied values', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./production-deploy.mjs', import.meta.url)), 'synthetic-secret'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-secret/);
  assert.match(result.stdout, /"ok":false/);
});
