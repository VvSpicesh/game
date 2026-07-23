/**
 * Node ESM loader: strip ?v= cache-bust from import specifiers
 * so browser modules can be imported headlessly.
 */
export async function resolve(specifier, context, nextResolve) {
  const cleaned = String(specifier).replace(/\?[^#]*/, "");
  return nextResolve(cleaned, context);
}
