#!/usr/bin/env node
// Command-line runner for the demo engine (core.mjs).
//   node engine.js [model.json] [steps...]
// Steps:  +PART select an item (matched on partno)   -PART deselect   @ID pick a customer from customers.json
//   @ID on a keys model: the "API" (customers.json) returns [id, parent, grandparent] and the matching key items are selected.
//   @ID on a model with customer items (model.gates.json): the customer item is selected.
// Default model: model.keys.json
import fs from "fs";
import { createEngine } from "./core.mjs";

const args = process.argv.slice(2);
const file = args[0]?.endsWith(".json") ? args.shift() : "model.keys.json";
const eng = createEngine(JSON.parse(fs.readFileSync(file, "utf8")));
const { model } = eng;
const customers = fs.existsSync("customers.json") ? JSON.parse(fs.readFileSync("customers.json", "utf8")) : [];
const keyIdx = new Map(model.Items.map((it, i) => [it.partno, i]).filter(([p]) => p.startsWith("KEY:")).map(([p, i]) => [p.slice(4), i]));
let current = null;

const show = trace => trace.forEach(t => console.log("  " + "│ ".repeat(t.depth) + t.text));
const find = part => model.Items.findIndex(i => i.partno.includes(part));
function state() {
  console.log("  state:");
  model.Items.forEach((it, i) => { if (!it.partno.startsWith("KEY:") || it.selected) console.log(`    ${it.selected ? "[x]" : "[ ]"} ${it.partno.padEnd(11)} ${eng.available(i) ? "available" : "BLOCKED  "}  ${it.partdes}`); });
}
function apiChain(id) { const by = new Map(customers.map(c => [c.id, c])); const r = []; for (let c = by.get(id); c && r.length < 3; c = by.get(c.parent)) r.push(c.id); return r; }

function pickCustomer(id) {
  if (!keyIdx.size) { if (current) show(eng.click(find("CUST:" + current), -1)); show(eng.click(find("CUST:" + id), 1)); current = id; return; }
  const chain = apiChain(id), keys = id => (id ? apiChain(id) : []).filter(k => keyIdx.has(k));
  console.log(`  API returns [${chain.join(", ")}]  -> key items: [${keys(id).join(", ") || "none"}]`);
  const oldK = keys(current), newK = keys(id);
  oldK.filter(k => !newK.includes(k)).forEach(k => show(eng.click(keyIdx.get(k), -1)));      // deselect first
  newK.filter(k => !oldK.includes(k)).forEach(k => show(eng.click(keyIdx.get(k), 1)));
  current = id;
}

console.log(`Model: ${file}`); state();
for (const s of args.length ? args : ["@A1a", "@A1b", "@B1a"]) {
  console.log(`\n${s}`);
  if (s[0] === "@") pickCustomer(s.slice(1));
  else { const i = find(s.slice(1)); if (i < 0) { console.log("  no item matches"); continue; } show(eng.click(i, s[0] === "-" ? -1 : 1)); }
  state();
}
