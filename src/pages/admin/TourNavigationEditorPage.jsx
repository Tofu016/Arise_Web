import { useState } from "react";
import { useTourStops } from "../../hooks/useTourStops";
import { useTourSections } from "../../hooks/useTourSections";
import TourStopList from "../../components/TourStopList";
import { GraphEditorBanners, GraphEditorPreview, LinkList, AddLinkBox } from "../../components/GraphEditorControls";
import { useGraphEditor } from "../../hooks/useGraphEditor";

// Campus Tour equivalent of Virtual Map Navigation Editor — the same
// walking/linking/placing mechanic (stop-to-stop hotspots) and the same
// banners/preview/link-list/add-link shell, shared through useGraphEditor
// and GraphEditorControls. Unlike the indoor side, tour stops carry no
// markers, so there is no marker panel here.
//
// Calls useTourStops()/useTourSections() directly, same as
// TourStopsPage.jsx — not shared Outlet context yet (see that page's own
// comment on this; still just these two Campus Tour admin pages, so
// nothing to share the selection with outside this file yet either).
export default function TourNavigationEditorPage() {
  const {
    stops, selectedStopId, setSelectedStopId, setNeighbors, setHotspot, setDefaultView, clearDefaultView,
  } = useTourStops();
  const { sections } = useTourSections();

  const editor = useGraphEditor({
    items: stops,
    selectedId: selectedStopId,
    setSelectedId: setSelectedStopId,
    setNeighbors,
    setHotspot,
    setDefaultView,
    clearDefaultView,
  });
  const { current } = editor;

  const [sectionFilter, setSectionFilter] = useState("all");

  const sidebar = (
    <div className="navigation-editor-sidebar">
      <div className="panel">
        <h3>Filter</h3>
        <label>
          Section
          <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
            <option value="all">All</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>{sec.label}</option>
            ))}
          </select>
        </label>
      </div>
      <TourStopList
        stops={stops}
        sections={sections}
        sectionFilter={sectionFilter}
        selectedStopId={selectedStopId}
        onSelect={editor.select}
      />
    </div>
  );

  if (!current) {
    return (
      <div className="navigation-editor-page">
        <div className="navigation-editor-main">
          <h2 className="admin-page-heading">Campus Tour Navigation Editor</h2>
          <p className="empty-hint">Select a tour stop from the list on the right to start linking it up.</p>
        </div>
        {sidebar}
      </div>
    );
  }

  return (
    <div className="navigation-editor-page">
      <div className="navigation-editor-main">
        <h2 className="admin-page-heading">Campus Tour Navigation Editor</h2>

        <GraphEditorBanners editor={editor} />

        <GraphEditorPreview editor={editor} itemNoun="stop" />

        <div className="navigation-editor-title-row">
          <h3>{current.name}</h3>
          <p className="preview-sub">
            {sections.find((sec) => sec.id === current.section)?.label || "No section"}
          </p>
        </div>

        <div className="navigation-editor-lists">
          <LinkList editor={editor} />
        </div>

        <div className="navigation-editor-add-row">
          <AddLinkBox editor={editor} itemNoun="stop" />
        </div>
      </div>

      {sidebar}
    </div>
  );
}
