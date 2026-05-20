type StopLike = {
  id: string
  name: string
  stop_code: string
}

type RouteLike = {
  id: string
  route_number: string
  route_name: string
}

type RouteStopLike = {
  stop_id: string
  stop_sequence: number
}

type DirectionName = "outbound" | "inbound"

type OverrideDirection = {
  from: string
  to: string
  stops: string[]
}

type RouteOverrideDefinition = {
  route_number: string
  directions: Record<DirectionName, OverrideDirection>
}

type MatchKind = "exact" | "fuzzy" | "unresolved"

type ResolutionReport = {
  route_number: string
  direction: DirectionName
  route_id: string | null
  route_name: string | null
  source: "override" | "db"
  trusted_total: number
  resolved_total: number
  exact_matches: string[]
  fuzzy_matches: Array<{ trusted: string; matched: string; score: number }>
  unresolved: string[]
  resolved_entries: Array<{ trusted: string; stop_id: string; matched_name: string }>
  warnings: string[]
}

export type RouteDirectionDebug = {
  route_id: string
  route_number: string
  outbound_stop_ids: string[]
  inbound_stop_ids: string[]
  source: "stop_code_override" | "name_resolved" | "db"
  warnings: string[]
}

export type RouteOrderDiagnostics = {
  route_id: string
  route_number: string
  route_name: string
  order_source: "override" | "db"
  direction?: DirectionName
  warnings: string[]
}

export type RouteOverrideResult = {
  orderedStopIdsByRouteId: Map<string, string[]>
  directionDebugByRouteId: Map<string, RouteDirectionDebug>
  diagnostics: RouteOrderDiagnostics[]
  resolutionReports: ResolutionReport[]
}

const MIN_RESOLVED_STOPS = 4
const FUZZY_THRESHOLD = 0.72
const AMBIGUITY_DELTA = 0.035
/** `public.bus_stops.id` — authoritative Route 10 outbound stop order (railway → airport). */
export const ROUTE_10_OUTBOUND_STOP_IDS: string[] = [
  "a9adbb0f-d9f8-43d7-9084-dc71cf757017",
  "1dfcecbe-0598-4939-ba47-2792ca0d485b",
  "3d46ae56-d985-4ce1-b19d-816528668c27",
  "ffb3a537-c990-48bc-ba56-e48d0b4d9ba3",
  "0830b7eb-4cef-4818-8675-ddfdb0c7e728",
  "e4f74146-5a78-4296-b355-163f119017fc",
  "f53b397e-e054-4a81-8966-8ffc91425fd8",
  "ee15c1bb-fe6b-48f6-9914-cbabf4586359",
  "45b5cc2c-6354-4408-a0cb-d6f5a02a8b8e",
  "406269e4-ee95-4eed-af68-d8f42c15d678",
  "adce11f6-9ef0-4384-9fc2-54a1c9665696",
  "2b9116c0-b122-43a7-9cf9-388a6952c519",
  "d32bd070-6d4e-45a8-bf89-9897080b6bfa",
  "146de365-3e9b-4301-9a3a-e48817c4c5c0",
  "9a8dbd07-3c87-4fc8-abb8-74dc677d4700",
  "ed159e65-b201-480e-9bd2-7fc36378060a",
  "e2e8f49f-00b0-4c17-978d-8e63615efee8",
  "d3358c97-d105-4892-8952-5ac4ddb442ef",
  "d8ec8a17-4ca9-456d-ac21-8efe94e5e660",
  "a9566d81-a191-47aa-a4dc-70ea4c6b0e83",
  "81604937-c91b-482d-89bd-4efb9c83ee45",
  "95caf55d-a75a-4fe8-9175-e87554ecca1c",
  "b639195e-9a74-4f46-868b-b6692420a3de",
  "21768934-279d-4ace-a962-0e638546a0ef",
  "5b8a51df-21e2-4493-a2e5-2ed963d69781",
  "d2d7b19b-4136-4b44-b832-1c0cbe5fa7af",
  "e6103f47-14ec-4c2f-beaf-30afee8480c6",
  "f025bd0e-f9ee-488c-955d-98b363ed05b8",
  "0f554a3d-dceb-47cf-bdc9-3556c836f5db",
  "6fb11b7b-f624-426f-b382-5b905bf2c2a8",
  "2bf57317-982f-477e-ace9-107adf538820",
  "9cd87750-8777-4035-bb54-02804977f733",
  "b7a0f6ac-1880-4249-9573-eb48c7cc9a35",
  "d5332b55-fde0-4dcb-a9bd-89e563bcc6f2",
  "19362545-6900-4aae-9f6c-081a2a5e16b0",
  "8c4ad112-e945-4ebf-ace1-1ac761470bfc",
]

/** `public.bus_stops.id` — authoritative Route 10 inbound stop order (airport → railway). */
export const ROUTE_10_INBOUND_STOP_IDS: string[] = [
  "8c4ad112-e945-4ebf-ace1-1ac761470bfc",
  "80338c35-6703-4c0f-b831-aca3afa3a279",
  "fa7f84ee-33a5-4edb-9a28-9c3ed44f0963",
  "9a0b5714-13ea-401a-8c9a-e8c2a79ef5e2",
  "36719798-850b-490c-a567-4fa9d276a42e",
  "3ef339dd-93fa-4cc0-aa0f-f25b24ac750e",
  "a495bed9-0103-4a48-98e5-145ebd3da30e",
  "b3f915ce-0da2-43ec-9e16-8208aa650b51",
  "ff4cddc7-780c-4572-bd9d-2182d9b011ef",
  "2e11f77b-e8a2-40d1-a3e0-1ba1b6595d7c",
  "fc6f4604-832d-4d2c-a8f7-8c3ac58cd155",
  "e05a8947-123a-4648-ab33-e453b800b2c5",
  "95ac140c-ef7f-4f0c-a78f-2915c58da204",
  "7a9e7a00-d5ed-40c8-9804-d16baf6555a9",
  "903bfe31-799b-431f-aa46-f01b143f722c",
  "e615d78e-fb65-4fac-a8fc-d13df60cc89b",
  "7f9bfee1-e5df-49d9-9bf6-22cbc923fe33",
  "00e3da42-2480-433c-bc53-b5d86c997e52",
  "3e4efd1c-b54f-40ca-ad00-f7461fe834aa",
  "28d46110-8c8b-4e40-a826-672c3cc8ab2f",
  "d7c8a98a-cee0-4225-bc8a-fbc5286a3e69",
  "cb6b7be7-9469-4270-add7-d6ee53e7dc7c",
  "1f48306b-7059-434d-ac20-aa05073980c6",
  "2ad8eaaf-0637-483a-9c9a-ca1eaafda630",
  "6b21616a-10e1-42ec-8859-2cf479100c0c",
  "a9c94fae-8d1a-4328-aa83-43bd09adb565",
  "775e9d11-481a-4254-b4b0-c45233177219",
  "5d659759-49c4-446d-8a4e-39244625203a",
  "6778b537-a71e-458f-bd02-cd02f06f6f2f",
  "875bb9bc-ca37-4fb1-8201-c5d266195f67",
  "7dfa8094-84c2-4f29-97c3-d9014e34b179",
  "0f6c7a9e-56a2-42a2-9680-468d737d9e39",
  "bf2dbe1a-e02f-482d-a8c0-f8bb6c1e40b3",
  "f7180580-7743-4ed3-8a27-e1df3dfee535",
  "97e51874-aa6b-4633-b6d6-125d58a39aef",
  "6029c12a-8f9b-411f-98b8-fa198b4b870b",
  "360660cc-4727-491b-ab9d-17352b49e551",
  "d8308bf5-f6e3-4063-82bc-6f614de6a643",
  "a9adbb0f-d9f8-43d7-9084-dc71cf757017",
]

