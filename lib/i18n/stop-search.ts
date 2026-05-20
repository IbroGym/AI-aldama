/**
 * Cross-script stop name search (Russian / Kazakh / Latin GTFS names).
 */

const STOP_QUERY_STOPWORDS = new Set([
  // Russian
  "улица",
  "ул",
  "ул.",
  "проспект",
  "пр",
  "пр.",
  "пер",
  "переулок",
  "остановка",
  "остановки",
  "как",
  "добраться",
  "доехать",
  "до",
  "на",
  // Kazakh
  "көше",
  "көшесіне",
  "кошесине",
  "коше",
  "аялдама",
  "аялдамасы",
  "аялдамаға",
  "тоқтау",
  "тоқтауға",
  "токтау",
  "қалай",
  "жету",
  "жетсем",
  "жетуге",
  "бару",
  "баруға",
  "барамын",
  "келу",
  "болады",
  "керек",
  "де",
  "ге",
  "ға",
  "қа",
  "ой",
  "автобус",
  // English
  "stop",
  "the",
  "bus",
  "how",
  "get",
  "to",
])

/** Cyrillic (RU + KK) → Latin (approximate, for search only). */
const CYR_TO_LAT: Record<string, string> = {
  а: "a",
  ә: "ae",
  б: "b",
  в: "v",
  г: "g",
  ғ: "gh",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  қ: "q",
  л: "l",
  м: "m",
  н: "n",
  ң: "ng",
  о: "o",
  ө: "oe",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ұ: "u",
  ү: "ue",
  ф: "f",
  х: "kh",
  һ: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  і: "i",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
}

const LAT_DIGRAPHS = [
  "shch",
  "sch",
  "zh",
  "kh",
  "ch",
  "sh",
  "ts",
  "yu",
  "ya",
  "yo",
  "ye",
  "ae",
  "oe",
  "ue",
  "gh",
  "ng",
]

const LAT_TO_CYR: Record<string, string> = {
  shch: "щ",
  sch: "щ",
  zh: "ж",
  kh: "х",
  ch: "ч",
  sh: "ш",
  ts: "ц",
  yu: "ю",
  ya: "я",
  yo: "ё",
  ye: "е",
  ae: "ә",
  oe: "ө",
  ue: "ү",
  gh: "ғ",
  ng: "ң",
  a: "а",
  b: "б",
  v: "в",
  g: "г",
  d: "д",
  e: "е",
  z: "з",
  i: "и",
  y: "ы",
  k: "к",
  q: "қ",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  f: "ф",
  h: "х",
  c: "к",
  j: "ж",
}

/** Kazakh-specific Latin digraphs → Cyrillic (search only). */
const LAT_TO_KK_EXTRA: [string, string][] = [
  ["shch", "щ"],
  ["sch", "щ"],
  ["zh", "ж"],
  ["kh", "х"],
  ["ch", "ч"],
  ["sh", "ш"],
  ["ts", "ц"],
  ["yu", "ю"],
  ["ya", "я"],
  ["ae", "ә"],
  ["oe", "ө"],
  ["ue", "ү"],
  ["gh", "ғ"],
  ["ng", "ң"],
  ["q", "қ"],
  ["u", "ұ"],
]

export function normalizeForStopSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-яәғқңөүұһі0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function cyrillicToLatinApprox(text: string): string {
  let out = ""
  const lower = text.toLowerCase()
  for (const ch of lower) {
    if (CYR_TO_LAT[ch] !== undefined) out += CYR_TO_LAT[ch]
    else if (/[a-z0-9]/.test(ch)) out += ch
  }
  return out
}

export function latinToCyrillicApprox(text: string): string {
  let s = text.toLowerCase().replace(/[^a-z]/g, "")
  let out = ""
  while (s.length > 0) {
    let matched = false
    for (const dig of LAT_DIGRAPHS) {
      if (s.startsWith(dig)) {
        out += LAT_TO_CYR[dig] ?? dig
        s = s.slice(dig.length)
        matched = true
        break
      }
    }
    if (matched) continue
    const ch = s[0]
    out += LAT_TO_CYR[ch] ?? ch
    s = s.slice(1)
  }
  return out
}

