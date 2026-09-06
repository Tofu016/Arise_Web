// Virtual Tour-specific helpers — deliberately its own file rather than
// additions to constants.js, which is shared, critical infrastructure
// for the indoor node system. Tour stops have no building/floor/type to
// key an ID off of, so this can't reuse suggestNodeId's exact logic
// directly, but mirrors its overall approach: a slug from the one thing
// that IS available (the stop's own name), with a trailing number picked
// to avoid colliding with anything already in use.

function slugify(text) {
  return (text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Exported for useTourSections.js's own ID generation, which mirrors
// buildingStore.js's addCustomBuilding — Section ids are generated
// silently on save, not shown/editable in the form the way Tour Stop
// ids are (see suggestTourStopId below), matching how "New Building"
// doesn't expose a Building id field either. Deliberately keeps this
// file's own underscore-separated slug convention rather than copying
// buildingStore.js's no-separator one (`gd4`-style short codes) — Section
// names are longer, descriptive phrases, where underscores stay far more
// readable than concatenating everything together.
export { slugify };

// Builds a tour_{slugified name}{number} id and picks the next free number
// for that exact slug, so two stops with similar names (or the same name)
// never collide. `excludeId` lets the caller leave a stop's own current id
// out of the "already used" check — same purpose as suggestNodeId's own
// excludeId, used when suggesting a rename for a stop that already
// occupies its own slot.
export function suggestTourStopId(name, stops, excludeId = null) {
  const slug = slugify(name) || "stop";
  const prefix = `tour_${slug}`;
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const used = new Set();
  for (const s of stops) {
    if (s.id === excludeId) continue;
    const match = s.id.match(pattern);
    if (match) used.add(Number(match[1]));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `${prefix}${String(n).padStart(2, "0")}`;
}

// Same pattern as constants.js's suggestedPhotoFilename — names the
// uploaded photo after the stop's own ID, so it's predictable and a
// replacement upload cleanly overwrites the same file.
export function suggestedTourPanoramaFilename(id) {
  return id ? `${id}.jpg` : "";
}