/** `public.bus_stops.id` — authoritative Route 12 outbound stop order (railway → airport). */
export const ROUTE_12_OUTBOUND_STOP_IDS: string[] = [
  "a9adbb0f-d9f8-43d7-9084-dc71cf757017",
  "f43ad2c6-e929-4adb-9193-0b941589fde7",
  "b95704f4-53a1-44ad-81ac-c8e3e096f55b",
  "f1a651bb-9f0a-4b79-b24c-8860e2414b17",
  "fc4e6f95-9c1d-4140-af02-42798d29e9d2",
  "2ab617f3-ae13-4342-a081-acfac88b08e1",
  "9c4d7da0-372a-4f29-95ab-124a69ed0b5c",
  "6f215480-0e7a-4895-9036-016f483372e8",
  "58aa8112-1117-44e8-8b13-4d6e740a0d8d",
  "89cce566-e562-4822-80d8-21baf7fa01e2",
  "b291e82e-dc84-4953-9802-d902d12a510c",
  "6148fe37-0bd2-4f90-8a10-8ee1727713c9",
  "d7c8a98a-cee0-4225-bc8a-fbc5286a3e69",
  "cb6b7be7-9469-4270-add7-d6ee53e7dc7c",
  "1f48306b-7059-434d-ac20-aa05073980c6",
  "230f5f2e-7cfc-4c72-b0b5-2070ad304dda",
  "a93cf493-9a22-4ebd-90af-8fcfbc3b815e",
  "971bbf17-37ad-464d-afec-34478d0fe940",
  "72dfa0b3-2e5e-4fa5-808c-b988efebab18",
  "9e9fd318-3588-4fbf-8b55-844f8def6e6c",
  "30009031-c562-4173-94ce-dd6b04fb9c52",
  "87b4c4d2-e450-47bb-8167-ba30517d3584",
  "ccf3c3ce-1eb6-401a-9ad0-890002d77398",
  "25541b73-6493-4727-84c0-10a15d8909d9",
  "4c3156a7-626d-4a27-a7c0-73dcd13de812",
  "ad73c782-8941-443c-811a-dbbbd7bd276d",
  "e04ab35c-c18a-4df8-a356-22b1fd7f171d",
  "f8833d5d-6899-4ee7-9f45-b4861942acc3",
  "5b3a1376-dbac-4f61-a8b7-5e800273ad74",
  "e157cf9b-5ce5-4341-b367-45ef8ff51c7b",
  "2bf57317-982f-477e-ace9-107adf538820",
  "9cd87750-8777-4035-bb54-02804977f733",
  "c88f23b4-8c48-4756-b906-6a6589a78c1e",
  "f404a5e7-46cd-45b9-a4a5-e7a1b31d07d1",
  "22bcafea-faa2-4f03-b12a-982d0534b454",
  "d5332b55-fde0-4dcb-a9bd-89e563bcc6f2",
  "19362545-6900-4aae-9f6c-081a2a5e16b0",
  "8c4ad112-e945-4ebf-ace1-1ac761470bfc",
]

/** `public.bus_stops.id` — authoritative Route 12 inbound stop order (airport → railway). */
export const ROUTE_12_INBOUND_STOP_IDS: string[] = [
  "8c4ad112-e945-4ebf-ace1-1ac761470bfc",
  "80338c35-6703-4c0f-b831-aca3afa3a279",
  "fa7f84ee-33a5-4edb-9a28-9c3ed44f0963",
  "084d1faa-1760-4e73-b87f-402f162e322d",
  "7f2b8049-6f1b-4dac-923f-a5ce44159857",
  "36719798-850b-490c-a567-4fa9d276a42e",
  "3ef339dd-93fa-4cc0-aa0f-f25b24ac750e",
  "a495bed9-0103-4a48-98e5-145ebd3da30e",
  "1dd16afc-a1a9-40df-bd41-8abedb41d474",
  "a42908e2-ec24-4691-ae94-c21c7d11010f",
  "e82fe9d6-6d49-41e0-8d2f-5a893c86c07d",
  "800a80ce-23a3-4fe1-964f-6f16f36da46b",
  "3ffe7673-eb09-4c19-981f-a6dc16ccafa7",
  "639fb7f4-03de-4101-a720-b40e2c331ce6",
  "7fbd2e34-0ae5-4fe9-a862-c5e51805b825",
  "0845f091-2b52-4028-b04b-42962dfc625e",
  "73d72c5a-d453-487f-89b1-2a0229bc7d58",
  "6cb3bdad-7007-4089-944e-7f5a81554422",
  "e33a4a65-00ac-47c5-b596-fc24579461f1",
  "513f23f3-920b-4595-8687-21dd8a40f880",
  "391f204d-d43b-48ee-8165-5376e411756c",
  "590dd9f3-dfe6-41cc-b20f-5a42ad2b720b",
  "677b8609-b770-428d-a839-7ab974533cda",
  "146de365-3e9b-4301-9a3a-e48817c4c5c0",
  "9a8dbd07-3c87-4fc8-abb8-74dc677d4700",
  "ed159e65-b201-480e-9bd2-7fc36378060a",
  "0ae68bb8-6b0d-4025-8898-16debf368904",
  "c4111e18-d665-4eea-9457-dbab7b0e2db4",
  "523212ae-53cd-459e-bc9c-c43e93cad377",
  "e9ef5ec1-f6e2-48bb-9fad-e70b78d534e0",
  "fe270511-6de7-4199-af42-d62c27de4412",
  "c2d9a8ef-0ba9-40a2-8bdb-5b56a7935569",
  "30cb809d-3e37-4032-9dd1-cddbb4884014",
  "87814294-45e9-48cf-93a5-0d894ce7cc6a",
  "7d6ebb5c-57c7-4e9f-8a12-d2ab9c287fbd",
  "7c6bda6d-79a5-4cff-8455-1e9775f1ec4b",
  "46260777-0034-4d2a-9609-8bb0bcf5c582",
  "4c8169c1-1f16-4d91-a410-32409ee95a4c",
  "672f861d-d095-4c8e-886c-1758f3a43539",
  "76079b7a-41a8-40eb-bebd-e111c4f83830",
  "d8308bf5-f6e3-4063-82bc-6f614de6a643",
  "a9adbb0f-d9f8-43d7-9084-dc71cf757017",
]