/** Prefer Kazakh letters when query contains KK-specific Cyrillic. */
export function latinToKazakhCyrillicApprox(text: string): string {
  let s = text.toLowerCase().replace(/[^a-z]/g, "")
  let out = ""
  while (s.length > 0) {
    let matched = false
    for (const [dig, cyr] of LAT_TO_KK_EXTRA) {
      if (s.startsWith(dig)) {
        out += cyr
        s = s.slice(dig.length)
        matched = true
        break
      }
    }
    if (matched) continue
    const ch = s[0]
    out += LAT_TO_CYR[ch] ?? ch
    s = s.slice(1)
  }
  return out
}

export function stripStopQueryStopwords(query: string): string {
  const tokens = normalizeForStopSearch(query).split(" ").filter(Boolean)
  const kept = tokens.filter((t) => !STOP_QUERY_STOPWORDS.has(t))
  return kept.join(" ").trim() || normalizeForStopSearch(query)
}

export function tokenizeStopSearch(q: string): string[] {
  const cleaned = stripStopQueryStopwords(q)
  return cleaned
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zа-яёәғқңөүұһі0-9]/gi, ""))
    .filter((w) => w.length >= 2)
}

/** Extra tokens for cross-script matching (RU + KK + Latin). */
export function expandStopSearchTokens(query: string): string[] {
  const tokens = tokenizeStopSearch(query)
  const extra = new Set<string>(tokens)
  const q = normalizeForStopSearch(query)

  const synonymGroups = [
    ["звезда", "звезд", "zvezda", "stella", "stela", "стелла", "стела", "жұлдыз", "juldyz"],
    ["астаны", "астана", "astany", "astana"],
    ["карасу", "karasu", "қарасу", "qarasu"],
    ["променад", "promenad", "ekspo", "экспо", "expo", "өренбор", "orynbor"],
    ["хан", "шатыр", "shatyr", "khan", "ханы", "шатыры", "хан", "шатыр"],
    ["опера", "opera", "театр", "teatr", "театр"],
    ["вокзал", "temirzhol", "темиржол", "теміржол", "railway", "жд", "темір"],
    ["аэропорт", "airport", "әуежай", "auezhai", "аэро"],
    [
      "назарбаев",
      "nazarbaev",
      "nazarbayev",
      "университет",
      "universitet",
      "унив",
    ],
    ["керуен", "keruen", "керуэн"],
    ["байтерек", "baiterek", "бәйтерек"],
    ["комфорт", "komfort", "comfort"],
  ]

  for (const group of synonymGroups) {
    const hit =
      group.some((term) => q.includes(term)) ||
      tokens.some((t) => group.some((g) => t.includes(g) || g.includes(t)))
    if (hit) {
      for (const term of group) {
        if (term.length >= 2) extra.add(term)
      }
    }
  }

  const normalized = normalizeForStopSearch(query)
  const hasKkLetters = /[әғқңөүұі]/i.test(normalized)
  const hasCyrillic = /[а-яё]/i.test(normalized) || hasKkLetters

  if (hasCyrillic) {
    const lat = cyrillicToLatinApprox(normalized)
    if (lat.length >= 2) extra.add(lat)
    for (const t of lat.split(/\s+/).filter((x) => x.length >= 3)) {
      extra.add(t)
    }
    if (hasKkLetters) {
      const latKk = cyrillicToLatinApprox(normalized)
      for (const t of latKk.split(/\s+/).filter((x) => x.length >= 3)) {
        extra.add(t)
      }
    }
  }
  if (/[a-z]/i.test(normalized) && !hasCyrillic) {
    const cyr = latinToCyrillicApprox(normalized.replace(/\s+/g, ""))
    if (cyr.length >= 2) extra.add(cyr)
    const cyrKk = latinToKazakhCyrillicApprox(normalized.replace(/\s+/g, ""))
    if (cyrKk.length >= 2) extra.add(cyrKk)
    for (const t of normalized.split(/\s+/).filter((x) => x.length >= 3)) {
      extra.add(latinToCyrillicApprox(t))
      extra.add(latinToKazakhCyrillicApprox(t))
    }
  }

  return [...extra]
}

export type StopSearchFields = {
  stop_code: string
  name: string
  name_ru?: string | null
  name_kk?: string | null
  name_en?: string | null
}

