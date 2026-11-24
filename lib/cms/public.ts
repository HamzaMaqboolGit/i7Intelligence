import { publicClient } from "@/lib/client-public";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { publicRecords, serialize, CmsRecord } from "./store";
import { publicModules } from "./registry";
export type SiteSnapshot = Record<string, CmsRecord[]>;
const getCachedSnapshot = unstable_cache(
  async (): Promise<SiteSnapshot> => {
    const entries = await Promise.all(
      publicModules.map(
        async (module) => [module, await publicRecords(module)] as const,
      ),
    );
    const snapshot = Object.fromEntries(entries);
    snapshot.clients = snapshot.clients
      .map(publicClient)
      .filter((record): record is CmsRecord => record !== null);
    return serialize(snapshot);
  },
  ["public-cms-snapshot-v2"],
  { tags: ["public-cms"], revalidate: 30 },
);
export const getSiteSnapshot = cache(getCachedSnapshot);