/** `public.bus_stops.id` — authoritative Route 46 outbound stop order. */
export const ROUTE_46_OUTBOUND_STOP_IDS: string[] = [
  "6e0f2eb6-c144-4f73-8628-20f062f8f9b4",
  "944c30c5-9c8b-4b83-9b15-d3c9f8ad0267",
  "3feece80-16e2-4be4-b877-4b835cebdb55",
  "55f334b4-a2aa-4167-9a69-baf050dc888a",
  "b63c2105-df1d-4e13-97c4-3b5a77732aeb",
  "d451a22c-4be8-411d-a3ff-f794e21e2cc3",
  "81ec1955-96fe-498c-ad24-bdf9adac0776",
  "76566165-102d-4d2e-9a5e-1f738496c6c8",
  "9dcaf554-5443-43f7-aea6-4122d4b08a9e",
  "f908a8f1-39d7-4b48-b398-0974ea73cd69",
  "6e9b7f98-ced1-4e6e-bea0-c60837a01677",
  "7e3aedbe-061e-4668-8cb2-cbe033cd5886",
  "45ed5115-27e6-4c15-971c-1c424a4dfd4a",
  "66a7bbc1-b134-4e90-bb17-ac276ab53eae",
  "c06d5588-daef-436d-ae2c-03285da76243",
  "bcc50893-bb3c-42d1-9b7b-5c346c354fa9",
  "c260516b-1c89-4497-be5f-f901519c17b4",
  "4abaad75-7534-4155-8f4a-2b03dcc25f2c",
  "cc0c7f56-575e-4084-9b7c-367e15eb16bc",
  "a16ab07e-740c-46e9-b410-fc0a246a2183",
  "c1fa3e33-3769-43cd-9be6-c6590f4d5225",
  "1f79ffe9-c2dc-4f5d-a0b6-b024c56f8ee0",
  "2ab617f3-ae13-4342-a081-acfac88b08e1",
  "9c4d7da0-372a-4f29-95ab-124a69ed0b5c",
  "6f215480-0e7a-4895-9036-016f483372e8",
  "58aa8112-1117-44e8-8b13-4d6e740a0d8d",
  "89cce566-e562-4822-80d8-21baf7fa01e2",
  "b291e82e-dc84-4953-9802-d902d12a510c",
  "6148fe37-0bd2-4f90-8a10-8ee1727713c9",
  "7f1734d2-4f20-44b5-b36c-40fdfbd095fe",
  "aaccb97c-13df-4e51-b2f0-342da62e3fab",
  "5c02cbb4-a8a5-4729-8e73-6a584ce54390",
  "28d46110-8c8b-4e40-a826-672c3cc8ab2f",
  "963b19b2-79f1-4ba1-9b1e-f88aeeb36044",
  "56c69c60-af3c-4f5a-bfbc-e324324d6fba",
  "1f48306b-7059-434d-ac20-aa05073980c6",
  "230f5f2e-7cfc-4c72-b0b5-2070ad304dda",
  "a93cf493-9a22-4ebd-90af-8fcfbc3b815e",
  "971bbf17-37ad-464d-afec-34478d0fe940",
  "72dfa0b3-2e5e-4fa5-808c-b988efebab18",
  "9e9fd318-3588-4fbf-8b55-844f8def6e6c",
  "30009031-c562-4173-94ce-dd6b04fb9c52",
  "87b4c4d2-e450-47bb-8167-ba30517d3584",
  "c7e5d98f-1553-4e2e-b805-8626602f2da9",
  "ff78d4c1-be14-4394-86f7-6fd0fca30d5d",
  "59bcf0b7-9807-41b3-b745-796549ec6334",
  "d3c430fc-56ec-4540-b971-ebca0832c725",
]

/** `public.bus_stops.id` — authoritative Route 46 inbound stop order. */
export const ROUTE_46_INBOUND_STOP_IDS: string[] = [
  "d3c430fc-56ec-4540-b971-ebca0832c725",
  "605ccc1e-23cb-4e9a-b197-22a63e5a956a",
  "d8c9f6df-19e4-4859-b94b-fa547a145e70",
  "60034083-7e60-4a6c-a043-067d89bad17f",
  "3a45f51b-d45d-4519-a07d-fa6cfbaee162",
  "0845f091-2b52-4028-b04b-42962dfc625e",
  "73d72c5a-d453-487f-89b1-2a0229bc7d58",
  "6cb3bdad-7007-4089-944e-7f5a81554422",
  "e33a4a65-00ac-47c5-b596-fc24579461f1",
  "513f23f3-920b-4595-8687-21dd8a40f880",
  "391f204d-d43b-48ee-8165-5376e411756c",
  "590dd9f3-dfe6-41cc-b20f-5a42ad2b720b",
  "677b8609-b770-428d-a839-7ab974533cda",
  "146de365-3e9b-4301-9a3a-e48817c4c5c0",
  "ee3ef047-6a12-4eaf-a2fe-c8baf711e89b",
  "e4add2a3-fa86-4511-8540-c5006fbb69ac",
  "e2e8f49f-00b0-4c17-978d-8e63615efee8",
  "8f3f9eba-d6e5-4eea-8996-4bb2bfb02463",
  "0ae68bb8-6b0d-4025-8898-16debf368904",
  "c4111e18-d665-4eea-9457-dbab7b0e2db4",
  "523212ae-53cd-459e-bc9c-c43e93cad377",
  "e9ef5ec1-f6e2-48bb-9fad-e70b78d534e0",
  "fe270511-6de7-4199-af42-d62c27de4412",
  "c2d9a8ef-0ba9-40a2-8bdb-5b56a7935569",
  "30cb809d-3e37-4032-9dd1-cddbb4884014",
  "87814294-45e9-48cf-93a5-0d894ce7cc6a",
  "7d6ebb5c-57c7-4e9f-8a12-d2ab9c287fbd",
  "9b63574a-d692-41b6-85ff-1641e1fec677",
  "e499f8f0-4fc2-43e2-827e-ffa39e366555",
  "cc0c7f56-575e-4084-9b7c-367e15eb16bc",
  "1feff38e-8e78-4cfe-8f9e-2260e688c92e",
  "709169e0-d534-4c03-b37c-2821ada3a79f",
  "27281a1c-7b14-484b-8820-f7fae2d080fd",
  "17615410-f70d-484d-bbc4-8fee4e3371f1",
  "917927a8-1a41-4b75-b34b-251ef79a76d6",
  "fb1afe6a-d227-4a75-a09d-a699ddb7135c",
  "44d8f22a-8e9a-4e34-a4ca-a34c4204362f",
  "e8a2acd2-e2e7-4b1d-ac99-8d2e7a51566b",
  "7035dd11-761b-40a9-860b-24d9b1b48c78",
  "452e2953-e249-4376-bb88-5b0ce9c6a6b2",
  "620a85b4-3547-42e8-a605-b8e0bbacb6a7",
  "85c0319a-42f0-404e-8dea-ade4ede1f12b",
  "7f9d77fe-90fc-4b6b-8d9e-03b19f935809",
  "5391b527-9aca-4609-bfff-f4bc06028e92",
  "27d8a517-89c8-461a-978c-4d130be266ca",
  "78b8c8b2-0656-44ce-ab21-d10e44c42117",
  "944c30c5-9c8b-4b83-9b15-d3c9f8ad0267",
  "6e0f2eb6-c144-4f73-8628-20f062f8f9b4",
]