export function buildStopSearchHaystack(stop: StopSearchFields): string {
  const primaryLocalized = stop.name_kk ?? stop.name_ru ?? stop.name
  const parts = [
    stop.stop_code,
    stop.name,
    stop.name_ru ?? "",
    stop.name_kk ?? "",
    stop.name_en ?? "",
    normalizeForStopSearch(stop.name),
    stop.name_ru ? normalizeForStopSearch(stop.name_ru) : "",
    stop.name_kk ? normalizeForStopSearch(stop.name_kk) : "",
    cyrillicToLatinApprox(stop.name_ru ?? primaryLocalized),
    cyrillicToLatinApprox(stop.name_kk ?? ""),
    latinToCyrillicApprox(normalizeForStopSearch(stop.name).replace(/\s/g, "")),
    latinToKazakhCyrillicApprox(normalizeForStopSearch(stop.name).replace(/\s/g, "")),
    stop.name_kk
      ? latinToKazakhCyrillicApprox(normalizeForStopSearch(stop.name_kk).replace(/\s/g, ""))
      : "",
  ]
  return parts.filter(Boolean).join(" ").toLowerCase()
}

/** Drop weak matches (e.g. «улица» → wrong street) when core tokens are known. */
export function refineDestinationSearchHits<T extends StopSearchFields>(
  query: string,
  hits: T[]
): T[] {
  if (!hits.length) return hits

  const searchTokens = expandStopSearchTokens(query)
  const coreTokens = searchTokens.filter(
    (t) =>
      t.length >= 3 &&
      !STOP_QUERY_STOPWORDS.has(t) &&
      (t.length >= 4 || /[әғқңөүұіа-яё]/i.test(t))
  )
  if (coreTokens.length === 0) return hits

  const filtered = hits.filter((s) => {
    const hay = buildStopSearchHaystack(s)
    return coreTokens.some((tok) => hay.includes(tok.toLowerCase()))
  })
  return filtered.length ? filtered : hits
}

export function scoreStopSearchMatch(
  query: string,
  stop: StopSearchFields
): number {
  const qNorm = stripStopQueryStopwords(query)
  const qLower = qNorm.toLowerCase()
  if (!qLower) return 0

  const queryTokens = tokenizeStopSearch(query)
  const searchTokens = expandStopSearchTokens(query)
  const hay = buildStopSearchHaystack(stop)

  let score = 0
  if (hay.includes(qLower)) score += 50

  const qLat = cyrillicToLatinApprox(qNorm)
  if (qLat.length >= 3 && hay.includes(qLat)) score += 35

  const qCyr = latinToCyrillicApprox(qNorm.replace(/\s+/g, ""))
  if (qCyr.length >= 3 && hay.includes(qCyr)) score += 35

  const qCyrKk = latinToKazakhCyrillicApprox(qNorm.replace(/\s+/g, ""))
  if (qCyrKk.length >= 3 && hay.includes(qCyrKk)) score += 35

  const matched = searchTokens.filter(
    (tok) => tok.length >= 2 && hay.includes(tok)
  )
  const matchedLoose = searchTokens.filter(
    (tok) =>
      tok.length >= 3 &&
      [...hay.split(/\s+/)].some(
        (word) => word.includes(tok) || tok.includes(word)
      )
  )
  const effectiveMatched = matched.length > 0 ? matched : matchedLoose
  if (effectiveMatched.length === 0) return 0

  score += effectiveMatched.length * 16
  const matchedQuery = queryTokens.filter((tok) => hay.includes(tok))
  score += matchedQuery.length * 10
  if (queryTokens.length > 0 && matchedQuery.length === queryTokens.length) {
    score += 40
  }
  if (
    searchTokens.length > 0 &&
    effectiveMatched.length >= Math.min(2, searchTokens.length)
  ) {
    score += 25
  }
  if (queryTokens.length === 1 && effectiveMatched.length >= 1) {
    score += 20
  }

  // Prefer rows with a real localized name match (ru/kk) over Latin-only `name`.
  if (stop.name_kk && hay.includes(normalizeForStopSearch(stop.name_kk))) {
    score += 8
  }
  if (stop.name_ru && hay.includes(normalizeForStopSearch(stop.name_ru))) {
    score += 6
  }

  return score
}

export function searchStopsByName<T extends StopSearchFields>(
  query: string,
  stops: T[],
  limit: number
): T[] {
  const scored: { stop: T; score: number }[] = []
  for (const s of stops) {
    const score = scoreStopSearchMatch(query, s)
    if (score > 0) scored.push({ stop: s, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((x) => x.stop)
}
