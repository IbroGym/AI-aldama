import type { Locale } from "@/lib/i18n/config"

/** Curated points of interest when DB stops do not use the same names as passengers. */
export type Landmark = {
  id: string
  /** Lowercase / normalized fragments for matching */
  synonyms: string[]
  lat: number
  lng: number
  label: { ru: string; kk: string; en: string }
}

/**
 * Approximate public coordinates (Astana / Nur-Sultan).
 * Refine against your map source when needed; used only for nearest-stop hints.
 *
 * New row template:
 * { id: "snake_case", synonyms: ["phrase", "синоним"], lat: 51.xx, lng: 71.xx,
 *   label: { ru: "...", kk: "...", en: "..." } },
 */
export const ASTANA_LANDMARKS: Landmark[] = [
  {
    id: "baiterek",
    synonyms: [
      "baiterek",
      "bayterek",
      "байтерек",
      "бәйтерек",
      "tree of life",
      "монумент астана",
    ],
    lat: 51.125278,
    lng: 71.430556,
    label: {
      ru: "Байтерек",
      kk: "Бәйтерек",
      en: "Baiterek Tower",
    },
  },
  {
    id: "khan_shatyr",
    synonyms: ["khan shatyr", "хан шатыр", "ханшатыр", "хан-шатыр", "khanshatyr"],
    lat: 51.127222,
    lng: 71.411389,
    label: {
      ru: "Хан Шатыр",
      kk: "Хан Шатыр",
      en: "Khan Shatyr",
    },
  },
  {
    id: "astana_opera",
    synonyms: [
      "astana opera",
      "астана опера",
      "astana opera house",
      "театр оперы",
      "опера балет",
      "опера",
    ],
    lat: 51.124722,
    lng: 71.416944,
    label: {
      ru: "Театр оперы и балета «Астана Опера»",
      kk: "«Астана Опера» опера және балет театры",
      en: "Astana Opera House",
    },
  },
  {
    id: "hazrat_sultan",
    synonyms: [
      "hazrat sultan",
      "азрет султан",
      "әзірет сұлтан",
      "мечеть хазрет",
      "mosque astana",
    ],
    lat: 51.1244,
    lng: 71.4725,
    label: {
      ru: "Мечеть Хазрет Султан",
      kk: "Әзірет Сұлтан мешіті",
      en: "Hazrat Sultan Mosque",
    },
  },
  {
    id: "nur_alem",
    synonyms: ["nur alem", "нұр әлем", "нур алем", "sphere expo", "экспо шар", "expo 2017"],
    lat: 51.088611,
    lng: 71.417778,
    label: {
      ru: "Нур-Алем (ЭКСПО)",
      kk: "Нұр Әлем (ЭКСПО)",
      en: "Nur-Alem (EXPO)",
    },
  },
  {
    id: "mega_silk_way",
    synonyms: ["mega silk way", "мега", "mega astana", "mega silkway"],
    lat: 51.0942,
    lng: 71.4184,
    label: {
      ru: "ТРЦ Mega Silk Way",
      kk: "Mega Silk Way СОО",
      en: "Mega Silk Way mall",
    },
  },
  {
    id: "keruen_city",
    synonyms: ["keruen", "керуен", "keruen city"],
    lat: 51.1284,
    lng: 71.4198,
    label: {
      ru: "ТРЦ «Керуен Сити»",
      kk: "«Керуен Сити» СОО",
      en: "Keruen City mall",
    },
  },

  {
    id: "independence_square",
    synonyms: [
      "independence square",
      "площадь независимости",
      "тауелсиздік алаңы",
      "tauelsizdik",
      "kazakh eli",
      "қазақ елі",
      "kazakheli",
      "монумент независимости",
    ],
    lat: 51.123056,
    lng: 71.428889,
    label: {
      ru: "Площадь Независимости / Қазақстан",
      kk: "Тәуелсіздік алаңы / Қазақстан",
      en: "Independence Square / Qazaqstan monument",
    },
  },

  {
    id: "abu_dhabi_plaza",
    synonyms: [
      "abu dhabi plaza",
      "абу даби плаза",
      "abu dhabi",
      "абу-даби",
    ],
    lat: 51.126389,
    lng: 71.433889,
    label: {
      ru: "Abu Dhabi Plaza",
      kk: "Abu Dhabi Plaza",
      en: "Abu Dhabi Plaza",
    },
  },

  {
    id: "national_museum",
    synonyms: [
      "national museum",
      "музей национальный",
      "национальный музей",
      "құлпытастар мұражайы",
      "ұлттық мұражай",
      "ulttyk murajai",
    ],
    lat: 51.129722,
    lng: 71.470278,
    label: {
      ru: "Национальный музей Республики Казахстан",
      kk: "Қазақстан Республикасының Ұлттық мұражайы",
      en: "National Museum of Kazakhstan",
    },
  },

  {
    id: "nazarbayev_center",
    synonyms: [
      "nazarbayev center",
      "назарбаев центр",
      "нұрсұлтан назарбаев центрі",
      "nursultan nazarbayev center",
    ],
    lat: 51.119722,
    lng: 71.468056,
    label: {
      ru: "Центр Назарбаева",
      kk: "Назарбаев орталығы",
      en: "Nazarbayev Center",
    },
  },

  {
    id: "akorda",
    synonyms: [
      "akorda",
      "акорда",
      "ақорда",
      "presidential palace astana",
      "резидентура",
    ],
    lat: 51.118889,
    lng: 71.468889,
    label: {
      ru: "Резиденция Президента «Акорда»",
      kk: "«Ақорда» Президент резиденциясы",
      en: "Akorda Presidential Palace",
    },
  },

  {
    id: "nazarbayev_university",
    synonyms: [
      "nazarbayev university",
      "nu astana",
      "ngu",
      "нгу",
      "ну астана",
      "назарбаев университет",
      "назарбаев университеті",
      "nazarbayev univ",
    ],
    lat: 51.090833,
    lng: 71.398056,
    label: {
      ru: "Университет Назарбаева",
      kk: "Назарбаев Университеті",
      en: "Nazarbayev University",
    },
  },

  {
    id: "enu_gumilyov",
    synonyms: [
      "enu",
      "ену",
      "gumilyov university",
      "гумилев",
      "гумилёв",
      "ұлттық университет",
      "eurasian university",
      "евразийский университет",
      "евразийский национальный",
    ],
    lat: 51.090556,
    lng: 71.418889,
    label: {
      ru: "Евразийский национальный университет им. Л.Н. Гумилёва",
      kk: "Л.Н. Гумилёв атындағы Еуразия ұлттық университеті",
      en: "L.N. Gumilyov Eurasian National University",
    },
  },

  {
    id: "astana_arena",
    synonyms: [
      "astana arena",
      "астана арена",
      "астана арэна",
      "arena astana",
      "стадион астана",
    ],
    lat: 51.112778,
    lng: 71.395833,
    label: {
      ru: "«Астана Арена»",
      kk: "«Астана Арена» стадионы",
      en: "Astana Arena",
    },
  },

  {
    id: "saryarka_velodrome",
    synonyms: [
      "saryarka",
      "сарыарка",
      "велотрек",
      "velodrome",
      "saryarka velodrome",
    ],
    lat: 51.109167,
    lng: 71.418056,
    label: {
      ru: "Велотрек «Сарыарка»",
      kk: "«Сарыарка» велотрегі",
      en: "Saryarka Velodrome",
    },
  },

  {
    id: "capital_circus",
    synonyms: [
      "capital circus",
      "цирк столицы",
      "астана цирк",
      "астана циркі",
      "circus astana",
    ],
    lat: 51.126944,
    lng: 71.414444,
    label: {
      ru: "«Цирк столицы»",
      kk: "«Бас қаланың циркі»",
      en: "Capital Circus",
    },
  },

  {
    id: "asia_park",
    synonyms: ["asia park", "азия парк", "азияпарк", "asia mall"],
    lat: 51.132222,
    lng: 71.421944,
    label: {
      ru: "ТРЦ Asia Park",
      kk: "Asia Park СОО",
      en: "Asia Park mall",
    },
  },

  {
    id: "forum_astana",
    synonyms: [
      "forum astana",
      "форум астана",
      "forum mall",
      "green mall",
      "greenmall",
      "зелёный молл",
      "зеленый молл",
    ],
    lat: 51.098889,
    lng: 71.404722,
    label: {
      ru: "ТРЦ Forum / Green Mall",
      kk: "Forum / Green Mall СОО",
      en: "Forum / Green Mall",
    },
  },

  {
    id: "nurly_zhol_station",
    synonyms: [
      "nurly zhol",
      "нұрлы жол",
      "нурлы жол",
      "новый вокзал",
      "жаңа вокзал",
      "станция нурлы жол",
    ],
    lat: 51.045833,
    lng: 71.433889,
    label: {
      ru: "«Нұрлы жол» (новый ж/д вокзал)",
      kk: "«Нұрлы жол» теміржол вокзалы",
      en: "Nurly Zhol railway station",
    },
  },

  {
    id: "megacenter_astana",
    synonyms: [
      "megacenter",
      "мегацентр",
      "mega center astana",
      "megacenter astana",
    ],
    lat: 51.122778,
    lng: 71.428056,
    label: {
      ru: "ТРЦ Megacenter",
      kk: "Megacenter СОО",
      en: "Megacenter mall",
    },
  },
]

