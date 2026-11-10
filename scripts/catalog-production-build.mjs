// Offline candidate options only. No CLI/deploy, credentials, provider or source edits.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {productionBuildOptions} from './production-deploy.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export function catalogProductionBuildOptions(publicEnv={},phase){
  if(!['writer-only','reader-writer'].includes(phase))throw Error('Explicit catalog phase required');
  const options=productionBuildOptions(publicEnv,'enabled');
  return{...options,define:{...options.define,
    'import.meta.env.VITE_PUBLIC_CATALOG_WRITER_ENABLED':'"true"',
    'import.meta.env.VITE_PUBLIC_CATALOG_EVENTS_ENABLED':JSON.stringify(phase==='reader-writer'?'true':'false'),
    'import.meta.env.VITE_MENU_IMAGE_STORAGE_MODE':'"r2"'},
    build:{...options.build,outDir:resolve(root,'.superpowers/sdd/infra-migration-public-catalog-event-driven-plan',`catalog-frontend-${phase}-candidate-v1`),emptyOutDir:false}};
}
