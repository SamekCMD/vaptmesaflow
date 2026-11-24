import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
test('billing diagnostics binds only the production dataset and never enables persisted request logs',()=>{
 const production=JSON.parse(readFileSync(new URL('../wrangler.production.jsonc',import.meta.url),'utf8'));
 const preview=JSON.parse(readFileSync(new URL('../wrangler.preview.jsonc',import.meta.url),'utf8'));
 assert.deepEqual(production.analytics_engine_datasets,[{binding:'DIAGNOSTICS',dataset:'vapt_operational_diagnostics_production'}]);
 assert.equal(preview.analytics_engine_datasets,undefined);
 assert.equal(production.observability?.enabled??false,false);
 assert.equal(production.vars.ENVIRONMENT,'production');
 assert.deepEqual(production.triggers.crons,['*/30 * * * *']);
});
