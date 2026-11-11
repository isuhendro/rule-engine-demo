// Reads the generated PCS files back and checks that each AV's customer condition matches avs.json.
import fs from "fs";
const customers = JSON.parse(fs.readFileSync("customers.json")), avs = JSON.parse(fs.readFileSync("avs.json"));
const parse = f => fs.readFileSync("pcs-samples/" + f, "utf8").split("\r\n").filter(Boolean).map(l => [...l.matchAll(/"((?:[^"]|"")*)"/g)].map(m => m[1].replace(/""/g, '"')));
let bad = 0; const eq = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
function check(file, expected, idOf) {              // expected: partno -> list of customer ids ([] = unconditional)
  const rows = parse(file), fake = new Map(avs.map((a, i) => [`ZZ${String(i + 1).padStart(3, "0")}AV`, a.partno]));
  const header = rows.find(r => r[0] === "Macro" && r[1] === "Characteristic");
  if (rows.some(r => r.length !== 15)) { bad++; console.log(file, "row with wrong column count"); }
  const items = rows.filter(r => r[0] === "PCR_ITEM" && r[7] === "LF" && r[1].startsWith("V4_"));
  const csc = new Map(rows.filter(r => r[0] === "PCR_ITEM" && r[1] === "CS_C").map(r => [r[2], r[6]]));
  for (const it of items) {
    const p = fake.get(it[5]), m = it[8].match(/^CS_C \+ CS_C (.+)$/), got = m ? m[1].split(",").map(idOf) : [];
    const ok = eq(got, expected[p] ?? []) && [...got].every(g => g !== undefined);
    if (!ok) { bad++; console.log(`  MISMATCH ${file} ${p}: got ${got} expected ${expected[p]}`); }
  }
  console.log(`${file}: ${items.length} AV(s), ${csc.size} customer value(s), ${header ? "header ok" : "NO HEADER"}`);
}
const byMdm = new Map(customers.map(c => [c.mdmId, c.id]));
const tied = p => avs.find(a => a.partno === p).customers;
check("1_all_customers.PCS", { "AV-ALL": [] }, c => byMdm.get(c));
check("2_one_customer.PCS", { "AV-ORG-A1b": tied("AV-ORG-A1b") }, c => byMdm.get(c));
check("3_n_customers.PCS", { "AV-MIX": tied("AV-MIX") }, c => byMdm.get(c));
check("4_all_scenarios.PCS", Object.fromEntries(avs.map(a => [a.partno, a.customers])), c => byMdm.get(c));
console.log(bad ? "FAILED" : "ALL OK"); process.exit(bad ? 1 : 0);
