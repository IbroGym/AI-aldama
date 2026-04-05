import type { MapRouteDTO } from "./types"
import { haversineMeters } from "./geo"
import { ROUTE_12_INBOUND_SHAPE } from "./route-12-inbound-shape"
import { ROUTE_12_OUTBOUND_SHAPE } from "./route-12-outbound-shape"
import { ROUTE_46_INBOUND_SHAPE } from "./route-46-inbound-shape"
import { ROUTE_46_OUTBOUND_SHAPE } from "./route-46-outbound-shape"

export type RouteGeometrySource = "shape_override" | "stop_polyline"

export type ShapePoint = { lat: number; lng: number }

type ShapeOverrideKey = `${string}:${"outbound" | "inbound" | "any"}`

/**
 * Temporary demo-only geometry overrides.
 * Keep this isolated from stop-order overrides so we can replace this
 * wholesale with GTFS `shapes.txt` parsing later.
 */
const ROUTE_10_OUTBOUND_SHAPE: ShapePoint[] = [
  { lat: 51.195, lng: 71.408 },
  { lat: 51.194964, lng: 71.407753 },
  { lat: 51.194789, lng: 71.407657 },
  { lat: 51.194662, lng: 71.407871 },
  { lat: 51.194352, lng: 71.408751 },
  { lat: 51.192308, lng: 71.407099 },
  { lat: 51.191717, lng: 71.406713 },
  { lat: 51.191394, lng: 71.406691 },
  { lat: 51.191259, lng: 71.406959 },
  { lat: 51.190697, lng: 71.408673 },
  { lat: 51.189515, lng: 71.412379 },
  { lat: 51.18896, lng: 71.414233 },
  { lat: 51.188866, lng: 71.414491 },
  { lat: 51.188597, lng: 71.414791 },
  { lat: 51.188052, lng: 71.415188 },
  { lat: 51.187413, lng: 71.415359 },
  { lat: 51.180703, lng: 71.417188 },
  { lat: 51.17573, lng: 71.418487 },
  { lat: 51.1707, lng: 71.420059 },
  { lat: 51.170907, lng: 71.421875 },
  { lat: 51.171318, lng: 71.425713 },
  { lat: 51.167323, lng: 71.426808 },
  { lat: 51.163979, lng: 71.427773 },
  { lat: 51.160325, lng: 71.42875 },
  { lat: 51.157345, lng: 71.429586 },
  { lat: 51.154909, lng: 71.430209 },
  { lat: 51.153832, lng: 71.431754 },
  { lat: 51.152553, lng: 71.434007 },
  { lat: 51.151988, lng: 71.435874 },
  { lat: 51.151905, lng: 71.438775 },
  { lat: 51.1518, lng: 71.443233 },
  { lat: 51.151719, lng: 71.44377 },
  { lat: 51.151302, lng: 71.444414 },
  { lat: 51.150663, lng: 71.444438 },
  { lat: 51.141354, lng: 71.445165 },
  { lat: 51.140667, lng: 71.445208 },
  { lat: 51.139967, lng: 71.445014 },
  { lat: 51.136682, lng: 71.442139 },
  { lat: 51.134393, lng: 71.441195 },
  { lat: 51.133881, lng: 71.441066 },
  { lat: 51.13337, lng: 71.44068 },
  { lat: 51.133074, lng: 71.440015 },
  { lat: 51.13271, lng: 71.439264 },
  { lat: 51.132144, lng: 71.439071 },
  { lat: 51.131619, lng: 71.439285 },
  { lat: 51.130919, lng: 71.439843 },
  { lat: 51.129397, lng: 71.439307 },
  { lat: 51.129666, lng: 71.438057 },
  { lat: 51.131715, lng: 71.424826 },
  { lat: 51.132835, lng: 71.417948 },
  { lat: 51.133302, lng: 71.414266 },
  { lat: 51.127682, lng: 71.413143 },
  { lat: 51.122751, lng: 71.412388 },
  { lat: 51.117798, lng: 71.411521 },
  { lat: 51.113741, lng: 71.410845 },
  { lat: 51.112831, lng: 71.410768 },
  { lat: 51.111767, lng: 71.410489 },
  { lat: 51.106637, lng: 71.408628 },
  { lat: 51.100272, lng: 71.406344 },
  { lat: 51.092419, lng: 71.403492 },
  { lat: 51.089197, lng: 71.402369 },
  { lat: 51.081376, lng: 71.399555 },
  { lat: 51.078323, lng: 71.398449 },
  { lat: 51.073524, lng: 71.396747 },
  { lat: 51.071228, lng: 71.396134 },
  { lat: 51.070729, lng: 71.395705 },
  { lat: 51.070513, lng: 71.395426 },
  { lat: 51.07023, lng: 71.395426 },
  { lat: 51.070109, lng: 71.395876 },
  { lat: 51.070136, lng: 71.396198 },
  { lat: 51.069826, lng: 71.396799 },
  { lat: 51.067075, lng: 71.401264 },
  { lat: 51.063899, lng: 71.406409 },
  { lat: 51.059963, lng: 71.412648 },
  { lat: 51.054462, lng: 71.421438 },
  { lat: 51.048139, lng: 71.431088 },
  { lat: 51.046541, lng: 71.431003 },
  { lat: 51.042645, lng: 71.43112 },
  { lat: 51.041718, lng: 71.431206 },
  { lat: 51.041765, lng: 71.433817 },
  { lat: 51.041761, lng: 71.437795 },
  { lat: 51.041799, lng: 71.441839 },
  { lat: 51.041569, lng: 71.442407 },
  { lat: 51.041178, lng: 71.443019 },
  { lat: 51.030667, lng: 71.459777 },
  { lat: 51.030235, lng: 71.460013 },
  { lat: 51.029763, lng: 71.459713 },
  { lat: 51.028454, lng: 71.457481 },
  { lat: 51.027435, lng: 71.459241 },
  { lat: 51.027323, lng: 71.460641 },
  { lat: 51.027613, lng: 71.461456 },
  { lat: 51.027988, lng: 71.461778 },
  { lat: 51.028312, lng: 71.462379 },
]