/** Normalized key for matching override `stop_code` to loaded rows. */
export function normalizeStopCodeForLookup(code: string): string {
  return code.trim().toLowerCase()
}

const ROUTE_OVERRIDES: RouteOverrideDefinition[] = [
  {
    route_number: "10",
    directions: {
      outbound: {
        from: "Ж/д вокзал Астана 1",
        to: "Международный аэропорт",
        stops: [
          "Ж/д вокзал Астана 1",
          "Биржан сал",
          "Ильяса Есенберлина",
          "Агротехнический университет",
          "Медицинский университет Астана",
          "Политехнический колледж",
          "БЦ Марден",
          "Народный банк",
          "Амангельды Иманова",
          "Жанибек Тархана",
          "Микрорайон Самал",
          "Парк Ататюрк",
          "Амман",
          "Дом Министерств",
          "НК Казахстан Темир Жолы",
          "Динмухамеда Кунаева",
          "Кардиохирургическая клиника",
          "Центр нейрохирургии",
          "БЦ Асыл-тау",
          "Дворец единоборств им. Жаксылыка Ушкемпирова",
          "Стадион Астана-Арена",
          "Ледовый дворец Алау",
          "ЖК Экспо-Плаза",
          "Назарбаев университет",
          "Центральный госпиталь МВД РК",
          "ЖК Будапешт",
          "Стелла Звезда Астаны",
          "Шоссе Каркаралы",
          "ЖК Family Park",
          "Канал Нура-Есиль",
          "Садоводческое общество Авиатор",
          "ул. Жанадария",
          "ж/м Пригородный",
          "Арнасай",
          "Мечеть Альжан Ана",
          "Международный аэропорт",
        ],
      },
      inbound: {
        from: "Международный аэропорт",
        to: "Ж/д вокзал Астана 1",
        stops: [
          "Международный аэропорт",
          "Мечеть Альжан Ана",
          "Арнасай",
          "ж/м Пригородный",
          "ул. Жанадария",
          "ЖК Aq-Jol",
          "Садоводческое общество Авиатор",
          "Канал Нура-Есиль",
          "ЖК Family Park",
          "Шоссе Каркаралы",
          "Стелла Звезда Астаны",
          "Центральный госпиталь МВД РК",
          "Назарбаев университет",
          "ЖК Экспо-Плаза",
          "Ледовый дворец Алау",
          "Стадион Астана-Арена",
          "Дворец единоборств им. Жаксылыка Ушкемпирова",
          "БЦ Асыл-тау",
          "Центр нейрохирургии",
          "Кардиохирургическая клиника",
          "Динмухамеда Кунаева",
          "НК Казахстан Темир Жолы",
          "Монумент Байтерек",
          "Дом Министерств",
          "ЖК Миланский квартал",
          "Амман",
          "Жұмабек Тәшенов",
          "Парк Ататюрк",
          "Микрорайон Самал",
          "Амангельды Иманова",
          "Народный банк",
          "БЦ Марден",
          "Алиби Жангельдина",
          "Политехнический колледж",
          "Медицинский университет Астана",
          "Агротехнический университет",
          "Ильяса Есенберлина",
          "Биржан сал",
          "ТД Даулет",
          "Ж/д вокзал Астана 1",
        ],
      },
    },
  },
  {
    route_number: "12",
    directions: {
      outbound: {
        from: "Ж/д вокзал Астана 1",
        to: "Международный аэропорт",
        stops: [
          "Ж/д вокзал Астана 1",
          "Театр Жастар",
          "ул. Алтынсарина",
          "Алии Молдагуловой",
          "Школа-лицей №15",
          "проспект Сарыарка",
          "Спортивный комплекс ABYROY",
          "Школа Зерде",
          "Кенесары",
          "Парк Астана",
          "ТРЦ KeruenCity",
          "ТРЦ Сарыарка",
          "Динмухамеда Кунаева",
          "НК Казахстан Темир Жолы",
          "Монумент Байтерек",
          "Дом Министерств",
          "Финансовый центр",
          "ЖК Акжайык",
          "Қарлығаш балабақшасы",
          "Триумфальная арка Мангилик Ел",
          "ул. Бухар жырау",
          "ЖК Променад Экспо",
          "ЖК Orynbor Towers",
          "Астана ЭКСПО",
          "ЖК Экспо Сити",
          "Больница Медицинского центра УДП РК",
          "Е 495",
          "Детский сад Карлыгаш-2",
          "Е 319",
          "Канал Нура-Есиль",
          "Садоводческое общество Авиатор",
          "ул. Жанадария",
          "Детский сад Балбулак",
          "Сарытогай",
          "Средняя школа №24",
          "Арнасай",
          "Мечеть Альжан Ана",
          "Международный аэропорт",
        ],
      },
      inbound: {
        from: "Международный аэропорт",
        to: "Ж/д вокзал Астана 1",
        stops: [
          "Международный аэропорт",
          "Мечеть Альжан Ана",
          "Арнасай",
          "Средняя школа №24",
          "Сарытогай",
          "Детский сад Балбулак",
          "ул. Жанадария",
          "ЖК Aq-Jol",
          "Садоводческое общество Авиатор",
          "Канал Нура-Есиль",
          "Е 319",
          "Детский сад Карлыгаш-2",
          "Больница Медицинского центра УДП РК",
          "ЖК Экспо Сити",
          "Астана ЭКСПО",
          "ЖК Orynbor Towers",
          "ЖК Променад Экспо",
          "УДП",
          "ул. Бухар жырау",
          "Триумфальная арка Мангилик Ел",
          "Қарлығаш балабақшасы",
          "ЖК Акжайык",
          "Финансовый центр",
          "Қазақконцерт им. Розы Баглановой",
          "Дом Министерств",
          "НК Казахстан Темир Жолы",
          "Динмухамеда Кунаева",
          "Театр Астана Опера",
          "ТРЦ Сарыарка",
          "ТРЦ KeruenCity",
          "Коргалжинская трасса",
          "Парк Астана",
          "Кенесары",
          "Школа Зерде",
          "Спортивный комплекс ABYROY",
          "проспект Сарыарка",
          "ТД Коктем",
          "Школа-лицей №15",
          "Московская",
          "Алии Молдагуловой",
          "Театр Жастар",
          "ТД Даулет",
          "Ж/д вокзал Астана 1",
        ],
      },
    },
  },
  {
    route_number: "46",
    directions: {
      outbound: {
        from: "улица Карасу",
        to: "ЖК Комфорт таун",
        stops: [
          "улица Карасу",
          "Мұса дүкені",
          "Тарбагатай",
          "Актобе",
          "Улытау",
          "Гостиница Бахыт",
          "Келешек",
          "Жанаконыс",
          "пер. Тайтобе",
          "Ардагерлер",
          "Титова",
          "Шугыла",
          "Кафе Сулуколь",
          "Кладбище",
          "Медеу",
          "Қарталы",
          "Акан Серы",
          "проспект Тлендиева",
          "Сарыбулак",
          "Средняя школа №18",
          "ЖК Свечки",
          "проспект Сарыарка",
          "Спортивный комплекс ABYROY",
          "Школа Зерде",
          "Кенесары",
          "Парк Астана",
          "ТРЦ KeruenCity",
          "ТРЦ Сарыарка",
          "Театр Астана Опера",
          "ТРЦ Хан Шатыр",
          "Республиканский диагностический центр",
          "Кардиохирургическая клиника",
          "Мечеть Әбу Насыр әл-Фараби",
          "ТРЦ Керуен",
          "Монумент Байтерек",
          "Дом Министерств",
          "Финансовый центр",
          "ЖК Акжайык",
          "Қарлығаш балабақшасы",
          "Триумфальная арка Мангилик Ел",
          "ул. Бухар жырау",
          "ЖК Променад Экспо",
          "ЖК Orynbor Towers",
          "Каракат",
          "Жаркын",
          "ЖК Комфорт таун",
        ],
      },
      inbound: {
        from: "ЖК Комфорт таун",
        to: "улица Карасу",
        stops: [
          "ЖК Комфорт таун",
          "ЖК Nova city",
          "Жаркын",
          "Каракат",
          "ЖК Orynbor Towers",
          "ЖК Променад Экспо",
          "УДП",
          "ул. Бухар жырау",
          "Триумфальная арка Мангилик Ел",
          "Қарлығаш балабақшасы",
          "ЖК Акжайык",
          "Финансовый центр",
          "Қазақконцерт им. Розы Баглановой",
          "Дом Министерств",
          "Министерство обороны",
          "ТРЦ Керуен",
          "Кардиохирургическая клиника",
          "Республиканский диагностический центр",
          "ТРЦ Хан Шатыр",
          "Театр Астана Опера",
          "ТРЦ Сарыарка",
          "ТРЦ KeruenCity",
          "Коргалжинская трасса",
          "Парк Астана",
          "Кенесары",
          "Школа Зерде",
          "Спортивный комплекс ABYROY",
          "проспект Сарыарка",
          "Средняя школа №18",
          "Сарыбулак",
          "проспект Тлендиева",
          "Акан Серы",
          "Қарталы",
          "Медеу",
          "Кладбище",
          "Шугыла",
          "Титова",
          "Ардагерлер",
          "Бабатайулы",
          "пер. Тайтобе",
          "Жанаконыс",
          "Кафе Казыгурт",
          "Гостиница Бахыт",
          "ж/м Коктал-2",
          "Тарбагатай",
          "Мұса дүкені",
          "Наурыз,48",
          "улица Карасу",
        ],
      },
    },
  },
]

