/**
 * Chain-to-domain map for known Spanish supermarket chains.
 * Used to resolve favicons via Google's favicon service.
 */
const CHAIN_DOMAINS: Record<string, string> = {
  mercadona: "mercadona.es",
  carrefour: "carrefour.es",
  lidl: "lidl.es",
  aldi: "aldi.es",
  dia: "dia.es",
  eroski: "eroski.es",
  alcampo: "alcampo.es",
  hipercor: "hipercor.es",
  "el corte inglés": "elcorteingles.es",
  "el corte ingles": "elcorteingles.es",
  consum: "consum.es",
  bonarea: "bonarea.com",
  condis: "condis.es",
  caprabo: "caprabo.com",
  makro: "makro.es",
  costco: "costco.es",
  auchan: "auchan.es",
  spar: "spar.es",
  coviran: "coviran.es",
  gadis: "gadis.es",
  ahorramas: "ahorramas.com",
  mas: "supermercadosmas.com",
  bm: "bmsupermercados.es",
  simply: "simply.es",
  ahorramás: "ahorramas.com",
  "bon preu": "bonpreuesclat.cat",
  bonpreu: "bonpreuesclat.cat",
  esclat: "bonpreuesclat.cat",
  "la plaza": "laplazadedia.es",
  "masymas": "masymas.com",
  "cash carry": "cashcarry.es",
  familia: "familiacash.es",
  "hiber": "hiber.es",
  "supersol": "supersol.es",
  "unide": "unide.es",
  "uvesco": "uvesco.es",
  lupa: "superlupa.es",
  froiz: "froiz.com",
  alimerka: "alimerka.es",
  "hiper usera": "hiperusera.es",
  "walmart": "walmart.com",
  "tesco": "tesco.com",
  "asda": "asda.com",
};

function normalize(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Get the domain for a chain name. Looks up the hardcoded map first,
 * then falls back to a generated domain (name + ".es").
 */
export function getChainDomain(chainName: string): string {
  const key = normalize(chainName);
  if (CHAIN_DOMAINS[key]) return CHAIN_DOMAINS[key];
  // Fallback: generate domain from name
  return key.replace(/\s+/g, "") + ".es";
}

/**
 * Get a favicon URL for a chain name using Google's favicon service.
 * Returns null only if the chain name is empty.
 */
export function getChainFavicon(chainName: string): string | null {
  if (!chainName || !chainName.trim()) return null;
  const domain = getChainDomain(chainName);
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}
