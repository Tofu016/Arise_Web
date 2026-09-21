# ARISE

Campus virtual tour: visitors walk through 360° panoramas of indoor and outdoor locations; admins author the content.

## Language

**Node**:
An indoor panorama point (building, floor, type) linked to neighboring Nodes.

**Tour stop**:
An outdoor panorama point, grouped into a **Section**.

**Photo kind**:
A category of stored photo (node panorama, room photo, room 360, tour panorama, tour cover, tour marker). A kind decides where the photo is stored and whether it is public or protected.
_Avoid_: photo type, upload type

**Public photo**:
A photo anyone can view without signing in (the tour kinds).

**Protected photo**:
A photo only viewable after a role check (the indoor kinds).

**Blur review**:
The admin step where a new node panorama is manually blurred before it is published; until confirmed, the upload is held in a temporary area.
_Avoid_: face scan, face review (automatic detection no longer exists)

**Walk**:
Moving to a neighboring Node by its hotspot; the visitor keeps their history and faces the way they went.

**Jump**:
Moving anywhere else (search result, entrance, room card, start of a route) as a fresh start; history is cleared.

**Flyover**:
The map animation shown before any move between two places with different real coordinates (a cross-campus move). GD1/GD2/GD3 share coordinates, so moves between them never fly over.

**Route**:
The shortest walkable sequence of Nodes between two points, followed one stop at a time (optionally hands-free, as auto-walk).

**Entity mapping**:
Translating between a backend row (snake_case) and the app's object (camelCase), and back into request bodies. Kept in one place per entity; empty-value conventions (e.g. a photo is "" when empty, but a section cover is null) are part of the backend contract.

**Compact layout**:
The stacked, touch-first layout (radial dock, bottom sheets, on-screen keyboard) shared by phones and portrait kiosk screens. There is no separate kiosk build: any narrow screen, or any portrait screen taller than 1.3× its width, gets it, so the range of kiosk resolutions is deliberately generous (the first kiosk is 1080 × 1920).
_Avoid_: mobile layout

**Kiosk session**:
The flow a visitor goes through on the Compact layout: the start screen until it is tapped, then the building screen until a building is picked, then exploring. It ends by remounting the visitor view (finished feedback, or "Start over" on the idle prompt), which drops all visitor state. Desktop skips it.

**Directions**:
The from/to panel and the Route it computes. Opening it replaces whatever panel was showing, and getting directions starts the walk in one go (a Jump to the Route's first stop, then the Route is followed one stop at a time).
