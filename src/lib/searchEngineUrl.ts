import type { SearchEngine } from "./defaultSearchEngines";
import { ensureUrlHasProtocol } from "./url";

export function buildSearchEngineUrl(engine: Pick<SearchEngine, "url">, query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const template = ensureUrlHasProtocol(engine.url);
  if (!template) return null;

  const encodedQuery = encodeURIComponent(trimmed);
  const merged = template.includes("%s")
    ? template.replace(/%s/g, encodedQuery)
    : `${template}${encodedQuery}`;

  try {
    return new URL(merged).toString();
  } catch {
    return null;
  }
}
