// A 2D redraw of the panorama's actual hotspot (components/panorama/Hotspot.jsx):
// a translucent accent disc with a white upside-down chevron, a static ring
// around it, and a second ring that expands and fades. Radii and chevron
// proportions are that file's own numbers (dot 14, ring 16-20, chevron
// half-width 0.55r, rise 0.4r, thickness 0.26r), so the intro overlays show
// what the visitor will actually see. Opacities mirror its non-hovered state.
export default function HotspotGlyph({ cx, cy }) {
  const chevron = [
    [0, -4.62], [7.7, 0.98], [7.7, 4.62], [0, -0.98], [-7.7, 4.62], [-7.7, 0.98],
  ].map(([x, y]) => `${cx + x},${cy + y}`).join(" ");

  return (
    <>
      <circle
        className="intro-hotspot-ring"
        cx={cx}
        cy={cy}
        r="18"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4"
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      <circle cx={cx} cy={cy} r="18" fill="none" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="4" />
      <circle cx={cx} cy={cy} r="14" fill="var(--accent)" fillOpacity="0.85" />
      <polygon points={chevron} fill="var(--white)" />
    </>
  );
}