export function resolveRouteOrderOverrides(params: {
  routes: RouteLike[]
  stops: StopLike[]
  routeStopsByRouteId: Map<string, RouteStopLike[]>
}): RouteOverrideResult {
  const targetRouteNumbers = new Set(ROUTE_OVERRIDES.map((r) => r.route_number))
  const diagnostics: RouteOrderDiagnostics[] = []
  const resolutionReports: ResolutionReport[] = []
  const orderedStopIdsByRouteId = new Map<string, string[]>()
  const directionDebugByRouteId = new Map<string, RouteDirectionDebug>()
  const stopIndex = createStopNameIndex(params.stops)
  const stopById = new Map(params.stops.map((s) => [s.id, s]))
  const stopsByNormalizedCode = buildStopsByNormalizedStopCode(params.stops)

  for (const route of params.routes) {
    const dbOrder = dbOrderedStopIds(route.id, params.routeStopsByRouteId)
    orderedStopIdsByRouteId.set(route.id, dbOrder)
    diagnostics.push({
      route_id: route.id,
      route_number: route.route_number,
      route_name: route.route_name,
      order_source: "db",
      warnings: [],
    })
  }

  for (const def of ROUTE_OVERRIDES) {
    const candidates = params.routes.filter((r) => r.route_number === def.route_number)
    if (!candidates.length) {
      logWarn(`No route_id found for override route_number ${def.route_number}`)
      continue
    }

    const byDirection = matchRouteIdsForDirections(
      candidates,
      def,
      params.routeStopsByRouteId,
      params.stops
    )

    if (def.route_number === "10") {
      const route = byDirection.outbound ?? byDirection.inbound
      if (!route) continue
      const outboundReport = resolveExplicitStopIdSequence(
        "10",
        "outbound",
        route,
        ROUTE_10_OUTBOUND_STOP_IDS,
        stopById
      )
      const inboundReport = resolveExplicitStopIdSequence(
        "10",
        "inbound",
        route,
        ROUTE_10_INBOUND_STOP_IDS,
        stopById
      )
      resolutionReports.push(outboundReport, inboundReport)

      const outboundIds = dedupeKeepingOrder(
        outboundReport,
        outboundReport.route_id,
        outboundReport.warnings
      )
      const inboundIds = dedupeKeepingOrder(
        inboundReport,
        inboundReport.route_id,
        inboundReport.warnings
      )
      if (outboundIds.length >= MIN_RESOLVED_STOPS) {
        orderedStopIdsByRouteId.set(route.id, outboundIds)
        setRouteDiagnostic(diagnostics, route.id, {
          order_source: "override",
          direction: "outbound",
          warnings: [...outboundReport.warnings],
        })
      } else {
        outboundReport.warnings.push(
          `Resolved route has too few stops (${outboundIds.length}), falling back to DB order`
        )
      }

      directionDebugByRouteId.set(route.id, {
        route_id: route.id,
        route_number: route.route_number,
        outbound_stop_ids: outboundIds,
        inbound_stop_ids: inboundIds,
        source: "stop_code_override",
        warnings: [...outboundReport.warnings, ...inboundReport.warnings],
      })
      continue
    }

    if (def.route_number === "12") {
      const route = byDirection.outbound ?? byDirection.inbound
      if (!route) continue

      const outboundReport = resolveExplicitStopIdSequence(
        "12",
        "outbound",
        route,
        ROUTE_12_OUTBOUND_STOP_IDS,
        stopById
      )
      resolutionReports.push(outboundReport)

      const inboundTarget = byDirection.inbound ?? route
      const inboundReport = resolveExplicitStopIdSequence(
        "12",
        "inbound",
        inboundTarget,
        ROUTE_12_INBOUND_STOP_IDS,
        stopById
      )
      resolutionReports.push(inboundReport)

      const outboundIds = dedupeKeepingOrder(
        outboundReport,
        outboundReport.route_id,
        outboundReport.warnings
      )
      const inboundIds = dedupeKeepingOrder(
        inboundReport,
        inboundReport.route_id,
        inboundReport.warnings
      )

      if (outboundIds.length >= MIN_RESOLVED_STOPS) {
        orderedStopIdsByRouteId.set(route.id, outboundIds)
        setRouteDiagnostic(diagnostics, route.id, {
          order_source: "override",
          direction: "outbound",
          warnings: [...outboundReport.warnings],
        })
      } else {
        outboundReport.warnings.push(
          `Resolved route has too few stops (${outboundIds.length}), falling back to DB order`
        )
      }

      directionDebugByRouteId.set(route.id, {
        route_id: route.id,
        route_number: route.route_number,
        outbound_stop_ids: outboundIds,
        inbound_stop_ids: inboundIds,
        source: "stop_code_override",
        warnings: [...outboundReport.warnings, ...inboundReport.warnings],
      })
      continue
    }

    if (def.route_number === "46") {
      const route = byDirection.outbound ?? byDirection.inbound
      if (!route) continue

      const outboundReport = resolveExplicitStopIdSequence(
        "46",
        "outbound",
        route,
        ROUTE_46_OUTBOUND_STOP_IDS,
        stopById
      )
      resolutionReports.push(outboundReport)

      const inboundTarget = byDirection.inbound ?? route
      const inboundReport = resolveExplicitStopIdSequence(
        "46",
        "inbound",
        inboundTarget,
        ROUTE_46_INBOUND_STOP_IDS,
        stopById
      )
      resolutionReports.push(inboundReport)

      const outboundIds = dedupeKeepingOrder(
        outboundReport,
        outboundReport.route_id,
        outboundReport.warnings
      )
      const inboundIds = dedupeKeepingOrder(
        inboundReport,
        inboundReport.route_id,
        inboundReport.warnings
      )

      if (outboundIds.length >= MIN_RESOLVED_STOPS) {
        orderedStopIdsByRouteId.set(route.id, outboundIds)
        setRouteDiagnostic(diagnostics, route.id, {
          order_source: "override",
          direction: "outbound",
          warnings: [...outboundReport.warnings],
        })
      } else {
        outboundReport.warnings.push(
          `Resolved route has too few stops (${outboundIds.length}), falling back to DB order`
        )
      }

      directionDebugByRouteId.set(route.id, {
        route_id: route.id,
        route_number: route.route_number,
        outbound_stop_ids: outboundIds,
        inbound_stop_ids: inboundIds,
        source: "stop_code_override",
        warnings: [...outboundReport.warnings, ...inboundReport.warnings],
      })
      continue
    }

    for (const direction of ["outbound", "inbound"] as const) {
      const route = byDirection[direction]
      if (!route) {
        const rep = emptyReport(def.route_number, direction)
        rep.warnings.push(
          `No matching route_id selected for ${def.route_number} ${direction}`
        )
        resolutionReports.push(rep)
        logWarn(
          `Override not applied for route ${def.route_number} ${direction}: route_id not resolved`
        )
        continue
      }

      const sequence = def.directions[direction]
      const report = resolveDirectionSequence(
        def.route_number,
        direction,
        route,
        sequence.stops,
        stopIndex
      )
      resolutionReports.push(report)

      const uniqueIds = dedupeKeepingOrder(report, report.route_id, report.warnings)
      if (uniqueIds.length >= MIN_RESOLVED_STOPS) {
        orderedStopIdsByRouteId.set(route.id, uniqueIds)
        const existing = directionDebugByRouteId.get(route.id)
        directionDebugByRouteId.set(route.id, {
          route_id: route.id,
          route_number: route.route_number,
          outbound_stop_ids:
            direction === "outbound"
              ? uniqueIds
              : existing?.outbound_stop_ids ?? [],
          inbound_stop_ids:
            direction === "inbound" ? uniqueIds : existing?.inbound_stop_ids ?? [],
          source: "name_resolved",
          warnings: report.warnings,
        })
        setRouteDiagnostic(diagnostics, route.id, {
          order_source: "override",
          direction,
          warnings: report.warnings,
        })
        logInfo(
          `Applied override order for route ${route.route_number} (${route.id}) ${direction}: ${uniqueIds.length}/${sequence.stops.length} resolved`
        )
      } else {
        report.warnings.push(
          `Resolved route has too few stops (${uniqueIds.length}), falling back to DB order`
        )
        setRouteDiagnostic(diagnostics, route.id, {
          order_source: "db",
          direction,
          warnings: report.warnings,
        })
        logWarn(
          `Override fallback to DB for route ${route.route_number} (${route.id}) ${direction}: only ${uniqueIds.length} resolved`
        )
      }
    }
  }

  validateDirectionConsistency(diagnostics, orderedStopIdsByRouteId)
  warnUntouchedTargetRoutes(params.routes, targetRouteNumbers, diagnostics)

  return {
    orderedStopIdsByRouteId,
    directionDebugByRouteId,
    diagnostics,
    resolutionReports,
  }
}

