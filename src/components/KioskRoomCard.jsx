import { buildingLabel, floorLabel } from "../utils/constants";
import { KIOSK_DIALOG_TOP, KIOSK_PANORAMA_FRACTION } from "../utils/kioskLayout";
import locationIcon from "../assets/icons/location.svg";
import linkIcon from "../assets/icons/link.svg";
import IconPlaceholder from "./IconPlaceholder";
import { useState } from "react";
import { RoomPhotoCarousel } from "./RoomCard";
import PanoramaPhoto, { Pano360Pill } from "./RoomPanorama";
import { roomPhotos } from "../utils/roomPhotos";

// The kiosk view's room information card. Shares the KioskDialog footprint
// (a half-band-tall slice starting at KIOSK_DIALOG_TOP, closed by a centered
// ✕ underneath) so it sits within reach instead of sliding up from shin height, but needs no
// keyboard, so it's a photo | details split. The content and styling follow
// the desktop RoomCard (maroon sheet, white contact card, description box,
// photo carousel, gold Directions pill); only the layout is kiosk-shaped:
//
//   ┌──────────┬────────────────────┐
//   │ photo    │ ROOM NAME          │
//   │ carousel │ [location/link/tel]│
//   │          │ description, dept  │
//   │          │ [Directions]       │
//   └──────────┴────────────────────┘
//                      (  ✕  )
//
// No save button (the kiosk is a shared screen) and the link/number are
// shown as text: a kiosk can't open a browser tab or place a call.

// There's deliberately no scrim: the lower half of the panorama stays live.
export default function KioskRoomCard({ room, onClose, onGoTo, onGetDirections }) {
  const { roomName, node, placard } = room;

  const photos = roomPhotos(placard);
  // The 360 photo opened over the whole card (details and all); null = closed.
  const [panorama, setPanorama] = useState(null);

  const hasInfo = !!(placard?.roomDescription || placard?.link || placard?.contactNumber);

  return (
    <div
      className="kiosk-dialog-layer"
      style={{
        top: `${KIOSK_DIALOG_TOP * 100}%`,
        "--kiosk-grid-height": `calc(${(KIOSK_PANORAMA_FRACTION / 2) * 100}vh - var(--kiosk-dialog-gap))`,
      }}
    >
      <div className={"kiosk-room-card" + (photos.length === 0 ? " kiosk-room-card-no-photo" : "")} role="dialog" aria-label={roomName}>
        {photos.length > 0 && (
          <div className="kiosk-room-card-photo">
            <RoomPhotoCarousel photos={photos} alt={roomName} onOpenPanorama={setPanorama} />
          </div>
        )}

        <button type="button" className="kiosk-dialog-close kiosk-room-card-close" onClick={onClose} aria-label="Close">
          <IconPlaceholder name="close" className="inline-icon-img" />
        </button>

        <div className="kiosk-room-card-body">
          <h2 className="sidebar-room-title">{roomName}</h2>

          {(node || placard?.link || placard?.contactNumber) && (
            <div className="sidebar-room-contact">
              {node && (
                <p className="sidebar-room-contact-row">
                  <img src={locationIcon} alt="" className="inline-icon-img" />
                  <span>{buildingLabel(node.building)} &middot; {floorLabel(node.floor)}</span>
                </p>
              )}
              {placard?.link && (
                <p className="sidebar-room-contact-row">
                  <img src={linkIcon} alt="" className="inline-icon-img" />
                  <span>{placard.link}</span>
                </p>
              )}
              {placard?.contactNumber && (
                <p className="sidebar-room-contact-row">
                  <IconPlaceholder name="call" className="inline-icon-img" />
                  <span>{placard.contactNumber}</span>
                </p>
              )}
            </div>
          )}

          <div className="kiosk-room-card-text">
            <p className="sidebar-room-description">
              {placard?.roomDescription || (hasInfo ? "No description." : "No information.")}
            </p>
          </div>

          <div className="sidebar-room-actions sidebar-room-actions-stacked">
            <button type="button" className="sidebar-room-goto" onClick={onGoTo}>
              <IconPlaceholder name="location-pin" className="inline-icon-img" /> Go To
            </button>
            <button type="button" className="primary sidebar-room-directions" onClick={onGetDirections}>
              <IconPlaceholder name="directions" variant="white" className="inline-icon-img" /> Directions
            </button>
          </div>
        </div>

        {panorama && (
          <div className="kiosk-room-card-pano">
            <PanoramaPhoto key={panorama.path} path={panorama.path} alt={roomName} hint />
            <Pano360Pill />
            <button type="button" className="kiosk-dialog-close kiosk-room-card-close" onClick={() => setPanorama(null)} aria-label="Close 360 view">
              <IconPlaceholder name="close" className="inline-icon-img" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
