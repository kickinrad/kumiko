// Built-in targets. Adding one: drop <name>.mjs here and list it below.
import beer from "./beer.mjs";
import claudeDesign from "./claude-design.mjs";
import composeTv from "./compose-tv.mjs";
import css from "./css.mjs";
import designMd from "./design-md.mjs";
import materialYou from "./material-you.mjs";
import mealie from "./mealie.mjs";
import obsidian from "./obsidian.mjs";
import playground from "./playground.mjs";
import plugin from "./plugin.mjs";
import tailwind from "./tailwind.mjs";
import template from "./template.mjs";

export default { [css.name]: css, [designMd.name]: designMd,
  [tailwind.name]: tailwind, [composeTv.name]: composeTv, [obsidian.name]: obsidian, [mealie.name]: mealie,
  [materialYou.name]: materialYou, [beer.name]: beer, [playground.name]: playground, [claudeDesign.name]: claudeDesign,
  [plugin.name]: plugin, [template.name]: template };
