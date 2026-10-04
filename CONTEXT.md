# ARISE

Campus virtual tour: visitors walk through 360° panoramas of indoor and outdoor locations; admins author the content.

## Language

**Node**:
An indoor panorama point (building, floor, type) linked to neighboring Nodes.

**Tour stop**:
An outdoor panorama point, grouped into a **Section**.

**Photo kind**:
A category of stored photo (node panorama, room photo, room 360, tour panorama, tour cover, signage). A kind decides where the photo is stored and whether it is public or protected. Signage is the one kind that may also be a video.
_Avoid_: photo type, upload type

**Public photo**:
A photo served straight from disk to anyone (the tour kinds and signage).

**Protected photo**:
A photo stored outside the web server's reach and streamed only through the serve endpoint (the indoor kinds). The endpoint does not check who is asking, since `/` is public: "protected" describes where the file lives, not who may view it.

**Blur review**:
The admin step where a new node panorama is manually blurred before it is published; until confirmed, the upload is held in a temporary area.
_Avoid_: face scan, face review (automatic detection no longer exists)

**Walk**:
Moving to a neighboring Node by its hotspot; the visitor keeps their history and faces the way they went.

**Jump**:
Moving anywhere else (search result, entrance, room card, start of a route) as a fresh start; history is cleared.

**Flyover**:
The map animation shown before any move between two places with different real coordinates (a cross-campus move). GD1/GD2/GD3 share coordinates, so moves between them never fly over.

**Campus**:
A cluster of one or more buildings that are physically one place. GD1, GD2, and GD3 are separate buildings but one campus (interconnected, walkable between them, never a Flyover); Digital Campus is a separate building and its own, separate campus.

**Campus entrance**:
The single Node, per campus, an admin flags as representing that whole campus — a node-level setting (`campusEntrance`), restricted to `entrance`-type nodes, with only one true per campus at a time (saving a second one on the same campus replaces the first). Drives the cross-campus minimap widget and a Kiosk floor-screen shortcut.

**Building entrance**:
The single Node, per building, an admin flags as representing that one building — a node-level setting (`buildingEntrance`), restricted to `entrance`-type nodes, with only one true per building at a time. Independent of Campus entrance: a node can be both, either, or neither (GD1's building entrance and Main Campus's campus entrance are often the same node, but don't have to be). Offered as a Kiosk floor-screen shortcut; when it's the same node as the campus entrance, only the campus entrance button is shown.

**Emergency Exit Destination Point**:
A Node an admin ticked (`isEmergencyDestination`) to say that someone who reaches it is out of danger; only an `open_area`, `parking`, `lobby`, `entrance` or `fire_exit` Node on Floor 1 or Underground can be ticked. The end of a Nearest Exit Route. Nothing is automatic: an unticked Node never counts, and the system cannot check a ticked Lobby or Entrance, which may be indoors or open into another indoor space. A Fire Exit that is a stairwell is a way toward an exit, not one. A building with none ticked gets no Nearest Exit route.
_Avoid_: "exit" on its own, "emergency exit node"

**Nearest Exit**:
The one-tap emergency Route to the closest Emergency Exit Destination Point. Never uses an elevator, passes through fire stairwells, and never rises above the higher of the visitor's own floor and Floor 1 (the ground floor in every building), so an underground level climbs to Floor 1 but someone on Floor 1 is never led up and over; rises higher only as a last resort, with a warning. The visitor can report the next stop blocked to get another way out.

**Route**:
The shortest walkable sequence of Nodes between two points, followed one stop at a time (optionally hands-free, as auto-walk).

**Elevator**:
Its own record (Elevator ID, Label, Building, Accessible floors — the floors it actually stops at), independent of any node. A landing marker on a floor's Node just points at one by id; label and floors are always read live from that one record, so its landings can never disagree.
_Avoid_: storing an elevator's floors on the marker itself (a past design that could drift between landings — see below).

**Elevator marker**:
The one point-of-interest marker type that navigates: it points at an Elevator. Clicking one in the public viewer Walks to another floor's landing directly (history kept, so Back rides it down again), or opens a floor picker when the elevator serves more than two. Getting directions across floors asks Stairs or Elevator when both are actually possible and different; only one option skips the question. Fire Exit nodes are never routed through by either option — emergency use only.

**Entity mapping**:
Translating between a backend row (snake_case) and the app's object (camelCase), and back into request bodies. Kept in one place per entity; empty-value conventions (e.g. a photo is "" when empty, but a section cover is null) are part of the backend contract.

**Compact layout**:
The stacked, touch-first layout (radial dock, bottom sheets, on-screen keyboard) shared by phones and portrait kiosk screens. There is no separate kiosk build: any narrow screen, or any portrait screen taller than 1.3× its width, gets it, so the range of kiosk resolutions is deliberately generous (the first kiosk is 1080 × 1920).
_Avoid_: mobile layout

**Kiosk session**:
The flow a visitor goes through on the Compact layout: the start screen until it is tapped, then the building screen until a building is picked, then exploring. It ends by remounting the visitor view (finished feedback, or "Start over" on the idle prompt), which drops all visitor state. Desktop skips it.

**Paired kiosk**:
A physical kiosk device an admin registered on the Kiosks page and paired once, by a hidden tap gesture and a one-time code. Only a paired kiosk's sessions count as kiosk sessions in Analytics; every other session, even one showing the Compact layout, is a web session. Unpaired views also lack the "Kiosk Location" starting point.
_Avoid_: desktop session (say web session)

**Directions**:
The from/to panel and the Route it computes. Opening it replaces whatever panel was showing, and getting directions starts the walk in one go (a Jump to the Route's first stop, then the Route is followed one stop at a time).

**Facility**:
A Facility marker on a Node, treated as a destination like a room: it has the same saved details (description, department, contact number, link, photos), appears in search and Saved Directories, and opens the same room panel when its marker is clicked. Unlike a room it is not in the Node's "Rooms served"; its label is its name, so renaming it relabels the marker. Rooms and facilities share one details table keyed by name, so a name can be used only once across both.
_Avoid_: amenity, service

**Contact number**:
The optional telephone number an admin sets on a room's or facility's details in the Room and Facility Editor (`contactNumber` / `contact_number`), shown on the desktop room panel. It replaced the old free-text "Use" field.
_Avoid_: phone number, phone

**Saved room**:
A room a visitor bookmarked with the save button on a room panel. On the web it is kept only in that browser's localStorage, by room name, with no account involved, so renaming the room in the Room and Facility Editor drops it from the list.
_Avoid_: favorite, starred room

**Signage**:
The advertisements an admin rotates through the Compact layout's bottom band (the whitespace below the panorama, 1080 × 336 on the first kiosk). Each **Signage slide** is one image, GIF or looping video with a band-shaped crop, a time on screen, an on/off switch and an optional run window; it is **live** when switched on and inside its window. Called "Advertisements" in the admin UI only.
_Avoid_: "ad"/"advert" in any code identifier, file path, table, endpoint or CSS class (ad blockers hide or refuse those, blanking the band or the admin's previews; the admin page's route `/admin/advertisements` is the one exception, since page URLs follow page names); banner (that's the whole band, not one slide).
