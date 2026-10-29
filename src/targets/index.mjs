// Built-in targets. Adding one: drop <name>.mjs here and list it below.
import beer from "./beer.mjs";
import composeTv from "./compose-tv.mjs";
import css from "./css.mjs";
import derived from "./derived.mjs";
import designMd from "./design-md.mjs";
import materialYou from "./material-you.mjs";
import mealie from "./mealie.mjs";
import obsidian from "./obsidian.mjs";
import playground from "./playground.mjs";
import tailwind from "./tailwind.mjs";
import themeJson from "./theme-json.mjs";

export default { [css.name]: css, [themeJson.name]: themeJson, [designMd.name]: designMd, [derived.name]: derived,
  [tailwind.name]: tailwind, [composeTv.name]: composeTv, [obsidian.name]: obsidian, [mealie.name]: mealie,
  [materialYou.name]: materialYou, [beer.name]: beer, [playground.name]: playground };
