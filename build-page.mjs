// Builds interactive.html: page.template.html + the three models + customers.json (the API stand-in).
//   node build-page.mjs
import fs from "fs";
const read = f => fs.readFileSync(f, "utf8");
const models = { flat: read("model.json"), keys: read("model.keys.json"), gates: read("model.gates.json") };
const html = read("page.template.html")
  .replace("%%MODELS%%", () => "{ " + Object.entries(models).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ") + " }")
  .replace("%%API%%", () => JSON.stringify(JSON.parse(read("customers.json"))));
fs.writeFileSync("interactive.html", html);
console.log("interactive.html written,", html.length, "bytes");
