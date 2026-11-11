// Checks both baked models against the rule written directly:
//   an AV is available when it is tied to no customer, or the chosen customer, its parent or its grandparent is one of its customers.
// Every customer x AV pair is compared, including switching from one customer to another, on the sample data and on a large random hierarchy.
import fs from "fs";
import { bakeKeys, bakeGates } from "./bake.mjs";
import { createEngine } from "./core.mjs";

const clone = o => JSON.parse(JSON.stringify(o));
function check(customers, avs, label) {
  const byId = new Map(customers.map(c => [c.id, c]));
  const chain = id => { const r = []; for (let c = byId.get(id); c && r.length < 3; c = byId.get(c.parent)) r.push(c.id); return r; };   // what the API returns
  let ok = true;
  for (const [mode, bake] of [["keys", bakeKeys], ["gates", bakeGates]]) {
    const model = bake(customers, avs), firstAv = model.Items.findIndex(i => !/^(KEY|CUST):/.test(i.partno));
    const idx = new Map(model.Items.map((it, i) => [it.partno, i]));
    // keys: select the key items of the API result; gates: select the customer item itself
    const itemsFor = id => !id ? [] : mode === "keys" ? chain(id).filter(c => idx.has("KEY:" + c)).map(c => idx.get("KEY:" + c)) : [idx.get("CUST:" + id)];
    const set = (eng, from, to) => { const o = itemsFor(from), n = itemsFor(to);
      o.filter(i => !n.includes(i)).forEach(i => eng.click(i, -1)); n.filter(i => !o.includes(i)).forEach(i => eng.click(i, 1)); };
    let bad = 0, checks = 0;
    const ids = [null, ...customers.map(c => c.id)], pick = (k, m) => ids.filter((_, i) => i % m === 0 || ids.length < 20);
    for (const from of pick(0, 7)) for (const to of pick(0, 5)) {
      const eng = createEngine(clone(model)); set(eng, null, from); set(eng, from, to);
      avs.forEach((a, j) => { const expected = !(a.customers || []).length || (to && chain(to).some(c => a.customers.includes(c)));
        checks++; if (!!expected !== eng.available(firstAv + j)) { bad++; if (bad <= 3) console.log(`  MISMATCH ${mode} ${from}->${to} ${a.partno}`); } });
    }
    console.log(`${label} / ${mode}: ${model.Items.length} items, ${model.Nodes.length} nodes -> ${checks} checks, ${bad} mismatches`);
    ok = ok && bad === 0;
  }
  return ok;
}
let ok = check(JSON.parse(fs.readFileSync("customers.json")), JSON.parse(fs.readFileSync("avs.json")), "sample");
let seed = 99; const rnd = n => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % n; };
const customers = [];
for (let t = 0; t < 10; t++) { customers.push({ id: `T${t}`, name: `Top ${t}`, level: 1, parent: null });
  for (let a = 0; a < 4; a++) { customers.push({ id: `T${t}A${a}`, name: `Acct ${t}.${a}`, level: 2, parent: `T${t}` });
    for (let o = 0; o < 5; o++) customers.push({ id: `T${t}A${a}O${o}`, name: `Org ${t}.${a}.${o}`, level: 3, parent: `T${t}A${a}` }); } }
const avs = Array.from({ length: 60 }, (_, i) => ({ partno: `AV${i}`, desc: "", customers: Array.from({ length: rnd(4) }, () => customers[rnd(customers.length)].id) }));
ok = check(customers, avs, "random (250 customers, 60 AVs)") && ok;
console.log(ok ? "ALL OK" : "FAILED"); process.exit(ok ? 0 : 1);
