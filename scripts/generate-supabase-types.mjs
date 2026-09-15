import { writeFile } from "node:fs/promises";
import { introspect } from "@supabase/postgrest-typegen/introspection";
import {
  generateTypescript,
  sortGeneratorMetadata,
} from "@supabase/postgrest-typegen/generation";

import { createSupabaseBaselineDatabase } from "./supabase-baseline-harness.mjs";

const outputPath = new URL("../src/integrations/supabase/types.ts", import.meta.url);
const database = await createSupabaseBaselineDatabase();

try {
  const metadata = await introspect(database, { includedSchemas: ["public"] });
  const types = await generateTypescript(sortGeneratorMetadata(metadata), {
    detectOneToOneRelationships: true,
    postgrestVersion: "14.5",
  });
  await writeFile(outputPath, types, "utf8");
  console.log(`Generated ${types.split("\n").length} lines of Supabase types.`);
} finally {
  await database.close();
}