function buildStopsByNormalizedStopCode(
  stops: StopLike[]
): Map<string, StopLike[]> {
  const m = new Map<string, StopLike[]>()
  for (const s of stops) {
    const key = normalizeStopCodeForLookup(s.stop_code)
    const list = m.get(key) ?? []
    list.push(s)
    m.set(key, list)
  }
  return m
}

function resolveExplicitStopIdSequence(
  routeNumber: string,
  direction: DirectionName,
  route: RouteLike,
  stopIds: string[],
  stopById: Map<string, StopLike>
): ResolutionReport {
  const report: ResolutionReport = {
    route_number: routeNumber,
    direction,
    route_id: route.id,
    route_name: route.route_name,
    source: "override",
    trusted_total: stopIds.length,
    resolved_total: 0,
    exact_matches: [],
    fuzzy_matches: [],
    unresolved: [],
    resolved_entries: [],
    warnings: [],
  }
  for (const id of stopIds) {
    const stop = stopById.get(id)
    if (!stop) {
      report.unresolved.push(id)
      report.warnings.push(
        `Missing bus_stops.id "${id}" for route ${routeNumber} ${direction}`
      )
      continue
    }
    report.exact_matches.push(id)
    report.resolved_entries.push({
      trusted: id,
      stop_id: stop.id,
      matched_name: stop.name,
    })
  }
  report.resolved_total = report.resolved_entries.length
  if (report.unresolved.length > 0) {
    report.warnings.push(
      `Route ${routeNumber} ${direction} is partially resolved: ${report.resolved_total}/${report.trusted_total}`
    )
  }
  return report
}

