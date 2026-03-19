import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

const ZIP_PATH = process.env.GTFS_ZIP_PATH || "gtfs_static_mvp_10_12_46.zip";
const FEED_ID = process.env.GTFS_FEED_ID || "astana";
const GTFS_SCHEMA = "gtfs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL");
if (!SERVICE_ROLE_KEY) throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: GTFS_SCHEMA },
});

const FILES = [
  { file: "agency.txt", table: "agency" },
  { file: "stops.txt", table: "stops" },
  { file: "routes.txt", table: "routes" },
  { file: "trips.txt", table: "trips" },
  { file: "stop_times.txt", table: "stop_times" },
  { file: "calendar.txt", table: "calendar" },
];

function parseCsv(text) {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
  });
  if (parsed.errors?.length) {
    const e = parsed.errors[0];
    throw new Error(`CSV parse error: ${e.message} at row ${e.row}`);
  }
  return parsed.data;
}

function normalizeValue(v) {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (t === "") return null;
  return t;
}

function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = normalizeValue(v);
  return out;
}

async function upsertInBatches(table, rows, batchSize = 1000) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch, { returning: "minimal" });
    if (error) throw new Error(`${GTFS_SCHEMA}.${table}: ${error.message}`);
    process.stdout.write(`Loaded ${GTFS_SCHEMA}.${table}: ${Math.min(i + batch.length, rows.length)}/${rows.length}\r`);
  }
  process.stdout.write("\n");
}

async function main() {
  const zipAbs = path.resolve(process.cwd(), ZIP_PATH);
  if (!fs.existsSync(zipAbs)) throw new Error(`Zip not found: ${zipAbs}`);

  const zipBuf = fs.readFileSync(zipAbs);
  const zip = await JSZip.loadAsync(zipBuf);

  for (const spec of FILES) {
    const entry = zip.file(spec.file);
    if (!entry) throw new Error(`Missing ${spec.file} in zip`);
    const text = await entry.async("string");
    const rows = parseCsv(text).map(normalizeRow).map((r) => ({ feed_id: FEED_ID, ...r }));
    console.log(`Importing ${spec.file} -> ${GTFS_SCHEMA}.${spec.table} (${rows.length} rows)`);
    await upsertInBatches(spec.table, rows);
  }

  console.log("Done. Next: run scripts/004_project_gtfs_to_bus_schema.sql in Supabase SQL editor.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

