/* Load the school register from a CSV exported from the office spreadsheet.
 *
 *   node scripts/import-register.mjs students register.csv
 *   node scripts/import-register.mjs staff staff.csv
 *
 * Students CSV columns (header row required, order does not matter):
 *   admission_no, surname, other_names, class_level, guardian_email, guardian_phone, status
 * Staff CSV columns:
 *   staff_no, surname, other_names, email, status
 *
 * Re-running is safe: rows are matched on admission/staff number and updated,
 * so the spreadsheet stays the source of truth. Nothing is ever deleted, and a
 * pupil who has left should be marked status=left rather than removed, which
 * keeps their account linked but blocks a fresh sign-up.
 */
import { readFile } from "node:fs/promises";
import { query, closePool } from "../api/_lib/db.js";

/** Minimal RFC4180 CSV parser: handles quoted fields, embedded commas, "" escapes. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

function toRecords(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  return rows.slice(1).map((cells) => {
    const rec = {};
    headers.forEach((h, i) => { rec[h] = (cells[i] ?? "").trim(); });
    return rec;
  });
}

const CLASS_LEVELS = new Set(["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"]);

async function importStudents(records) {
  let inserted = 0, updated = 0;
  const problems = [];

  for (const [i, r] of records.entries()) {
    const line = i + 2;                                    // +1 header, +1 one-based
    const admissionNo = (r.admission_no || r.admission_number || r.student_id || "").trim();
    const surname = (r.surname || r.last_name || "").trim();
    const classLevel = (r.class_level || r.class || r.grade || "").trim().toUpperCase().replace(/\s+/g, "");

    if (!admissionNo) { problems.push(`line ${line}: missing admission_no`); continue; }
    if (!surname)     { problems.push(`line ${line}: missing surname`); continue; }
    if (!CLASS_LEVELS.has(classLevel)) {
      problems.push(`line ${line}: class_level "${r.class_level || ""}" is not one of ${[...CLASS_LEVELS].join(", ")}`);
      continue;
    }
    const status = (r.status || "active").trim().toLowerCase();
    if (!["active", "left"].includes(status)) {
      problems.push(`line ${line}: status "${r.status}" must be active or left`); continue;
    }

    const { rows } = await query(
      `INSERT INTO register (admission_no, surname, other_names, class_level, guardian_email, guardian_phone, status, source)
       VALUES ($1, $2, $3, $4, NULLIF($5,''), NULLIF($6,''), $7, 'import')
       ON CONFLICT (upper(replace(admission_no, ' ', ''))) DO UPDATE
         SET surname = EXCLUDED.surname, other_names = EXCLUDED.other_names,
             class_level = EXCLUDED.class_level, guardian_email = EXCLUDED.guardian_email,
             guardian_phone = EXCLUDED.guardian_phone, status = EXCLUDED.status,
             source = 'import', updated_at = now()
       RETURNING (xmax = 0) AS was_insert`,
      [admissionNo, surname, r.other_names || r.first_name || "", classLevel,
       r.guardian_email || r.parent_email || "", r.guardian_phone || r.parent_phone || "", status]
    );
    rows[0].was_insert ? inserted++ : updated++;
  }
  return { inserted, updated, problems };
}

async function importStaff(records) {
  let inserted = 0, updated = 0;
  const problems = [];

  for (const [i, r] of records.entries()) {
    const line = i + 2;
    const staffNo = (r.staff_no || r.staff_number || r.staff_id || "").trim();
    const surname = (r.surname || r.last_name || "").trim();
    if (!staffNo) { problems.push(`line ${line}: missing staff_no`); continue; }
    if (!surname) { problems.push(`line ${line}: missing surname`); continue; }
    const status = (r.status || "active").trim().toLowerCase();
    if (!["active", "left"].includes(status)) {
      problems.push(`line ${line}: status "${r.status}" must be active or left`); continue;
    }

    const { rows } = await query(
      `INSERT INTO staff_register (staff_no, surname, other_names, email, status, source)
       VALUES ($1, $2, $3, NULLIF($4,''), $5, 'import')
       ON CONFLICT (upper(replace(staff_no, ' ', ''))) DO UPDATE
         SET surname = EXCLUDED.surname, other_names = EXCLUDED.other_names,
             email = EXCLUDED.email, status = EXCLUDED.status, source = 'import'
       RETURNING (xmax = 0) AS was_insert`,
      [staffNo, surname, r.other_names || r.first_name || "", r.email || "", status]
    );
    rows[0].was_insert ? inserted++ : updated++;
  }
  return { inserted, updated, problems };
}

async function main() {
  const [kind, file] = process.argv.slice(2);
  if (!["students", "staff"].includes(kind) || !file) {
    console.error("Usage: node scripts/import-register.mjs <students|staff> <file.csv>");
    process.exit(2);
  }

  const records = toRecords(parseCsv(await readFile(file, "utf8")));
  if (!records.length) {
    console.error("No data rows found. Is the header row present?");
    process.exit(1);
  }

  const result = kind === "students" ? await importStudents(records) : await importStaff(records);

  console.log(`${kind}: ${result.inserted} added, ${result.updated} updated, ${result.problems.length} skipped`);
  for (const p of result.problems) console.warn("  skipped -", p);
  await closePool();
  // Skipped rows mean the spreadsheet needs attention, so fail loudly for CI.
  process.exit(result.problems.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err.code === "NO_DATABASE" ? "DATABASE_URL is not set." : err);
  await closePool().catch(() => {});
  process.exit(1);
});