function resolveExplicitStopCodeSequence(
  routeNumber: string,
  direction: DirectionName,
  route: RouteLike,
  stopCodes: string[],
  stopsByNormalizedCode: Map<string, StopLike[]>
): ResolutionReport {
  const report: ResolutionReport = {
    route_number: routeNumber,
    direction,
    route_id: route.id,
    route_name: route.route_name,
    source: "override",
    trusted_total: stopCodes.length,
    resolved_total: 0,
    exact_matches: [],
    fuzzy_matches: [],
    unresolved: [],
    resolved_entries: [],
    warnings: [],
  }
  for (const code of stopCodes) {
    const key = normalizeStopCodeForLookup(code)
    const candidates = stopsByNormalizedCode.get(key) ?? []
    if (candidates.length === 0) {
      report.unresolved.push(code)
      report.warnings.push(
        `Missing stop_code "${code}" in bus_stops for route ${routeNumber} ${direction}`
      )
      continue
    }
    if (candidates.length > 1) {
      logWarn(
        `Ambiguous stop_code "${code}" for route ${routeNumber} ${direction}: ${candidates.length} rows, using first (id=${candidates[0].id})`
      )
    }
    const stop = candidates[0]
    report.exact_matches.push(code)
    report.resolved_entries.push({
      trusted: code,
      stop_id: stop.id,
      matched_name: stop.name,
    })
  }
  report.resolved_total = report.resolved_entries.length
  if (report.unresolved.length > 0) {
    report.warnings.push(
      `Route ${routeNumber} ${direction} is partially resolved: ${report.resolved_total}/${report.trusted_total}`
    )
  }
  return report
}

function warnUntouchedTargetRoutes(
  routes: RouteLike[],
  targetRouteNumbers: Set<string>,
  diagnostics: RouteOrderDiagnostics[]
) {
  for (const route of routes) {
    if (!targetRouteNumbers.has(route.route_number)) continue
    const d = diagnostics.find((x) => x.route_id === route.id)
    if (!d || d.order_source === "override") continue
    logWarn(
      `Route ${route.route_number} (${route.id}) remains on DB order (override not fully resolved)`
    )
  }
}

function setRouteDiagnostic(
  diagnostics: RouteOrderDiagnostics[],
  routeId: string,
  patch: Partial<RouteOrderDiagnostics>
) {
  const idx = diagnostics.findIndex((d) => d.route_id === routeId)
  if (idx < 0) return
  diagnostics[idx] = { ...diagnostics[idx], ...patch }
}

function validateDirectionConsistency(
  diagnostics: RouteOrderDiagnostics[],
  orderedStopIdsByRouteId: Map<string, string[]>
) {
  const byRouteNumber = new Map<string, RouteOrderDiagnostics[]>()
  for (const d of diagnostics) {
    const list = byRouteNumber.get(d.route_number) ?? []
    list.push(d)
    byRouteNumber.set(d.route_number, list)
  }

  for (const [routeNumber, list] of byRouteNumber) {
    const outbound = list.find((d) => d.direction === "outbound")
    const inbound = list.find((d) => d.direction === "inbound")
    if (!outbound || !inbound) continue

    const outStops = orderedStopIdsByRouteId.get(outbound.route_id) ?? []
    const inStops = orderedStopIdsByRouteId.get(inbound.route_id) ?? []
    if (outStops.length < 2 || inStops.length < 2) continue

    const outFirst = outStops[0]
    const outLast = outStops[outStops.length - 1]
    const inFirst = inStops[0]
    const inLast = inStops[inStops.length - 1]
    const terminalMismatch = outFirst !== inLast || outLast !== inFirst

    const outSet = new Set(outStops)
    let overlap = 0
    for (const id of inStops) {
      if (outSet.has(id)) overlap++
    }
    const overlapRatio = overlap / Math.max(1, Math.min(outStops.length, inStops.length))

    if (terminalMismatch || overlapRatio < 0.55) {
      const message = `Direction consistency warning for route ${routeNumber}: terminals mismatch=${terminalMismatch}, overlap_ratio=${overlapRatio.toFixed(2)}`
      outbound.warnings = [...outbound.warnings, message]
      inbound.warnings = [...inbound.warnings, message]
      logWarn(message)
    }
  }
}

function resolveDirectionSequence(
  routeNumber: string,
  direction: DirectionName,
  route: RouteLike,
  trustedStops: string[],
  stopIndex: ReturnType<typeof createStopNameIndex>
): ResolutionReport {
  const report: ResolutionReport = {
    route_number: routeNumber,
    direction,
    route_id: route.id,
    route_name: route.route_name,
    source: "override",
    trusted_total: trustedStops.length,
    resolved_total: 0,
    exact_matches: [],
    fuzzy_matches: [],
    unresolved: [],
    resolved_entries: [],
    warnings: [],
  }

  for (const trustedName of trustedStops) {
    const match = matchStopName(trustedName, stopIndex)
    if (match.kind === "unresolved") {
      report.unresolved.push(trustedName)
      report.warnings.push(
        `Missing stop match for "${trustedName}" on route ${routeNumber} ${direction}`
      )
      continue
    }
    if (match.kind === "exact") {
      report.exact_matches.push(trustedName)
    } else {
      report.fuzzy_matches.push({
        trusted: trustedName,
        matched: match.stop.name,
        score: Number(match.score.toFixed(3)),
      })
    }
    report.resolved_entries.push({
      trusted: trustedName,
      stop_id: match.stop.id,
      matched_name: match.stop.name,
    })
  }

  report.resolved_total = report.resolved_entries.length

  if (report.unresolved.length > 0) {
    report.warnings.push(
      `Route ${routeNumber} ${direction} is partially resolved: ${report.resolved_total}/${report.trusted_total}`
    )
  }

  if (report.fuzzy_matches.length > 0) {
    logInfo(
      `Fuzzy matches used for route ${routeNumber} ${direction}: ${report.fuzzy_matches.length}`
    )
  }

  if (report.unresolved.length > 0) {
    logWarn(
      `Unresolved trusted stops for route ${routeNumber} ${direction}: ${report.unresolved.join(", ")}`
    )
  }

  return report
}

function dedupeKeepingOrder(
  report: ResolutionReport,
  routeId: string | null,
  warnings: string[]
): string[] {
  if (!routeId) return []
  const seen = new Set<string>()
  const ids: string[] = []

  for (const entry of report.resolved_entries) {
    if (seen.has(entry.stop_id)) {
      const w = `Duplicate stop in override resolved sequence: "${entry.trusted}" -> ${entry.stop_id}`
      warnings.push(w)
      logWarn(w)
      continue
    }
    seen.add(entry.stop_id)
    ids.push(entry.stop_id)
  }
  return ids
}

function dbOrderedStopIds(
  routeId: string,
  routeStopsByRouteId: Map<string, RouteStopLike[]>
): string[] {
  return (routeStopsByRouteId.get(routeId) ?? [])
    .slice()
    .sort((a, b) => a.stop_sequence - b.stop_sequence)
    .map((s) => s.stop_id)
}

