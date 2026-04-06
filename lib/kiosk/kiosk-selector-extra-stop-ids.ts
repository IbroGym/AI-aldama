/**
 * Teatr Astana Opera — `public.bus_stops.id` (inbound-side; toward railway in overrides).
 * Present on route 12 inbound + route 46 inbound sequences in `route-overrides.ts`.
 */
export const KIOSK_TEATR_ASTANA_OPERA_STOP_ID =
  "0ae68bb8-6b0d-4025-8898-16debf368904" as const

/**
 * `public.bus_stops.id` values always shown in the kiosk stop picker,
 * even when `has_display` is false (alongside `has_display.eq.true` rows).
 */
export const KIOSK_SELECTOR_EXTRA_STOP_IDS: readonly string[] = [
  KIOSK_TEATR_ASTANA_OPERA_STOP_ID,
]