function normalizeQuery(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

export function landmarkDisplayName(lm: Landmark, locale: Locale): string {
  if (locale === "kk") return lm.label.kk
  if (locale === "en") return lm.label.en
  return lm.label.ru
}

/**
 * Best landmark match for passenger text (question fragment or place name).
 */
export function findLandmarkByQuery(query: string): Landmark | null {
  const q = normalizeQuery(query)
  if (q.length < 2) return null

  let best: { landmark: Landmark; score: number } | null = null

  for (const lm of ASTANA_LANDMARKS) {
    let score = 0
    for (const syn of lm.synonyms) {
      const s = syn.trim().toLowerCase()
      if (!s) continue
      if (q === s) score += 120
      else if (q.includes(s)) score += Math.min(100, 12 + s.length * 6)
      else if (s.includes(q) && q.length >= 3) score += Math.min(80, 10 + q.length * 8)
    }

    const tokens = q.split(/[\s,.;:!?\-–—]+/).filter((t) => t.length >= 2)
    for (const tok of tokens) {
      for (const syn of lm.synonyms) {
        const s = syn.toLowerCase()
        if (tok.length >= 3 && (s.includes(tok) || tok.includes(s))) score += 25
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { landmark: lm, score }
    }
  }

  // Avoid weak substring noise for very short queries
  if (!best || best.score < 22) return null
  return best.landmark
}
