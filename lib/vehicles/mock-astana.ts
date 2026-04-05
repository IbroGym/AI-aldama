import type { MapRouteDTO, MapStopDTO, TransitContextDTO } from "./types"

/** Astana (Nur-Sultan) — default map center */
export const ASTANA_CENTER = { lat: 51.1694, lng: 71.4491 }

/**
 * Minimal GTFS-like network for demos when Supabase has no geometry.
 * Coordinates are approximate public-transit-style points in the city center.
 */
const MOCK_STOPS: MapStopDTO[] = [
  {
    id: "mock-stop-khan",
    stop_code: "MOCK-KHAN",
    name: "Khan Shatyr",
    lat: 51.1258,
    lng: 71.4116,
  },
  {
    id: "mock-stop-opera",
    stop_code: "MOCK-OPERA",
    name: "Astana Opera",
    lat: 51.1239,
    lng: 71.4312,
  },
  {
    id: "mock-stop-baiterek",
    stop_code: "MOCK-BAIT",
    name: "Baiterek",
    lat: 51.1231,
    lng: 71.4304,
  },
  {
    id: "mock-stop-keruen",
    stop_code: "MOCK-KERUEN",
    name: "Keruen City",
    lat: 51.1284,
    lng: 71.4198,
  },
]

const MOCK_ROUTES: MapRouteDTO[] = [
  {
    id: "mock-route-12",
    route_number: "12",
    route_name: "Khan Shatyr — Opera loop",
    color: "#16a34a",
    coordinates: [
      [51.1258, 71.4116],
      [51.1248, 71.418],
      [51.1239, 71.4312],
      [51.1252, 71.428],
      [51.1265, 71.415],
      [51.1258, 71.4116],
    ],
    stop_ids_ordered: ["mock-stop-khan", "mock-stop-keruen", "mock-stop-opera"],
  },
  {
    id: "mock-route-33",
    route_number: "33",
    route_name: "Baiterek — Khan corridor",
    color: "#16a34a",
    coordinates: [
      [51.1231, 71.4304],
      [51.1245, 71.422],
      [51.1258, 71.4116],
      [51.1231, 71.4304],
    ],
    stop_ids_ordered: ["mock-stop-baiterek", "mock-stop-khan"],
  },
  {
    id: "mock-route-51",
    route_number: "51",
    route_name: "Opera — Keruen link",
    color: "#c026d3",
    coordinates: [
      [51.1239, 71.4312],
      [51.126, 71.425],
      [51.1284, 71.4198],
      [51.1239, 71.4312],
    ],
    stop_ids_ordered: ["mock-stop-opera", "mock-stop-keruen"],
  },
]

export function getMockAstanaTransit(): TransitContextDTO {
  return {
    center: ASTANA_CENTER,
    stops: MOCK_STOPS,
    routes: MOCK_ROUTES,
    data_source: "mock",
  }
}