const ROUTE_10_INBOUND_SHAPE: ShapePoint[] = [
  { lat: 51.028332, lng: 71.462352 },
  { lat: 51.0287, lng: 71.46291 },
  { lat: 51.028801, lng: 71.462969 },
  { lat: 51.029203, lng: 71.462776 },
  { lat: 51.029547, lng: 71.462261 },
  { lat: 51.032009, lng: 71.458168 },
  { lat: 51.034681, lng: 71.45393 },
  { lat: 51.037569, lng: 71.449231 },
  { lat: 51.041185, lng: 71.443233 },
  { lat: 51.041907, lng: 71.441957 },
  { lat: 51.041884, lng: 71.438528 },
  { lat: 51.041854, lng: 71.432969 },
  { lat: 51.041846, lng: 71.431378 },
  { lat: 51.042514, lng: 71.43129 },
  { lat: 51.045979, lng: 71.431283 },
  { lat: 51.047042, lng: 71.431166 },
  { lat: 51.047984, lng: 71.431185 },
  { lat: 51.048497, lng: 71.43141 },
  { lat: 51.04938, lng: 71.430155 },
  { lat: 51.052301, lng: 71.425263 },
  { lat: 51.054796, lng: 71.421261 },
  { lat: 51.060218, lng: 71.412495 },
  { lat: 51.060467, lng: 71.412235 },
  { lat: 51.060811, lng: 71.411551 },
  { lat: 51.064054, lng: 71.406369 },
  { lat: 51.064276, lng: 71.406157 },
  { lat: 51.064412, lng: 71.405822 },
  { lat: 51.067945, lng: 71.40005 },
  { lat: 51.068135, lng: 71.399967 },
  { lat: 51.068241, lng: 71.399589 },
  { lat: 51.069927, lng: 71.396906 },
  { lat: 51.070385, lng: 71.396552 },
  { lat: 51.070702, lng: 71.396359 },
  { lat: 51.071005, lng: 71.396273 },
  { lat: 51.071221, lng: 71.396273 },
  { lat: 51.074106, lng: 71.397303 },
  { lat: 51.074303, lng: 71.397507 },
  { lat: 51.074659, lng: 71.397475 },
  { lat: 51.081069, lng: 71.399814 },
  { lat: 51.083368, lng: 71.400593 },
  { lat: 51.086306, lng: 71.401659 },
  { lat: 51.088773, lng: 71.402539 },
  { lat: 51.089881, lng: 71.402941 },
  { lat: 51.093719, lng: 71.404331 },
  { lat: 51.093909, lng: 71.404511 },
  { lat: 51.094143, lng: 71.404449 },
  { lat: 51.099614, lng: 71.406401 },
  { lat: 51.100724, lng: 71.406832 },
  { lat: 51.106513, lng: 71.408848 },
  { lat: 51.10846, lng: 71.40968 },
  { lat: 51.10877, lng: 71.409845 },
  { lat: 51.109012, lng: 71.409717 },
  { lat: 51.11112, lng: 71.410478 },
  { lat: 51.112486, lng: 71.410926 },
  { lat: 51.113599, lng: 71.411026 },
  { lat: 51.115162, lng: 71.411369 },
  { lat: 51.117128, lng: 71.411701 },
  { lat: 51.119061, lng: 71.412062 },
  { lat: 51.121775, lng: 71.412495 },
  { lat: 51.12331, lng: 71.412817 },
  { lat: 51.123533, lng: 71.413003 },
  { lat: 51.123869, lng: 71.412892 },
  { lat: 51.126971, lng: 71.413462 },
  { lat: 51.129552, lng: 71.413912 },
  { lat: 51.132212, lng: 71.414351 },
  { lat: 51.133168, lng: 71.414491 },
  { lat: 51.132429, lng: 71.419177 },
  { lat: 51.131258, lng: 71.426564 },
  { lat: 51.130015, lng: 71.434369 },
  { lat: 51.129276, lng: 71.439462 },
  { lat: 51.130202, lng: 71.439875 },
  { lat: 51.13032, lng: 71.440026 },
  { lat: 51.130872, lng: 71.440052 },
  { lat: 51.131242, lng: 71.440637 },
  { lat: 51.131623, lng: 71.441592 },
  { lat: 51.131879, lng: 71.441919 },
  { lat: 51.132303, lng: 71.442016 },
  { lat: 51.132747, lng: 71.44171 },
  { lat: 51.133228, lng: 71.441265 },
  { lat: 51.1337, lng: 71.4412 },
  { lat: 51.134555, lng: 71.441463 },
  { lat: 51.135474, lng: 71.441769 },
  { lat: 51.135915, lng: 71.441951 },
  { lat: 51.136457, lng: 71.442311 },
  { lat: 51.138614, lng: 71.444113 },
  { lat: 51.139806, lng: 71.445047 },
  { lat: 51.140788, lng: 71.445401 },
  { lat: 51.142342, lng: 71.445313 },
  { lat: 51.145002, lng: 71.445165 },
  { lat: 51.147735, lng: 71.444961 },
  { lat: 51.149138, lng: 71.444833 },
  { lat: 51.152001, lng: 71.444521 },
  { lat: 51.152045, lng: 71.443195 },
  { lat: 51.151981, lng: 71.442279 },
  { lat: 51.152195, lng: 71.437263 },
  { lat: 51.15215, lng: 71.436292 },
  { lat: 51.152264, lng: 71.435369 },
  { lat: 51.152526, lng: 71.434543 },
  { lat: 51.152977, lng: 71.433674 },
  { lat: 51.153475, lng: 71.432773 },
  { lat: 51.154007, lng: 71.431775 },
  { lat: 51.154364, lng: 71.431185 },
  { lat: 51.154983, lng: 71.430509 },
  { lat: 51.155575, lng: 71.430155 },
  { lat: 51.157735, lng: 71.429619 },
  { lat: 51.15801, lng: 71.429667 },
  { lat: 51.158273, lng: 71.429425 },
  { lat: 51.161415, lng: 71.428556 },
  { lat: 51.161684, lng: 71.428652 },
  { lat: 51.161933, lng: 71.428449 },
  { lat: 51.165607, lng: 71.427387 },
  { lat: 51.165925, lng: 71.427414 },
  { lat: 51.166872, lng: 71.427033 },
  { lat: 51.169206, lng: 71.426378 },
  { lat: 51.17144, lng: 71.425767 },
  { lat: 51.171026, lng: 71.421858 },
  { lat: 51.170814, lng: 71.42022 },
  { lat: 51.172931, lng: 71.419598 },
  { lat: 51.174904, lng: 71.418976 },
  { lat: 51.176949, lng: 71.418364 },
  { lat: 51.177301, lng: 71.418492 },
  { lat: 51.177453, lng: 71.418203 },
  { lat: 51.18054, lng: 71.417334 },
  { lat: 51.182818, lng: 71.416792 },
  { lat: 51.184205, lng: 71.416326 },
  { lat: 51.186782, lng: 71.415691 },
  { lat: 51.188039, lng: 71.415306 },
  { lat: 51.188657, lng: 71.41507 },
  { lat: 51.188825, lng: 71.414931 },
  { lat: 51.189287, lng: 71.413766 },
  { lat: 51.189262, lng: 71.413429 },
  { lat: 51.19091, lng: 71.408363 },
  { lat: 51.191347, lng: 71.406949 },
  { lat: 51.191515, lng: 71.406788 },
  { lat: 51.191851, lng: 71.406916 },
  { lat: 51.192557, lng: 71.407431 },
  { lat: 51.192793, lng: 71.407624 },
  { lat: 51.192853, lng: 71.407909 },
  { lat: 51.193035, lng: 71.407818 },
  { lat: 51.194299, lng: 71.408858 },
  { lat: 51.193956, lng: 71.410006 },
  { lat: 51.193909, lng: 71.410564 },
  { lat: 51.19403, lng: 71.410757 },
  { lat: 51.194184, lng: 71.410575 },
  { lat: 51.194339, lng: 71.410178 },
  { lat: 51.194615, lng: 71.409255 },
  { lat: 51.195, lng: 71.408 },
]

