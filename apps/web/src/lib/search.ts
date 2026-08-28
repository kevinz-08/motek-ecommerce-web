const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'aceites': ['aceite', 'aceites', 'lubricante', 'lubricantes', 'liquimoly', 'castrol'],
  'llantas': ['llanta', 'llantas', 'neumatico', 'neumaticos', 'kontrol', 'dunlop'],
  'repuestos': ['repuesto', 'repuestos', 'filtro', 'bujia', 'bujías', 'freno', 'frenos', 'embrague', 'pastillas'],
  'sistema-electrico': ['electrico', 'eléctrico', 'bateria', 'baterías', 'bobina', 'cdi', 'regulador', 'ramal', 'ramales', 'sensor', 'sensores', 'estator', 'estatores', 'arranque'],
  'accesorios': ['accesorio', 'accesorios', 'espejo', 'espejos', 'exploradores', 'led', 'equipamiento'],
}

export function detectCategorySlugs(query: string): string[] {
  const q = query.toLowerCase()
  const words = q.split(/\s+/).filter(Boolean)
  const matched = new Set<string>()
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => q.includes(kw))) matched.add(slug)
  }
  for (const word of words) {
    if (CATEGORY_KEYWORDS[word]) matched.add(word)
  }
  return Array.from(matched)
}

export function extractSearchWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

export function isCategoryKeyword(word: string): boolean {
  return word in CATEGORY_KEYWORDS || Object.values(CATEGORY_KEYWORDS).some((kws) => kws.includes(word))
}