function matchRouteIdsForDirections(
  candidates: RouteLike[],
  def: RouteOverrideDefinition,
  routeStopsByRouteId: Map<string, RouteStopLike[]>,
  allStops: StopLike[]
): Record<DirectionName, RouteLike | null> {
  const byId = new Map(allStops.map((s) => [s.id, s]))

  const ranked = {
    outbound: rankCandidates(
      candidates,
      def.directions.outbound,
      routeStopsByRouteId,
      byId
    ),
    inbound: rankCandidates(candidates, def.directions.inbound, routeStopsByRouteId, byId),
  }

  const outbound = ranked.outbound[0]?.route ?? null
  let inbound = ranked.inbound[0]?.route ?? null

  if (outbound && inbound && outbound.id === inbound.id && candidates.length > 1) {
    inbound = ranked.inbound.find((r) => r.route.id !== outbound.id)?.route ?? inbound
  }

  return { outbound, inbound }
}

function rankCandidates(
  candidates: RouteLike[],
  direction: OverrideDirection,
  routeStopsByRouteId: Map<string, RouteStopLike[]>,
  stopById: Map<string, StopLike>
): Array<{ route: RouteLike; score: number }> {
  const fromNorm = normalizeName(direction.from)
  const toNorm = normalizeName(direction.to)

  const ranked = candidates.map((route) => {
    const stopIds = dbOrderedStopIds(route.id, routeStopsByRouteId)
    const dbNames = stopIds
      .map((id) => stopById.get(id)?.name)
      .filter((x): x is string => !!x)
      .map((name) => normalizeName(name))

    const first = dbNames[0] ?? ""
    const last = dbNames[dbNames.length - 1] ?? ""
    const endpointScore =
      similarity(first, fromNorm) * 2.4 + similarity(last, toNorm) * 2.4
    const overlap = calcOverlapRatio(dbNames, direction.stops.map((s) => normalizeName(s)))
    const score = endpointScore + overlap * 2 + dbNames.length / 1000
    return { route, score }
  })

  ranked.sort((a, b) => b.score - a.score)
  return ranked
}

function calcOverlapRatio(dbNames: string[], trustedNames: string[]): number {
  const dbSet = new Set(dbNames)
  let hits = 0
  for (const n of trustedNames) {
    if (dbSet.has(n)) hits++
  }
  return hits / Math.max(1, trustedNames.length)
}

type StopNameIndex = {
  exactByName: Map<string, StopLike[]>
  normalizedStops: Array<{ stop: StopLike; norm: string }>
}

function createStopNameIndex(stops: StopLike[]): StopNameIndex {
  const exactByName = new Map<string, StopLike[]>()
  const normalizedStops = stops.map((stop) => ({
    stop,
    norm: normalizeName(stop.name),
  }))
  for (const stop of stops) {
    const key = normalizeBasic(stop.name)
    const list = exactByName.get(key) ?? []
    list.push(stop)
    exactByName.set(key, list)
  }
  return { exactByName, normalizedStops }
}

function matchStopName(
  trustedName: string,
  index: StopNameIndex
):
  | { kind: "exact"; stop: StopLike; score: number }
  | { kind: "fuzzy"; stop: StopLike; score: number; ambiguous: boolean }
  | { kind: "unresolved" } {
  const exactKey = normalizeBasic(trustedName)
  const exactCandidates = index.exactByName.get(exactKey) ?? []
  if (exactCandidates.length === 1) {
    return { kind: "exact", stop: exactCandidates[0], score: 1 }
  }
  if (exactCandidates.length > 1) {
    logWarn(
      `Ambiguous exact match for "${trustedName}": ${exactCandidates.length} candidates, selecting first`
    )
    return { kind: "exact", stop: exactCandidates[0], score: 1 }
  }

  const trustedNorm = normalizeName(trustedName)
  let best: { stop: StopLike; score: number } | null = null
  let secondScore = 0
  for (const candidate of index.normalizedStops) {
    const score = similarity(trustedNorm, candidate.norm)
    if (!best || score > best.score) {
      secondScore = best?.score ?? 0
      best = { stop: candidate.stop, score }
    } else if (score > secondScore) {
      secondScore = score
    }
  }

  if (!best || best.score < FUZZY_THRESHOLD) {
    return { kind: "unresolved" }
  }

  const ambiguous = best.score - secondScore <= AMBIGUITY_DELTA
  if (ambiguous) {
    logWarn(
      `Ambiguous fuzzy match for "${trustedName}": best="${best.stop.name}" score=${best.score.toFixed(3)}`
    )
  }

  return { kind: "fuzzy", stop: best.stop, score: best.score, ambiguous }
}

function emptyReport(routeNumber: string, direction: DirectionName): ResolutionReport {
  return {
    route_number: routeNumber,
    direction,
    route_id: null,
    route_name: null,
    source: "db",
    trusted_total: 0,
    resolved_total: 0,
    exact_matches: [],
    fuzzy_matches: [],
    unresolved: [],
    resolved_entries: [],
    warnings: [],
  }
}

function normalizeBasic(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/[’`']/g, "'")
    .replace(/[«»"]/g, "")
    .replace(/\s+/g, " ")
}

function normalizeName(v: string): string {
  return normalizeBasic(v)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ё]/g, "е")
    .replace(/[қ]/g, "к")
    .replace(/[ң]/g, "н")
    .replace(/[ғ]/g, "г")
    .replace(/[ү]/g, "у")
    .replace(/[ұ]/g, "у")
    .replace(/[ә]/g, "а")
    .replace(/[ө]/g, "о")
    .replace(/[һ]/g, "х")
    .replace(/[і]/g, "и")
    .replace(/[a]/g, "а")
    .replace(/[c]/g, "с")
    .replace(/[e]/g, "е")
    .replace(/[h]/g, "н")
    .replace(/[k]/g, "к")
    .replace(/[m]/g, "м")
    .replace(/[o]/g, "о")
    .replace(/[p]/g, "р")
    .replace(/[t]/g, "т")
    .replace(/[x]/g, "х")
    .replace(/[^a-z0-9а-яё\s./-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const aBigrams = bigrams(a)
  const bBigrams = bigrams(b)
  if (!aBigrams.length || !bBigrams.length) return 0
  const bSet = new Set(bBigrams)
  let overlap = 0
  for (const gram of aBigrams) {
    if (bSet.has(gram)) overlap++
  }
  return (2 * overlap) / (aBigrams.length + bBigrams.length)
}

function bigrams(v: string): string[] {
  const s = v.replace(/\s+/g, " ")
  if (s.length < 2) return [s]
  const out: string[] = []
  for (let i = 0; i < s.length - 1; i++) {
    out.push(s.slice(i, i + 2))
  }
  return out
}

function logWarn(message: string) {
  console.warn(`[route-overrides] ${message}`)
}

function logInfo(message: string) {
  console.info(`[route-overrides] ${message}`)
}
