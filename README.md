# Rule engine demo

Live page: https://isuhendro.github.io/rule-engine-demo/ (`index.html` is a copy of `interactive.html`).

A small, dependency-free demo of a product configurator rules engine ("NeuralNet") and of how customer-specific AVs (CSAVs) can be modelled, including a customer hierarchy
(Top > Account > Org). It uses artificial data with generic names. Needs Node.js only.

## Try it
```
node build-page.mjs        # only after you change a model or data file; writes interactive.html
start interactive.html     # or double-click it; pick an example in the dropdown and click
node engine.js             # command line, default model: model.keys.json
node bake.test.mjs         # tests
```

## The three examples
| # | File | What it shows |
|---|---|---|
| 1 | `model.json` | Hand-written. AVs for **all** customers, **1** customer, **N** customers (OR gate). |
| 2 | `model.keys.json` | **Recommended.** Customer picked through an API that returns `[id, parent, grandparent]`. The model only has hidden key items for customers that an AV is tied to. |
| 3 | `model.gates.json` | Alternative. The whole hierarchy is baked into the model: each customer has a gate that feeds its parent's gate. |

Examples 2 and 3 are generated from two small input files: `customers.json` (the API stand-in: `id`, `name`, `level`, `parent`, `mdmId`) and `avs.json` (each AV and the customers it is tied to, `[]` = all customers).

```
node bake.mjs                        # customers.json + avs.json -> model.keys.json
node bake.mjs --gates                # ... -> model.gates.json
```

## Rule
An AV tied to a customer is available to that customer **and everything below it**. An AV tied to no customer is always available.

| Customer chosen | AV-ALL | AV-TOP-A | AV-ACCT-A1 | AV-ORG-A1b | AV-MIX (A2 + B1a) |
|---|---|---|---|---|---|
| none | yes | no | no | no | no |
| Top A | yes | yes | no | no | no |
| Account A1 / Org A1a | yes | yes | yes | no | no |
| Org A1b | yes | yes | yes | yes | no |
| Account A2 / Org A2a | yes | yes | no | no | yes |
| Top B / Account B1 | yes | no | no | no | no |
| Org B1a | yes | no | no | no | yes |

## How each example works
- **Gate.** A node `g` starts at -1 and counts incoming +1 / -1 changes. It passes a change on only when it crosses zero (the code calls this `GTE_0`). So an item with a gate is available when `g >= 0`.
- **AV with N customers.** All its customers feed one gate (OR). With 0 customers there is no gate.
- **Example 2 (keys).** Choosing a customer makes the UI call the API, then select the key items whose id is in the result. Customers that no AV is tied to have no key item and are ignored.
  A customer switch deselects the old keys first, then selects the new ones.
- **Example 3 (gates).** Choosing an org turns on its own gate, its account's gate and its top's gate, so an AV tied to any of them opens.

## Commands
```
node engine.js model.keys.json @A1a @A1b @B1a      # @ID = pick a customer (uses customers.json)
node engine.js model.gates.json @A1a
node engine.js model.json +AV-ONE                   # + select, - deselect, matched on partno
```

## Files
| File | Purpose |
|---|---|
| `core.mjs` | The engine (used by `engine.js` and the tests). The same code is inside `page.template.html`. |
| `bake.mjs` | Builds a model from `customers.json` + `avs.json`. |
| `bake.test.mjs` | Compares both baked models with the rule written directly, for every customer and AV, on the sample data and on a random hierarchy (250 customers, 60 AVs). |
| `page.template.html`, `build-page.mjs` | The interactive page and its builder. |

## Simplifications
The engine implements only `GTE_0` and `SUM_a` gates, the invert flag, LUT and CML node lists, and the `C_AVL` and `I_AVL` outputs. There is no auto-select, conflict or quantity logic.
The clicked item is marked selected directly. Model items use the real field names (`partno`, `partdes`, `precon`, `selected`, `inode`, ...). `mdmId` is a new field proposed for the MDM id.
Which choices are hidden is a constant in the page (`HIDDEN_CHOICES`), as in the real engine, not a field in the model.

## Sample PCS files (`pcs-samples/`)
`node make-pcs.mjs` writes one sample `.PCS` per customer scenario (same layout as a real file: `PCR_SPEC`, `RELEASE_INFO`, the `CS_C` customer values, then the items with `Conditional Selection`). `node pcs.test.mjs` reads them back and checks each AV's customers against `avs.json`.
All names, part numbers and the e-mail are artificial. The files follow the **proposed** format: no local `T0xx` codes. The `CS_C` Value ID is the MDM id, only customers that an AV is tied to are listed, and the hierarchy is not in the file (the API returns the parent and grandparent ids at selection time).

| File | Scenario | Conditional Selection |
|---|---|---|
| `1_all_customers.PCS` | all customers (no `CS_C` values needed) | empty |
| `2_one_customer.PCS` | 1 customer | `CS_C + CS_C MDM-3002` |
| `3_n_customers.PCS` | N customers | `CS_C + CS_C MDM-2002,MDM-3004` |
| `4_all_scenarios.PCS` | all of the above, plus AVs tied to a Top or an Account | one id per tied customer; everything below inherits through the API |
