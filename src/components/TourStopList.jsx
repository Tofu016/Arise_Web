import { useMemo } from "react";
import EntityListPanel from "./EntityListPanel";

// Tour Stop equivalent of NodeList.jsx — same shared EntityListPanel
// rendering, just filtered by Section instead of Building/Floor/Type/
// Photo Status, since only Section applies here.
export default function TourStopList({ stops, sections, sectionFilter, selectedStopId, onSelect }) {
  const sectionLabel = (id) => sections.find((sec) => sec.id === id)?.label || "No section";

  const filtered = useMemo(() => {
    if (sectionFilter === "all") return stops;
    return stops.filter((s) => s.section === sectionFilter);
  }, [stops, sectionFilter]);

  return (
    <EntityListPanel
      label="Tour Stops"
      allItems={stops}
      filteredItems={filtered}
      selectedId={selectedStopId}
      onSelect={onSelect}
      renderMeta={(s) => (
        <>
          {sectionLabel(s.section)}
          {s.neighbors?.length ? ` · ${s.neighbors.length} links` : " · unlinked"}
        </>
      )}
      emptyMessage="No tour stops match this filter."
    />
  );
}