function validateRoute10Shape(points: ShapePoint[], direction: "outbound" | "inbound") {
  let totalM = 0
  let suspicious = false
  for (let i = 1; i < points.length; i++) {
    const segM = haversineMeters(points[i - 1], points[i])
    totalM += segM
    if (segM > 2000 && !suspicious) {
      suspicious = true
      console.warn("Suspicious long segment in route 10 shape")
    }
  }

  console.info(
    `Route 10 shape loaded: dir=${direction} points=${points.length} total_m=${totalM.toFixed(
      1,
    )}`,
  )
}

validateRoute10Shape(ROUTE_10_OUTBOUND_SHAPE, "outbound")
validateRoute10Shape(ROUTE_10_INBOUND_SHAPE, "inbound")

const SHAPE_OVERRIDES: Partial<Record<ShapeOverrideKey, ShapePoint[]>> = {
  "10:outbound": ROUTE_10_OUTBOUND_SHAPE,
  "10:inbound": ROUTE_10_INBOUND_SHAPE,
  "12:outbound": ROUTE_12_OUTBOUND_SHAPE as ShapePoint[],
  "12:inbound": ROUTE_12_INBOUND_SHAPE as ShapePoint[],
  "46:outbound": ROUTE_46_OUTBOUND_SHAPE as ShapePoint[],
  "46:inbound": ROUTE_46_INBOUND_SHAPE as ShapePoint[],
}

export function getRouteShapeOverride(params: {
  route_number: string
  direction?: MapRouteDTO["direction"]
}): [number, number][] | null {
  const routeNumber = params.route_number.trim()
  const direction = params.direction ?? "any"

  const direct = SHAPE_OVERRIDES[`${routeNumber}:${direction}`]
  if (direct && direct.length > 1) {
    return direct.map((p) => [p.lat, p.lng] as [number, number])
  }

  const anyDirection = SHAPE_OVERRIDES[`${routeNumber}:any`]
  if (anyDirection && anyDirection.length > 1) {
    return anyDirection.map((p) => [p.lat, p.lng] as [number, number])
  }

  return null
}
