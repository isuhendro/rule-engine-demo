// Engine core: same code as the <core> block in page.template.html (kept in sync by hand). A small version of the real rules engine; returns a trace instead of printing.
export function createEngine(model){
  const nodeById = new Map(model.Nodes.map(n => [n.id, n]));
  let trace = [], depth = 0;
  const log = (cls, text) => trace.push({cls, depth, text});
  function propagate(edgeType, id, change){
    if (edgeType & 0x40) return output(edgeType, id, change);
    return input(edgeType, id, change);
  }
  function input(edgeType, id, change){
    if (edgeType & 0x80) change = -change;           // INVERT flag
    const op = edgeType & 0x7f, node = nodeById.get(id);
    if (!node) return;
    const before = node.g;
    let out = 0;
    if (op === 0x2){ node.g += change; out = before >= 0 ? (node.g >= 0 ? 0 : -1) : (node.g >= 0 ? 1 : 0); }   // GTE_0
    else if (op === 0x1){ node.a += change; out = change; }                                                     // SUM_a
    log(out === 0 ? "t-stop" : "t-flip", `[${node.id}] ${node.name}  g ${before} -> ${node.g}  ` + (out === 0 ? "no flip -> STOP" : `FLIP, emits ${out > 0 ? "+" : ""}${out}`));
    if (out === 0) return;
    depth++;
    for (const e of node.edges){
      const targets = (e.type & 0xf00) === 0x100 ? Array.from({length:e.node[1]}, (_, i) => e.node[0] + i) : e.node;   // CML or LUT
      for (const t of targets) propagate((e.type & 0xff) | (e.type & 0x80), t, out);
    }
    depth--;
  }
  function output(edgeType, target, change){
    if (edgeType === 0x43){ const it = model.Items[target]; it.precon += change;
      log("t-out", `=> I_AVL  item ${it.partno}  precon ${it.precon - change} -> ${it.precon}  (${it.precon >= 0 ? "AVAILABLE" : "blocked"})`); }
    else if (edgeType === 0x41){ const ch = model.Chaids[target]; ch.precon += change;
      log("t-out", `=> C_AVL  choice ${ch.chaId}  precon ${ch.precon - change} -> ${ch.precon}  (${ch.precon >= 0 ? "AVAILABLE" : "blocked"})`); }
    else log("t-warn", `=> output ${edgeType.toString(16)} not implemented in this demo`);
  }
  const choiceOf = idx => model.Chaids.find(c => idx >= c.firstItem && idx <= c.lastItem);
  const available = idx => model.Items[idx].precon >= 0 && choiceOf(idx).precon >= 0;
  function click(idx, change){
    trace = []; depth = 0;
    const it = model.Items[idx];
    if (change > 0 && !available(idx)) { log("t-warn", `refused: ${it.partno} is not available`); return trace; }
    const batch = [];
    if (change > 0 && choiceOf(idx).multiple === false)      // single-select choice: deselect the old one first
      for (let i = choiceOf(idx).firstItem; i <= choiceOf(idx).lastItem; i++) if (i !== idx && model.Items[i].selected) batch.push([i, -1]);
    batch.push([idx, change]);                                // deselections run before selections (same as the real engine)
    for (const [i, c] of batch){
      const x = model.Items[i];
      log("t-click", `${c > 0 ? "SELECT" : "DESELECT"} ${x.partno}  (${x.partdes})`);
      x.selected = c > 0;
      input(0x2, x.inode, c);                                 // UI sends {inputEdge: 2, inputNode: <item node>, changeIn: +-1}
    }
    return trace;
  }
  return {model, click, available, choiceOf};
}
