import test from 'node:test';
import assert from 'node:assert/strict';
import {productionBuildOptions} from './production-deploy.mjs';
async function feature(){const m=await import('./catalog-production-build.mjs').catch(()=>({}));assert.equal(typeof m.catalogProductionBuildOptions,'function','explicit catalog candidate builder missing');return m.catalogProductionBuildOptions;}
for(const [phase,events]of [['writer-only','false'],['reader-writer','true']])test(`${phase} candidate preserves production security and enables receipt-aware R2 uploads without public-env overrides`,async()=>{
  const options=(await feature())({VITE_PUBLIC_CATALOG_EVENTS_ENABLED:'injected',VITE_SECRET:'private',VITE_VAPT_API_BASE_URL:'https://wrong.invalid'},phase);
  assert.equal(options.define['import.meta.env.VITE_PUBLIC_CATALOG_WRITER_ENABLED'],'"true"');
  assert.equal(options.define['import.meta.env.VITE_PUBLIC_CATALOG_EVENTS_ENABLED'],JSON.stringify(events));
  assert.equal(options.define['import.meta.env.VITE_MENU_IMAGE_STORAGE_MODE'],'"r2"');
  assert.equal(options.define['import.meta.env.VITE_VAPT_API_BASE_URL'],'"https://api.vapt.app.br"');
  assert.equal(options.define['import.meta.env.VITE_PAYMENT_ENVIRONMENT'],'"sandbox"');assert.equal(options.define['import.meta.env.VITE_TURNSTILE_ENABLED'],'"true"');
  assert.equal(options.define['import.meta.env.VITE_REALTIME_ENABLED'],'"true"');assert.equal(options.envFile,false);assert.deepEqual(options.envPrefix,[]);
  assert.equal(options.build.emptyOutDir,false);assert(options.build.outDir.replaceAll('\\','/').endsWith('/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan/catalog-frontend-'+phase+'-candidate-v1'));
  assert.doesNotMatch(JSON.stringify(options),/private|injected|wrong.invalid/);
});
test('legacy production builds remain catalog-off and cannot acquire candidate flags by calling the new builder',async()=>{
  const run=await feature();run({},'writer-only');const original=productionBuildOptions({},'enabled');
  assert.equal(original.define['import.meta.env.VITE_PUBLIC_CATALOG_WRITER_ENABLED'],'"false"');assert.equal(original.define['import.meta.env.VITE_PUBLIC_CATALOG_EVENTS_ENABLED'],'"false"');
  assert.equal(original.define['import.meta.env.VITE_MENU_IMAGE_STORAGE_MODE'],'"disabled"');
});
test('unknown phases and malformed VAPID fail instead of selecting an activation fallback',async()=>{
  const run=await feature();for(const phase of [undefined,'production','reader-only','../published','writer-only --deploy'])assert.throws(()=>run({},phase));
  assert.throws(()=>run({VITE_VAPID_PUBLIC_KEY:'private'},'writer-only'));
});
