// Built-in targets. Adding one: drop <name>.mjs here and list it below.
import beer from "./beer.mjs";
import css from "./css.mjs";
import derived from "./derived.mjs";
import designMd from "./design-md.mjs";
import themeJson from "./theme-json.mjs";

export default { [css.name]: css, [themeJson.name]: themeJson, [designMd.name]: designMd, [derived.name]: derived, [beer.name]: beer };
