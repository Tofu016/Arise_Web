// One campus has one position: the first of its buildings with coordinates,
// the same rule findFlyover uses (utils/navigation.js), so every campus map
// and the cross-campus flyover always agree on where a campus is.
export function campusPins(buildings, campuses, campusLabel, campusFor) {
  const pins = [];
  for (const campus of campuses) {
    const anchor = buildings.find(
      (b) => campusFor(b.id) === campus.id && b.lat != null && b.lng != null
    );
    if (anchor) pins.push({ id: campus.id, label: campusLabel(campus.id), lat: anchor.lat, lng: anchor.lng });
  }
  return pins;
}
