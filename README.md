# ARISE Campus Navigator

A self-built 360° panorama campus tour — an admin editor for mapping real
locations as a linked graph of panoramas, and a public-facing viewer for
walking through the campus and getting directions to a room, hallway by
hallway, the way Street View walks you down a street.

There's no 3D building model behind this (the original `Main_Campus_Parent.glb`
only had flat node markers, not real geometry) — instead, every location is a
360° photo ("node") connected to its neighbors, with clickable arrows
("hotspots") that walk you from one photo to the next.

The app is backed by a **self-hosted PHP/MySQL API** (`Arise_API`, a separate
repo — CodeIgniter 3) — not Firebase. Every admin session and every visitor
reads/writes the same live MySQL database over a REST API, authenticated with
bearer tokens rather than cookies or a client-side SDK.

**MainPage (`/`) is genuinely public — no account required.** Only `/admin`
requires a login, and specifically an `admin`-role account. This is a
deliberate design choice, not an oversight: the indoor navigator is meant to
be usable by any walk-up visitor, the same way the Virtual Campus Tour
(`/tour`) already was.

---

## Contents

- [Quick start](#quick-start)
- [Backend setup](#backend-setup)
- [Security & authentication](#security--authentication)
- [Accounts & roles](#accounts--roles)
- [How the data is organized](#how-the-data-is-organized)
- [Admin guide (`/admin`)](#admin-guide-admin)
- [User guide (`/`)](#user-guide-)
- [Data model reference](#data-model-reference)
- [Known limitations / not yet built](#known-limitations--not-yet-built)
- [Brand & design system](BRAND.md)

---

## Quick start

**Install dependencies:**
```powershell
npm install
```

**Run it:**
```powershell
npm run dev
```

Open the printed localhost URL:
- `/` — the public indoor viewer. No login needed.
- `/tour` — the public Virtual Campus Tour. No login needed either.
- `/admin` — the editor, for building and maintaining the campus graph.
  Requires an `admin`-role account.

This frontend talks to `Arise_API` over HTTP — it needs to actually be
running (see that repo's own README) for anything data-related to work at
all. Nothing here talks to Firebase.

---

## Backend setup

This repo is the frontend only. `Arise_API` (a separate repo — PHP,
CodeIgniter 3, MySQL) needs to be set up and running first:

1. **XAMPP** (Apache + MySQL), matching PHP 7.4.
2. **Clone `Arise_API` into `htdocs`**, `composer install` inside it.
3. **Import `schema.sql`** into a fresh `arise_web` MySQL database.
4. **Copy `application/config/database.php.example`** to `database.php`,
   fill in your local MySQL credentials.
5. **Create the two upload folders**:
   - `Arise_API/uploads/` — public Virtual Tour photos, served directly by
     Apache.
   - A `protected-uploads/` folder **one level above `htdocs`**, not inside
     `Arise_API` at all — indoor node/room photos, deliberately kept outside
     anywhere Apache can serve directly. See
     [Security & authentication](#security--authentication) for why this
     matters.
6. **Seed the first admin** — see `Arise_API`'s own `SEED.md`. A fresh
   database has no accounts at all; someone has to become the first admin by
   hand before the Users panel can promote anyone else.

Full details — including the two `.htaccess` files this setup genuinely
needs (one for CORS on the uploads folder, one for Apache to forward the
`Authorization` header, which it silently drops otherwise) — live in
`Arise_API`'s own README/DEPLOY.md.

---

## Security & authentication

**Bearer tokens, not cookies or a client SDK.** Logging in returns a token
(`random_bytes(32)`, hex-encoded) that this app stores in `localStorage` and
attaches as an `Authorization: Bearer <token>` header on every authenticated
request. The server only ever stores a SHA-256 hash of the token, never the
raw value — even a fully exposed database wouldn't hand over anything
directly usable. Tokens expire after 8 hours. Resetting a password
invalidates every existing session for that account, in case the old
password was itself compromised.

**Passwords** are hashed with PHP's `password_hash()` (bcrypt-based) —
never stored, logged, or returned in plaintext anywhere.

**Role-based authorization**, not just "logged in or not" — every sensitive
API endpoint checks for a specific role (`admin`, or `approved` meaning
`user`/`admin`), not merely a valid token.

**File uploads are validated by actual content, not filename.** A file
claiming to be `photo.jpg` gets its real header bytes checked
(`getimagesize()`) before ever being saved — a disguised script fails this
outright. The saved file's extension always comes from that verified content
type, never from whatever the uploader's filename claims, which closes off
a real path to uploading and then executing malicious code on the server.

**Indoor photos are stored genuinely outside the web-servable folder** —
`protected-uploads/`, one level above `htdocs` entirely, not just blocked via
a `.htaccess` rule that has to stay correctly configured. Viewing goes
through a PHP endpoint that streams the bytes back directly; there's no
direct URL to any indoor photo file at all. (Virtual Tour photos are
different — deliberately, fully public, served straight by Apache, since
`/tour` itself has no login boundary to protect in the first place.)

**Directory traversal protection** — every user-supplied filename/path
segment is validated against a strict character allowlist and explicitly
checked against `.`/`..` before ever touching the filesystem, both for
uploads and for the protected-photo streaming endpoint.

**SQL injection protection** — CodeIgniter's query builder parameterizes
queries by default throughout the backend.

**Anti-enumeration on password reset** — the forgot-password endpoint always
returns the same generic response whether or not the email actually belongs
to a real account, so it can't be used to probe which addresses are
registered.

**CORS is scoped to a specific origin**, not a wildcard — configured in
`Arise_API`'s own `MY_Controller.php`.

**Registration is domain-restricted** — only `@sdca.edu.ph` addresses can
register at all, enforced server-side, not just as a client-side check
someone could bypass by calling the API directly.

**A structural note on CSRF**: since this is a bearer-token API rather than
cookie-based sessions, CSRF (a browser automatically attaching credentials to
a cross-site request) is much less of a concern here — a token has to be
explicitly read from `localStorage` and attached by this app's own code,
it's never sent automatically the way a cookie would be.

### Known, still-open security gaps

Worth being upfront about, not glossed over:

- **No rate limiting on login** — nothing currently stops repeated
  password-guessing against a real account.
- **CodeIgniter's own error display** (`db_debug`) can still show raw
  PHP/SQL errors directly in a failure response in some cases, rather than
  logging them privately.
- **No HTTPS** — everything currently runs over plain HTTP, since this is
  still local/dev hosting with no real domain yet. Auth tokens travel in
  request headers, which matters more once this is ever exposed to a real
  network.
- **Local dev config throughout** — CORS origin, database credentials, and
  the API base URL are all still pointing at local values, not production
  ones.

None of this is a reason MainPage's own access model is unsafe specifically
— these are general hosting/hardening gaps that apply regardless of which
pages are public, and matter most once this actually goes live somewhere
beyond a local machine.

---

## Accounts & roles

**`/` (indoor navigator) and `/tour` (Virtual Campus Tour) are genuinely
public — no account needed at all.** Only `/admin` requires signing in, and
specifically the `admin` role. Three roles exist:

| Role | Can do |
|---|---|
| `pending` | Nothing yet — sees an "awaiting approval" screen. Default for every new account. |
| `user` | Nothing beyond what a public visitor can already do — `/` and `/tour` don't require this role at all anymore. Exists mainly as a stepping stone role for anyone waiting on `admin` access. |
| `admin` | The full `/admin` editor, including the Users panel. |

**Registering**: `/register` requires an `@sdca.edu.ph` email — checked
client-side immediately, and enforced again server-side (can't be bypassed by
calling the API directly).

**Getting approved to `admin`**: every new account starts as `pending` and
needs an existing admin to promote them — from `/admin`, click **👤 User
Panel** (shows a badge with the pending count). Each user has a role
dropdown.

**Deleting an account**: the same panel has a **Delete** button per row.
Confirms before deleting; an admin can't delete their own account from here.

**Signing out**: available from the account chip in `/admin`'s toolbar. (The
account chip that used to sit on MainPage's own sidebar is gone now that `/`
doesn't require an account at all — a logged-out visitor simply has nothing
account-related to show there.)

---

## How the data is organized

Everything lives in MySQL (`arise_web` database), accessed through
`Arise_API`'s own REST endpoints — nothing talks to Firestore or any other
document database.

- **Nodes** — `nodes` table, one row per node. `node_neighbors`,
  `node_markers`, and `node_rooms` hold the graph edges, point-of-interest
  markers, and served-room list respectively (each a separate table, not
  nested fields on the node itself).
- **Buildings** — `buildings` table.
- **Tour stops / sections** — `tour_stops`, `tour_sections`,
  `tour_stop_neighbors`, `tour_stop_markers`, `tour_stop_marker_photos` — the
  Virtual Campus Tour's own equivalent structure, kept as its own,
  independent set of tables rather than sharing the node graph, since the
  two diverged enough in practice (tour stops carry photo carousels on
  markers; nodes don't; nodes carry floor/building/leads-to-floor; tour
  stops don't).
  - **Room details** — `placard_dialogs` and `placard_search_terms`, matched
    against AR placard scans.
- **App feedback** — `app_feedback` table, general experience feedback from
  MainPage visitors (see [Admin guide](#admin-guide-admin)).
- **360° photos and room photos** — real files, not database blobs. Public
  Virtual Tour content (`tourpanorama/`, `tourcover/`, `tourmarker/`) lives
  in `Arise_API/uploads/`, served directly by Apache. Indoor content
  (`panoramas/`, `roomphoto/`, `room360/`) lives in `protected-uploads/`,
  outside `htdocs` entirely, served only through an authenticated-or-public
  (depending on the content) PHP endpoint — see
  [Security & authentication](#security--authentication).

Nothing here is real-time the way the old Firestore-backed version was — an
edit made in `/admin` shows up for another open session on the next data
refresh (typically triggered by navigating within the app), not
instantaneously via a live subscription.

**Legacy local files**: `public/nodes.json` and `public/panoramas/*.jpg`,
if still present in the repo, predate even the original Firebase migration
— a point-in-time archive from before this app had any real backend at all.
Not read by the app.

---

## Admin guide (`/admin`)

### Creating and editing nodes

1. Click **+ New node** (or select an existing one from the list to edit it).
2. Fill in:
   - **ID** — auto-filled as soon as you pick Building/Floor/Type (e.g.
     `gd1_f2_hallway01`), and stays editable if you'd rather give it a more
     descriptive suffix. If you change Building/Floor/Type while editing an
     *existing* node, a "Suggested ID — Rename to match?" hint appears
     instead of silently renaming it out from under its neighbor links.
   - **Name** — a human-readable label, e.g. "Hallway near Rm 203".
   - **Building** / **Floor** — pick from the dropdowns. Floors offered are
     specific to the selected building.
   - **Type** — hallway, lobby, entrance, transition (main stairs),
     transition exit (fire stairs), open area (parking), or portal
     (GD2 ↔ GD3 crossing).
   - **Leads to floor** — only shown for transition types.
   - **Building entrance** — only shown for entrance-type nodes. The single
     node representing this one building, offered as a Kiosk floor-screen
     shortcut. Only one per building — saving a second one on the same
     building replaces the first. Independent of Campus entrance below — a
     node can be both, either, or neither.
   - **Campus entrance** — only shown for entrance-type nodes. The single
     node representing this node's whole campus (GD1/GD2/GD3 share one;
     Digital Campus has its own), driving the cross-campus minimap and a
     Kiosk floor-screen shortcut. Only one per campus — saving a second one
     on the same campus replaces the first.
   - **Rooms served** — type a room number/name and hit Enter or click Add.
     A room can only be attached to one node campus-wide.
   - **360° photo filename** / **Choose 360° photo file** — see below.
   - **Neighbors** — managed in **🧭 Test navigation**, not this form.
3. Click **Create node** / **Save changes**. Validation errors show inline
   and block saving until fixed.
4. **Delete** (edit mode only) removes the node and automatically cleans it
   out of every other node's neighbor list.

### Adding a 360° photo to a node

Click **Choose 360° photo file** and pick the image. Unlike the old,
directly-uploads-and-publishes flow, this now goes through a manual privacy
review first:

1. The photo uploads to a temporary, admin-only holding area — not visible
   to anyone until confirmed.
2. A review panel opens where you can click-and-drag directly on the photo
   to mark any face or other sensitive area — each marked region gets
   pixelated. (There's no automatic face detection; marking is entirely
   manual, by design.)
3. **Blur & Publish** (or **Publish**, if nothing was marked) applies the
   blur and moves the photo to its real, permanent location.

The uploaded file is renamed to match the node's own **ID**, converted to
WebP (smaller files at equivalent quality — see the note below), and stored
in the protected, non-public location described in
[Security & authentication](#security--authentication).

**A real, known limitation worth knowing**: uploaded photos convert to WebP
now, not JPEG. This genuinely breaks the *mobile app's* panorama viewer
specifically, since its rendering pipeline decodes photos with a
JPEG-only library — this is safe only because the mobile app is still a
fully separate codebase on its own, older backend. If mobile ever connects
to this same upload pipeline, this needs revisiting first.

**Editing an already-published photo**: click **✏️ Edit blur regions on
this photo** to reopen it for adding or adjusting blur regions, without
needing to re-upload from scratch.

### Linking neighbors & hotspots

- The **Neighbors** picker (in **🧭 Test navigation**, not the node form)
  lists other nodes on the same building + floor (portal nodes always
  shown). Check a node to link it — links are bidirectional.
- Positioning the clickable arrow itself:
  1. Walk into the node you want to position an arrow in.
  2. Use the placement tool to click on the panorama sphere where the arrow
     toward a given neighbor should sit, or leave it unset — unset hotspots
     default to evenly spaced arrows.
  3. Positions save automatically.
- **Renaming a node's ID** automatically updates every other node's neighbor
  list to match.

### Point-of-interest markers (rooms, facilities, exits, hydrants)

Fixed labels that stay put in the panorama rather than navigating anywhere
when clicked — 🚪 Room, 📍 Facility, 🚨 Emergency Exit, 🧯 Fire
Hydrant/Extinguisher.

Placed the same way as hotspots, inside **🧭 Test navigation**:
1. In the sidebar's **Markers** section, click **+ Add marker**, pick a type
   and label.
2. Click **Place on panorama**, click where it should sit.
3. **Reposition**/**Remove** work the same as for links.

### Managing buildings & floors

Three verified buildings by default — GD1, GD2, GD3. Add more via
**+ New building** in the toolbar; a name and floor count is all that's
needed. Custom buildings can be deleted from the same dialog (the original
three can't be); deleting warns first if any nodes currently use it.

### Filtering & finding nodes

The **Filter** panel narrows the node list by Building, Floor, Type, Photo
status, and Search (ID/name/room number).

### Preview tour & navigation testing

- **▶ Preview tour** — a linear walkthrough of every node with Prev/Next.
- **🧭 Test navigation** — click-to-walk testing; also where hotspots and
  markers get positioned, exactly as a visitor would experience them.

### Feedback

**💬 Feedback** — every rating + optional comment (and optional name/email)
submitted through MainPage's own feedback prompt (see
[User guide](#user-guide-)). Unreviewed entries sort first with a
highlighted border and a running count in the heading; **Mark reviewed**
clears that.

### Photo Coverage

**📊 Photo Coverage** — a read-only summary of which nodes and tour stops
still don't have a photo uploaded at all, with the specific missing ones
listed by name/building/floor, not just a bare count.

### Photos

**🖼️ Photos** — every photo uploaded anywhere in the system (node
panoramas, room photos, tour stops, section covers, marker photos), scanned
directly off disk and checked against what's actually referenced in the
database. Each shows **In use** or **Orphaned**; only orphaned files can be
deleted. The backend independently re-checks "is this still in use" at the
moment of deletion, from a fresh database read — not just trusting whatever
this page last displayed, in case something changed in the meantime.

---

## User guide (`/`)

The public page — no login, no account, no editing controls, just the tour.

### Getting around

- Loads straight into a starting entrance's 360° photo.
- **Search** — type a room number or name; results appear below, each with
  a **➜ Directions** option alongside the direct-jump result itself.
  - **On-screen keyboard**: a ⌨️ button next to the search bar reveals an
    in-app keyboard — built specifically for touchscreen kiosk displays,
    where the device's own OS keyboard sometimes doesn't reliably
    auto-appear. It's a manual toggle, not automatic, so it doesn't show up
    redundantly on a phone whose native keyboard already works fine.
- **Building** / **Entrances** — switch buildings, or jump to any listed
  entrance as a new starting point.
- **In the photo** — click and drag to look around, click a glowing arrow to
  walk to the connected location. Marker icons (🚪📍🚨🧯) are informational
  only.
- **← Back** — retraces your steps one node at a time.
- **🧭 Directions** — opens the directions panel starting from wherever you
  currently are; pick a destination to get step-by-step directions.
- **Visited places** — a collapsible strip (bottom-right on desktop) of
  every node visited so far this session, each with a real thumbnail; click
  one to jump straight back. Genuinely session-only — nothing persists past
  a page reload.
- **💬 Give feedback** — bottom-left (desktop) / top bar (mobile) — opens a
  short form: a star rating, an optional comment, and optional name/email.
  Entirely optional and skippable.
- **"Done exploring?" prompt** — after about 15 seconds of no activity, a
  centered, locked prompt offers **Keep exploring** or **Give feedback**.
  Only dismissible via one of those two buttons — clicking outside it does
  nothing, and it's fully suppressed whenever any other panel is already
  open.
- **On a portrait touchscreen display**, the panorama's field of view
  widens automatically compared to a landscape screen, to avoid the
  otherwise-narrower horizontal view a portrait aspect ratio would produce
  from the same fixed camera angle.

### Getting directions to a room

1. Search for a room or place.
2. Click **➜ Directions** next to the result.
3. A **Directions** panel opens with editable **From**/**To** fields.
4. Click **Get directions**.
5. Click **Start walking** or **Walk to `<next stop>` →** to advance one
   step at a time — the matching arrow also glows green.
6. Progress tracks ("Stop 2 of 5") with an arrival message at the end. Going
   off-route recalculates automatically from wherever you ended up.
7. **✕** cancels guidance at any time.

---

## Data model reference

Matches `nodes` plus its related tables in `Arise_API`'s `schema.sql`
directly — this is the shape the frontend actually works with after
`useNodes.js` translates the backend's snake_case rows into this:

```js
{
  id: "gd1_f2_hallway01",
  name: "GD1 2ndFloor Hallway3",
  building: "gd1",                   // gd1 | gd2 | gd3 | any admin-created building id
  floor: 2,                          // -1 = UG, 1 = Ground, 2, 3, ...
  type: "hallway",
  leadsToFloor: null,                // set only for transition / transitionExit types
  photo: "panoramas/gd1/gd1_f2_hallway01.webp",  // a path, not a public URL — resolved through
                                                   // the protected-photo endpoint at view time
  rooms: ["203", "204"],
  neighbors: ["gd1_f2_hallway02"],
  hotspots: {
    "gd1_f2_hallway02": { yaw: 45, pitch: -10 }
  },
  markers: [
    { id: 123, type: "room", label: "Room 203", yaw: 12, pitch: -5 }
  ],
  createdAt, updatedAt
}
```

Custom buildings: `{ id, label, floors }`, from the `buildings` table.

---

## Known limitations / not yet built

- **Directions are shortest-hop, not shortest-distance** — the route finder
  counts number of connections, not physical distance.
- **No step-by-step turn instructions** — directions guide node-by-node with
  a highlighted arrow, not compass-style text.
- **Orphan/unlinked-node validation** is limited to a lightweight "unlinked"
  tag, not a full connectivity check.
- **Room-level destinations** route to the *node* serving a room, not a
  precise in-room point.
- **Email isn't actually delivering yet** — registration and password reset
  correctly queue an email, but SMTP credentials are still placeholder
  values, pending a decision on using SendGrid vs. the institution's own
  mail server.
- **The mobile app is a fully separate codebase**, still on its original
  Firebase backend — none of the MySQL/`Arise_API` work described in this
  README applies to it yet. See [Security & authentication](#security--authentication)
  for the specific WebP/JPEG compatibility issue that would need resolving
  before mobile could connect to this same photo pipeline.
- See [Known, still-open security gaps](#known-still-open-security-gaps)
  above for what's outstanding before this could reasonably go live to real
  users on a real domain.