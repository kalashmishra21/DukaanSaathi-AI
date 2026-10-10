// Keeps the approved visual study isolated from workspace and authentication styles.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "prototypes/stage-12/studio.css");
const target = path.join(root, "src/app/stage12-landing.css");
const css = postcss.parse(fs.readFileSync(source, "utf8"));

css.walkAtRules("font-face", (rule) => rule.remove());
css.walkRules((rule) => {
  if (rule.parent?.name === "keyframes") return;
  rule.selector = rule.selector.split(",").map((raw) => {
    const selector = raw.trim().replaceAll(".demo-response", ".core-demo-response");
    if (selector === ":root" || selector === "body") return ".stage12-landing";
    if (selector.startsWith("html[data-theme=dark]")) return selector.replace("html[data-theme=dark]", "html[data-theme=dark] .stage12-landing");
    if (selector.startsWith("html[data-theme=light]")) return selector.replace("html[data-theme=light]", "html[data-theme=light] .stage12-landing");
    return `.stage12-landing ${selector}`;
  }).join(", ");
});
css.walkDecls((decl) => {
  if (decl.prop.startsWith("--") && !decl.prop.startsWith("--font-")) decl.prop = decl.prop.replace("--", "--s12-");
  decl.value = decl.value
    .replaceAll("var(--", "var(--s12-")
    .replaceAll("var(--s12-font-", "var(--font-")
    .replaceAll("Newsreader", "var(--font-newsreader)")
    .replaceAll("Manrope", "var(--font-manrope)");
});
fs.writeFileSync(target, `/* Approved Stage 12 landing composition, scoped to the public route. */\n${css.toString()}\n`);
