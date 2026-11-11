#!/usr/bin/env node
// Writes sample PCS files (same layout as a real .PCS) for each customer scenario, from customers.json + avs.json.
//   node make-pcs.mjs        -> pcs-samples/*.PCS
// All names, part numbers and the e-mail are artificial. The CS_C Value ID is the MDM id (no local T0xx codes), and only the customers
// that an AV is tied to are listed. The hierarchy is not in the file: the API returns the parent and grandparent ids at selection time.

import fs from "fs";

const customers = JSON.parse(fs.readFileSync("customers.json", "utf8"));
const avs = JSON.parse(fs.readFileSync("avs.json", "utf8"));
const mdm = id => customers.find(c => c.id === id).mdmId;
const fakePart = new Map(avs.map((a, i) => [a.partno, `ZZ${String(i + 1).padStart(3, "0")}AV`]));

const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
const row = (...f) => f.concat(Array(15).fill("")).slice(0, 15).map(q).join(",");
const csvName = c => `${c.name} - Demo`;

function pcs({ kmat, note, customerRows, itemRows }) {
  const L = [];
  L.push(row("Macro", "KMAT", "Plant", "Usage", "SPEC", "Version"));
  L.push(row("PCR_SPEC", kmat, "", "", "WWAP", "1"));
  L.push(row("RELEASE_INFO", "owner@example.com"));
  L.push(row("Macro", "Chaid", "CType", "Format", "Size", "Sing/Mult/Rest/NoEn/Req", "Description", "Group", "PreConCode", "SelConCode", "Default ValId", "CVG1", "CVG2", "CVG3"));
  L.push(row("x")); L.push(row("x", "", "", "", "", "", "Customer Cstic Values")); L.push(row("x"));
  if (note) { L.push(row("x", "", "", "", "", "", note)); L.push(row("x")); }
  L.push(...customerRows);
  L.push(row("x"));
  L.push(row("Macro", "Characteristic", "Range", "Local", "Item#", "Part#", "Description", "Type", "Conditional Selection", "Sales Order Selection", "Value ID", "CVG1", "CVG2", "CVG3", "SRP ID"));
  L.push(...itemRows);
  return L.join("\r\n") + "\r\n";
}
const customerRow = (c, valueId) => row("PCR_ITEM", "CS_C", valueId, "", valueId, "CVS_CSC", csvName(c), "LF", "", csvName(c), valueId);
const itemRows = list => list.flatMap(({ av, cond }, i) => {
  const n = 8001 + i * 2, vid = "U" + String(i + 1).padStart(3, "0"), part = fakePart.get(av.partno);
  return [row("PCR_ITEM", "V4_DEMO_SVC", vid, "", n, part, av.desc, "LF", cond, av.desc, vid),
          row("PCR_ITEM", "", n + 1, "", n + 1, part.replace("AV", "-00A"), av.desc, "S3", `V4_DEMO_SVC ${vid}`)];
});
const avOf = p => avs.find(a => a.partno === p);
const cond = ids => ids.length ? `CS_C + CS_C ${ids.map(mdm).join(",")}` : "";
const rowsFor = ids => [...new Set(ids)].map(id => customerRow(customers.find(c => c.id === id), mdm(id)));
const NOTE = "CS_C Value ID = MDM id; only customers that an AV is tied to are listed; the hierarchy comes from the API (parent and grandparent ids)";
fs.mkdirSync("pcs-samples", { recursive: true });
const out = (name, o) => { fs.writeFileSync(`pcs-samples/${name}`, pcs(o)); console.log("wrote pcs-samples/" + name); };

out("1_all_customers.PCS", { kmat: "X10001-999", note: NOTE, customerRows: [], itemRows: itemRows([{ av: avOf("AV-ALL"), cond: "" }]) });
out("2_one_customer.PCS", { kmat: "X10002-999", note: NOTE, customerRows: rowsFor(avOf("AV-ORG-A1b").customers), itemRows: itemRows([{ av: avOf("AV-ORG-A1b"), cond: cond(avOf("AV-ORG-A1b").customers) }]) });
out("3_n_customers.PCS", { kmat: "X10003-999", note: NOTE, customerRows: rowsFor(avOf("AV-MIX").customers), itemRows: itemRows([{ av: avOf("AV-MIX"), cond: cond(avOf("AV-MIX").customers) }]) });
// 4: every scenario in one file, including AVs tied to a Top or an Account (inherited by everything below through the API)
out("4_all_scenarios.PCS", { kmat: "X10004-999", note: NOTE, customerRows: rowsFor(avs.flatMap(a => a.customers)), itemRows: itemRows(avs.map(a => ({ av: a, cond: cond(a.customers) }))) });
