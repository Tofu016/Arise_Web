import { useMemo } from "react";
import { Map, Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { osmRasterStyle } from "../utils/osmMapStyle";
import { allBuildings, allCampuses, campusDisplayName, campusForBuilding } from "../utils/constants";
import { campusPins } from "../utils/campusPins";

// The corner tile's backdrop: a static map centered on the current campus,
// with its pin and no label (the tile carries the building name itself).
export default function CampusMapPreview({ campusId }) {
  const pin = useMemo(
    () =>
      campusPins(allBuildings(), allCampuses(), campusDisplayName, campusForBuilding).find(
        (p) => p.id === campusId
      ),
    [campusId]
  );
  if (!pin) return null;
  return (
    <div className="campus-map-preview" aria-hidden="true">
      <Map
        key={pin.id}
        initialViewState={{ longitude: pin.lng, latitude: pin.lat, zoom: 15 }}
        mapStyle={osmRasterStyle}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        interactive={false}
      >
        <Marker longitude={pin.lng} latitude={pin.lat} scale={0.7} />
      </Map>
    </div>
  );
}
