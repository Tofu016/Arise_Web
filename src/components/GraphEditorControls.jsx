import PanoramaNav from "./PanoramaNav";

// The parts of a graph editor page (NavigationEditorPage, TourNavigationEditorPage)
// that are byte-for-byte identical between the indoor and Campus Tour sides,
// since both share the same walking/linking/placing mechanic via
// useGraphEditor. Markers and the title-row subtitle are genuinely
// different per page (typed room markers vs. equipment+photos, floor/building
// vs. section) and stay in each page.
//
// Every component here takes the whole `editor` returned by useGraphEditor —
// both pages already hold it in the same shape, so passing it whole costs
// callers nothing extra to learn.

// The three placing/capture banners, in the order they can appear. `children`
// renders after them, for a page's own extra banner (NavigationEditorPage's
// "settingStartingView").
export function GraphEditorBanners({ editor, children }) {
  const { placingFor, placingMarker, defaultViewTarget, byId } = editor;
  return (
    <>
      {placingFor && (
        <div className="placing-banner">
          Click on the panorama to place the arrow toward "{byId[placingFor]?.name || placingFor}"
          <button onClick={editor.cancelLinkPlacement}>Cancel</button>
        </div>
      )}
      {placingMarker && (
        <div className="placing-banner">
          Click on the panorama to place the marker
          {placingMarker.mode === "new" ? ` "${placingMarker.marker.label}"` : ""}
          <button onClick={editor.cancelMarkerPlacement}>Cancel</button>
        </div>
      )}
      {defaultViewTarget && (
        <div className="placing-banner">
          Drag to orbit to the view visitors should see on arrival here from "{defaultViewTarget.fromName}", then Save.
          <button onClick={editor.requestCapture}>Save this view</button>
          <button onClick={editor.cancelSetDefaultView}>Cancel</button>
        </div>
      )}
      {children}
    </>
  );
}

// The panorama itself, plus the missing/loading photo notes and the
// look-around hint with its Back button. `itemNoun` is "node" or "stop",
// for the missing-photo copy.
export function GraphEditorPreview({ editor, itemNoun }) {
  const { current, hotspots, markers, photoUrl, photoMissing, history } = editor;
  return (
    <>
      <div className="preview-screen navigation-editor-screen">
        <PanoramaNav
          key={current.id}
          url={photoUrl || ""}
          hotspots={hotspots}
          markers={markers}
          onNavigate={editor.goTo}
          onError={() => editor.setPhotoMissing(true)}
          placing={editor.placing}
          onPlaceAngle={editor.placeAngle}
          initialYaw={editor.entryYaw}
          initialPitch={editor.entryPitch}
          captureRequestId={editor.captureRequestId}
          onCaptureAngle={editor.handleCapturedAngle}
        />
      </div>
      {(!current.photo || photoMissing) && (
        <p className="photo-missing-note">
          No photo loaded for this {itemNoun} yet — hotspots still work for testing the link graph.
        </p>
      )}
      {current.photo && !photoUrl && !photoMissing && (
        <p className="photo-missing-note">Loading photo…</p>
      )}
      <p className="preview-hint">
        Left-click and drag to look around · click a link to teleport
        {history.length > 0 && (
          <button className="back-btn" onClick={editor.goBack}>← Back</button>
        )}
      </p>
    </>
  );
}

// The "Links added" column: every hotspot, with reposition/default-view/remove.
export function LinkList({ editor }) {
  const { hotspots } = editor;
  return (
    <div className="navigation-editor-list-col">
      <h5>Links added ({hotspots.length})</h5>
      <div className="link-list navigation-editor-scroll-list">
        {hotspots.length === 0 && <p className="empty-hint">No links yet.</p>}
        {hotspots.map((h) => (
          <div key={h.id} className="link-row">
            <span className="link-name">
              {h.name}
              {h.defaultYaw != null && <span className="field-hint"> · default view set</span>}
            </span>
            <div className="link-actions">
              <button onClick={() => editor.startRepositionLink(h.id)}>Reposition</button>
              <button onClick={() => editor.startSetDefaultView(h.id)}>
                {h.defaultYaw != null ? "Reset" : "Set"} default view
              </button>
              {h.defaultYaw != null && (
                <button onClick={() => editor.clearDefaultView(h.id)}>Clear default view</button>
              )}
              <button className="danger" onClick={() => editor.removeLink(h.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// The "Add Links" column: the toggle button and, once open, the search box.
// `itemNoun` is "node" or "stop", for the search placeholder.
export function AddLinkBox({ editor, itemNoun }) {
  return (
    <div className="navigation-editor-add-col">
      <h5>Links</h5>
      {!editor.adding ? (
        <button className="add-link-btn" onClick={() => editor.setAdding(true)}>+ Add Links</button>
      ) : (
        <div className="add-link-box">
          <input
            type="text"
            autoFocus
            placeholder={`Search ${itemNoun} by name or ID...`}
            value={editor.addSearch}
            onChange={(e) => editor.setAddSearch(e.target.value)}
          />
          <div className="add-link-results">
            {editor.candidates.map((n) => (
              <div key={n.id} className="add-link-result" onClick={() => editor.addLink(n.id)}>
                {n.name} <span className="neighbor-id">{n.id}</span>
              </div>
            ))}
            {editor.addSearch && editor.candidates.length === 0 && (
              <p className="empty-hint">No matches.</p>
            )}
          </div>
          <button onClick={editor.cancelAddingLink}>Cancel</button>
        </div>
      )}
    </div>
  );
}
