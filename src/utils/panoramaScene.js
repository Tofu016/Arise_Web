// Which scene the panorama viewer is actually showing, given the scene its
// props describe. Props are where we are heading to; `shown` is the last scene
// whose texture finished loading, with its own hotspots and markers
// snapshotted at that moment. Pure: hooks/usePanoramaScene wraps it.
//
// When the viewer holds scenes (`holdsScene`, i.e. a sceneKey was given), a
// move keeps the previous panorama, hotspots and markers up until the new
// photo has loaded; `live` is false during that wait. Without a sceneKey a new
// url simply replaces the scene.
export function resolveScene({ holdsScene, key, shown, hotspots, markers }) {
  const matches = shown?.key === key;
  const live = !holdsScene || !shown || matches;
  return {
    live,
    visible: holdsScene || matches ? shown : null,
    hotspots: live ? hotspots : shown.hotspots,
    markers: live ? markers : shown.markers,
    sceneKey: live ? key : shown.key,
  };
}
