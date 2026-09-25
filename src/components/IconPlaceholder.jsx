import placeholderIcon from "../assets/icons/icon-placeholder.svg";

// Stand-in for a real icon that hasn't been supplied yet — see the icon
// list handed back to the user. `name` is a short descriptive id (e.g.
// "camera", "edit-pencil") surfaced as a data attribute so every pending
// icon can be found later with a single search for "icon-placeholder.svg".
export default function IconPlaceholder({ name, className = "" }) {
  return (
    <img
      src={placeholderIcon}
      alt=""
      className={`icon-placeholder-img${className ? ` ${className}` : ""}`}
      data-icon-placeholder={name}
    />
  );
}
