import placeholderIcon from "../assets/icons/icon-placeholder.svg";

// Real icon assets copied from ui-branding-guidelines, keyed by the same
// `name` every call site already passes in. Two variants exist because the
// same marker type (e.g. "door") renders both inline in admin text (light
// background, grey icon) and on a colored panorama marker dot (needs the
// white icon for contrast) — see the `variant` prop below.
const greyIcons = import.meta.glob("../assets/icons/grey/*.svg", { eager: true, import: "default" });
const whiteIcons = import.meta.glob("../assets/icons/white/*.svg", { eager: true, import: "default" });

function toIconMap(modules) {
  const map = {};
  for (const path in modules) {
    const name = path.split("/").pop().replace(/\.svg$/, "");
    map[name] = modules[path];
  }
  return map;
}

const ICONS = { grey: toIconMap(greyIcons), white: toIconMap(whiteIcons) };

// `name` is the short descriptive id (e.g. "camera", "edit-pencil") already
// used throughout the app. `variant` picks grey (default, for light
// backgrounds) or white (for on-marker use over a colored dot). Falls back
// to the dashed magenta placeholder for any name that has no real asset yet
// — search "icon-placeholder.svg" to find those.
export default function IconPlaceholder({ name, variant = "grey", className = "" }) {
  const src = ICONS[variant]?.[name] || placeholderIcon;
  return (
    <img
      src={src}
      alt=""
      className={`icon-placeholder-img${className ? ` ${className}` : ""}`}
      data-icon-placeholder={name}
    />
  );
}
