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
requires a login, and only admins have accounts: there are no other kinds of
account. This is a
deliberate design choice, not an oversight: the indoor navigator is meant to
be usable by any walk-up visitor.

---

## Contents

- [Quick start](#quick-start)
- [Backend setup](#backend-setup)
- [Security & authentication](#security--authentication)
- [Accounts](#accounts)
- [How the data is organized](#how-the-data-is-organized)
- [Admin guide (`/admin`)](#admin-guide-admin)
- [User guide (`/`)](#user-guide-)
- [Data model reference](#data-model-reference)
- [Known limitations / not yet built](#known-limitations--not-yet-built)
- [Third-party assets](#third-party-assets)
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
- `/admin` — the editor, for building and maintaining the campus graph.
  Requires an admin account.

This frontend talks to `Arise_API` over HTTP — it needs to actually be
running (see [Backend setup](#backend-setup)) for anything data-related to work at
all. Nothing here talks to Firebase.

---

## Backend setup

This repo is the frontend only. `Arise_API` (a separate repo — PHP,
CodeIgniter 3, MySQL) needs to be set up and running first:

1. **XAMPP** (Apache + MySQL), with PHP 7.4 or newer (CodeIgniter 3.1.13
   supports up to PHP 8.1).
2. **Clone `Arise_API` into `htdocs`**, `composer install` inside it.
3. **Import `schema.sql`** into a fresh `arise_web` MySQL database.
4. **Copy `.env.example` to `.env`** and fill in your local MySQL
   credentials. There is no `database.php.example`: `database.php` reads
   its values from `.env`.
5. **Upload folders**:
   - `Arise_API/uploads/` — public kiosk advertisement media, served
     directly by Apache.
   - `protected-uploads/` — indoor node/room photos, deliberately kept
     outside anywhere Apache can serve directly. With `PROTECTED_UPLOAD_ROOT`
     blank in `.env` it defaults to two directories above `Arise_API`'s
     `index.php`, which on XAMPP is `C:/xampp/protected-uploads/`, outside
     `htdocs`. See [Security & authentication](#security--authentication)
     for why this matters.
6. **Seed the first admin** — see `Arise_API`'s own `SEED.md`. A fresh
   database has no accounts at all, and nobody can approve a registration yet, so
   the first admin is created from the command line (`php index.php
   Admins_CLI create` in `Arise_API`); after that, admins add each other from
   the User Panel and approve registrations there.

Full details — including the two `.htaccess` files this setup genuinely
needs (one for CORS on the uploads folder, one for Apache to forward the
`Authorization` header, which it silently drops otherwise) — live in
`Arise_API`'s own `DEPLOY.md` and `PRODUCTION.md` (the API repo has no
README.md; `readme.rst` is CodeIgniter's own).

---

## Security & authentication

**Bearer tokens, not cookies or a client SDK.** Logging in returns a token
(`random_bytes(32)`, hex-encoded) that this app stores in `localStorage` and
attaches as an `Authorization: Bearer <token>` header on every authenticated
request. The server only ever stores a SHA-256 hash of the token, never the
raw value — even a fully exposed database wouldn't hand over anything
directly usable. Tokens expire after 8 hours. Resetting a password
for an admin invalidates every existing session for that account, in case the
old password was itself compromised.

**Passwords** are hashed with PHP's `password_hash()` (bcrypt-based) —
never stored, logged, or returned in plaintext anywhere.

**Admin-only writes** — every sensitive API endpoint requires a valid admin
token. Only admins can sign in, so a valid token is the whole check.

**File uploads are validated by actual content, not filename.** A file
claiming to be `photo.jpg` gets its real header bytes checked
(`getimagesize()`) before ever being saved — a disguised script fails this
outright. The saved file's extension always comes from that verified content
type, never from whatever the uploader's filename claims, which closes off
a real path to uploading and then executing malicious code on the server.

**Indoor photos are stored genuinely outside the web-servable folder** —
`protected-uploads/`, outside `htdocs` entirely by default, not just blocked
via a `.htaccess` rule that has to stay correctly configured. Viewing goes
through a PHP endpoint (`IndoorUploads_API/serve`) that streams the bytes
back directly; there's no direct URL to any indoor photo file at all. That
endpoint deliberately does **not** check who is asking, because `/` is
public: anyone who knows a photo path can fetch it, including a blur-review
upload that hasn't been published yet. Only uploading is admin-only.
(Kiosk advertisement media is different: fully public, served straight
by Apache.)

**Directory traversal protection** — every user-supplied filename/path
segment is validated against a strict character allowlist and explicitly
checked against `.`/`..` before ever touching the filesystem, both for
uploads and for the protected-photo streaming endpoint.

**SQL injection protection** — CodeIgniter's query builder parameterizes
queries by default throughout the backend.

**Anti-enumeration on login** — a wrong email and a wrong password get the
same error, so login can't be used to probe which addresses have accounts.

**CORS is scoped to specific origins**, not a wildcard — read from
`CORS_ORIGIN` in `Arise_API`'s `.env` (a comma-separated list is allowed) by
`MY_Controller.php`. (The public signage media in `uploads/` allows any
origin, via that folder's own `.htaccess`.)

**Accounts are domain-restricted** — only `@sdca.edu.ph` addresses can be
given an admin account, enforced server-side when an admin creates one.

**A structural note on CSRF**: since this is a bearer-token API rather than
cookie-based sessions, CSRF (a browser automatically attaching credentials to
a cross-site request) is much less of a concern here — a token has to be
explicitly read from `localStorage` and attached by this app's own code,
it's never sent automatically the way a cookie would be.

### Rate limits and abuse protection

The public endpoints (the ones a visitor or a script can call without an
account) are the ones guarded. All limits live in `Arise_API`'s
`application/libraries/Rate_limit.php`, enforced by
`MY_Controller::enforceRateLimit()`, and are counted in the `rate_limit_hits`
table. Subjects (IP, email, visitor id, session id) are stored only as
SHA-256 hashes. A refused request gets HTTP 429 with a `retry_after` (seconds)
the form shows as its error. Every check is server-side: the client's hidden
field and visitor id only make the checks accurate, they are not the defence.

| Endpoint | Current measures |
| --- | --- |
| `Auth_API/login` | Failed attempts only are counted, per IP and per email: 10 failures in 15 minutes locks that IP, or that email, out for the rest of the window. The check runs before the password is looked at, so a correct guess during a lockout still gets a 429. Same generic error for a wrong email and a wrong password. Both limits are the same size on purpose, so a stranger cannot lock a real admin out faster than they could guess. |
| `Feedback_API/submit` | Honeypot field `hp_contact_url` (hidden off-screen in `FeedbackPanel.jsx`): a filled one gets a normal-looking success and nothing is stored. One submission per visitor every 30 seconds, keyed on the browser's `visitor_id` (a UUID in localStorage), or the IP when none was sent. A loose backstop of 30 submissions per IP per 10 minutes for a script that rotates visitor ids. Only a submission that passes validation counts toward the limits. |
| `Analytics_API/track` | Per IP: 600 requests per minute (wide, since every kiosk and phone on campus shares addresses). Per session: 30 requests per minute (a real session sends about four). The IP check runs before any parsing. Unchanged: UUID session id required, 50 events per batch, event shapes and string lengths whitelisted, platform decided by the server from the kiosk token. |
| `Kiosks_API/pair` | Unchanged: 5 wrong codes per IP in 10 minutes locks pairing out (`kiosk_pair_failures`). Codes are 8 digits, single use, expire after 30 minutes, and only their hash is stored. The same error for a wrong and an expired code. |
| `Auth_API/register` | Counted per IP, every request: 5 per hour. A new account is `pending` and cannot sign in until an admin approves it. |
| `Auth_API/forgotPassword` | Counted per IP (10 per hour) and per email (3 per hour), so neither one inbox nor many can be flooded. Always answers success, so it cannot be used to find which emails have accounts. The reset link is single use and expires after 1 hour. |

The hit log is purged by `php index.php Cron_API purgeExpired`, the same
scheduled task that purges expired login tokens; rows older than a day are
never read by any limit.

### Known, still-open security gaps

Worth being upfront about, not glossed over:

- **No captcha anywhere.** Deliberately left out for now: it needs a real
  domain and outbound internet from the kiosks. The honeypot and rate limits
  stand in for it. If feedback spam gets past them, add an invisible captcha
  that is only shown after the honeypot or limits look suspicious.
- **Public read endpoints and admin writes have no request cap.** Only the
  four public actions in the table above are limited.
- **Login lockout can be triggered by a stranger.** Ten bad guesses at an
  admin's email lock that email out for up to 15 minutes. The alternative,
  no per-email limit, leaves a slow distributed guess open.
- **CodeIgniter's own error display** (`db_debug`) is on whenever `CI_ENV`
  isn't `production`, and then shows raw PHP/SQL errors directly in a
  failure response. Set `CI_ENV=production` on any real server. Even then
  `log_threshold` is `0`, so errors aren't logged privately either.
- **`IndoorUploads_API/serve` is public** (see above).
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

## Accounts

**`/` (the indoor navigator) is genuinely public — no account needed at
all.** Only `/admin` requires signing in. Only
admins have accounts, with no other role. Anyone with an `@sdca.edu.ph` email
can register at `/register`, but that account is **pending**: it cannot sign
in until an admin approves it in the User Panel. The system sends email
(registration, approval, password reset) through CodeIgniter's email library;
see `Arise_API`'s `.env.example` for PHP `mail()` versus SMTP.

**The first admin**: a fresh database has none, so it is created on the server
with `php index.php Admins_CLI create` (see `Arise_API`'s `SEED.md`). The same
tool, `Admins_CLI setPassword`, is the way back in if every admin has lost
their password.

**Adding admins**: from `/admin`, open **User Panel** and use **+ New Account**
(name, `@sdca.edu.ph` email, password of at least 8 characters). The new admin
can sign in immediately at `/login`.

**Approving a registration**: a self-registered account shows a **Pending** tag
in **User Panel**. **Approve** lets it sign in and emails its owner; **Reject**
deletes the request.

**A lost password**: the sign-in page's **Forgot password?** emails a reset link
(valid 1 hour, single use) to an approved account. Using it signs that admin out
everywhere. If email is not delivering, `Admins_CLI setPassword` sets one from
the server's command line. With PHP `mail()` the message often lands in spam.

**Deleting an account**: the same panel has a **Delete** button per approved row.
Confirms before deleting; an admin can't delete their own account from here, so
at least one admin always remains.

**Signing out**: a signed-in admin on `/` gets an account button (top right
of the panorama on the desktop layout) whose popover has **Sign out** and an
**Admin Panel** link; a visitor who isn't signed in sees no account button at
all. `/admin` has its own account chip in its toolbar.

---

## How the data is organized

Everything lives in MySQL (`arise_web` database), accessed through
`Arise_API`'s own REST endpoints — nothing talks to Firestore or any other
document database.

- **Nodes** — `nodes` table, one row per node. `node_neighbors`,
  `node_markers`, and `node_rooms` hold the graph edges, point-of-interest
  markers, and served-room list respectively (each a separate table, not
  nested fields on the node itself).
- **Elevators** — `elevators` table (see "Point-of-interest markers").
- **Buildings** — `buildings` table.
- **Accounts** — `admins` (email, name, password hash, `status` of `pending` or
  `approved`), `auth_tokens` (hashed login tokens) and `password_resets` (hashed
  reset tokens). Nothing else: no visitor accounts, and no email queue; mail is
  sent straight from the request.
- **Kiosks** — `kiosks` (one row per registered kiosk device and the node
  it stands at; only hashes of its pairing code and token are stored) and
  `kiosk_pair_failures` (rate limit on wrong pairing codes).
- **Rate limits** — `rate_limit_hits` (bucket, hashed subject, time), the
  log behind the limits on login, feedback and analytics (see "Rate limits
  and abuse protection").
- **Analytics** — `analytics_sessions` and `analytics_events`: one row per
  visitor session (`kiosk` only when it comes from a paired kiosk, `web`
  for everything else) and one per tracked action.
  - **Room details** — `placard_dialogs` and `placard_search_terms`, matched
    against AR placard scans.
- **App feedback** — `app_feedback` table, general experience feedback from
  MainPage visitors (see [Admin guide](#admin-guide-admin)).
- **360° photos and room photos** — real files, not database blobs. Indoor
  content (`panoramas/`, `roomphoto/`, `room360/`) lives in
  `protected-uploads/`,
  outside `htdocs` entirely by default, served only through the
  `IndoorUploads_API/serve` PHP endpoint, which doesn't check who is asking
  — see [Security & authentication](#security--authentication).
- **Kiosk advertisements (signage)**: `signage_slides` (one row per
  advertisement: its file, crop, time on screen, rotation position, on/off
  and optional run dates) and `signage_settings` (one row: rotation order,
  transition, default time on screen). The files themselves (images, GIFs,
  MP4/WebM videos) live in `Arise_API/uploads/signage/`, served directly by
  Apache. Named "signage" in every table, file path, endpoint and CSS
  class, never "ads": ad blockers hide or refuse requests and elements that
  look like advertisements. (The admin page's own route,
  `/admin/advertisements`, is exempt: it's in-app navigation, not a request.)

Nothing here is real-time the way the old Firestore-backed version was — an
edit made in `/admin` shows up for another open session on the next data
refresh (typically triggered by navigating within the app), not
instantaneously via a live subscription.

**Legacy local files**: `public/nodes.json` and `public/panoramas/*.jpg`
predate even the original Firebase migration, and are no longer in the repo.
Nothing reads them.

---

## Admin guide (`/admin`)

### Creating and editing nodes

Under **Virtual Map → Node Editor**:

1. Click **+ New Node** (or select an existing one from the list to edit it).
2. Fill in:
   - **ID** — auto-filled as soon as you pick Building/Floor/Type (e.g.
     `gd1_f2_hallway01`), and stays editable if you'd rather give it a more
     descriptive suffix. If you change Building/Floor/Type while editing an
     *existing* node, a "Suggested ID — Rename to match?" hint appears
     instead of silently renaming it out from under its neighbor links.
   - **Name** — a human-readable label, e.g. "Hallway near Rm 203".
   - **Building** / **Floor** — pick from the dropdowns. Floors offered are
     specific to the selected building.
   - **Type**: Hallway, Lobby, Entrance, Stairs, Open Area or Parking. There
     is no Fire Exit type: a node that holds a fire stairwell door keeps its
     real type (often a Hallway) and carries an **Emergency Exit marker**
     instead (see "Point-of-interest markers").
   - **Floors reached**: shown for Stairs, read-only: the floors the node's
     own neighbor links reach (managed in Navigation Editor), so
     there is no second list to keep in step with them.
   - **Emergency Exit Destination Point**: shown for Open Area, Parking,
     Lobby and Entrance, and for any node carrying an Emergency Exit marker
     (a fire door that leads outside). Tick it only if someone who reaches this
     node is out of danger: Nearest Exit ends its route at ticked nodes, and
     nothing is automatic (an unticked Open Area is not a destination). Only
     Floor 1 and Underground nodes can be ticked, and the checkbox is
     disabled above that. Lobby and Entrance get a red warning, because they
     can be indoor spaces or open into one, and the system cannot tell. Tick
     only ground-floor ones that are truly safe, never one per floor. A
     building with nothing ticked gets no Nearest Exit route.
   - **Starting node for this floor** — where the kiosk drops visitors who
     pick this building floor. Only one per floor — saving a second one on
     the same floor replaces the first. Its camera view is set in Virtual
     Map Navigation Editor ("Set starting view").
   - **Building entrance** — only shown for entrance-type nodes. The single
     node representing this one building, offered as a Kiosk floor-screen
     shortcut. Only one per building — saving a second one on the same
     building replaces the first. Independent of Campus entrance below — a
     node can be both, either, or neither.
   - **Campus entrance** — only shown for entrance-type nodes. The single
     node representing this node's whole campus (GD1/GD2/GD3 share one;
     Digital Campus has its own), driving the cross-campus minimap and a
     Kiosk floor-screen shortcut. Only one per campus — saving a second one
     on the same campus replaces the first. The API applies this to GD1/GD2/GD3
     plus any buildings grouped under one campus in the Building dialog.
   - **Rooms served** — type a room number/name and hit Enter or click Add.
     A room can only be attached to one node campus-wide (checked by this
     form, not by the API).
   - **360° photo path** / **Choose 360° photo file** — see below.
   - **Neighbors** — managed in **Navigation Editor**, not this
     form.
3. Click **Create node** / **Save changes**. Validation errors show inline
   and block saving until fixed.
4. **Delete** (edit mode only) removes the node and automatically cleans it
   out of every other node's neighbor list.

### Adding a 360° photo to a node

Click **Choose 360° photo file** and pick the image. It goes through a
manual privacy review before it is published:

1. The photo uploads to a temporary holding area (`panoramas-review/`) that
   isn't linked to the node until confirmed. Uploading is admin-only, but
   the holding area is not access-controlled for viewing (see
   [Security & authentication](#security--authentication)).
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

**Worth knowing**: uploaded photos convert to WebP, not JPEG. The *mobile
app's* panorama viewer decodes only JPEG, so `IndoorUploads_API/serve`
can return a downscaled JPEG copy on request (`&format=jpeg`, optionally
`&width=`), cached on the server. The web app asks for it only for the Node Flowchart's
small thumbnails and otherwise gets the original.

**Editing an already-published photo**: click **Edit blur regions on
this photo** to reopen it for adding or adjusting blur regions, without
needing to re-upload from scratch.

### Linking neighbors & hotspots

- In **Navigation Editor** (not the node form), the **Links**
  box has **+ Add Links**, a search of other nodes by name or ID. Pick one to
  link it and then click on the panorama where its arrow should sit — links
  are bidirectional. The **Links added** list beside it has **Reposition**,
  **Override/Change default view**, **Back to automatic** and **Remove** per link.
- Positioning the clickable arrow itself:
  1. Select the node you want to position an arrow in.
  2. Add or **Reposition** a link, and click on the panorama sphere where
     the arrow toward that neighbor should sit. A link that was never
     positioned defaults to evenly spaced arrows.
  3. Every link already has an **automatic default view**: a visitor lands
     facing away from the arrival photo's own arrow back to where they came
     from. Optionally **Override** it with a manual default view (the camera
     direction a visitor lands facing through that particular link); **Back
     to automatic** removes the override. See `docs/arrival-view.md`.
- **Renaming a node's ID** automatically updates every other node's neighbor
  list to match.

### Point-of-interest markers (rooms, facilities, emergency exits, fire extinguishers, elevators)

Fixed labels that stay put in the panorama: Room, Facility, Emergency Exit,
Fire Extinguisher. Clicking a Room marker opens that room's panel
(it shows "No information." if the label matches no room details); the
Fire Extinguisher marker is purely informational: nothing happens when a
visitor clicks it. The **Emergency Exit** marker is informational too,
except while it is the next step of a Nearest Exit route (see below).

**Emergency Exit** is what makes a node a *fire exit node*. Place one where
a fire stairwell door is in the photo. It lists its **landings**: the nodes
on other floors of the same building where the hidden stairs behind that
door come out (stored in the `node_marker_landings` table, one directed row
per landing; the API returns them on the marker as `landings`, lowest floor
first). The node keeps its own type, so a hallway stays a hallway and is
walked through by ordinary directions; only Nearest Exit uses the
landings. A marker with no landings is a fire door that leads straight
outside, and its node is ticked as an Emergency Exit Destination Point.
Managed from **Navigation Editor**: pick marker type Emergency
Exit, tick the landings (the lowest is used first, the rest are the way
round a blocked one), then **Place on panorama**. **Edit landings** changes
them later. **Emergency Coverage** reports a landing that is missing, in
another building or on the same floor, a marker that leads nowhere, and a
fire exit node that also has an ordinary link to another floor.

**Elevator** is the one marker that navigates, and it differs in a second
way too. First, clicking one in the public viewer actually rides the
visitor to another floor (straight there when it only serves one other
floor, or a small floor picker otherwise).
Second, its data isn't stored on the marker at all. An elevator is its own
record (an `elevators` table: an **Elevator ID**, a **Label**, a
**Building**, and the **Accessible floors** it actually stops at — real
elevators skip restricted floors). A landing marker just points at one of
these records by id; the label and floor list a landing shows are always
read live from that one record, so two landings of the same elevator can
never disagree about which floors it serves. See "Getting directions"
below for how this feeds into stairs-vs-elevator routing.

Managed from **Navigation Editor**, in two steps:
1. **Create the elevator once** — in the **Markers** box (**+ Add Markers**),
   picking marker type Elevator offers "+ New elevator…", which asks for
   an Elevator ID, a Label, and every floor it serves. This creates the
   `elevators` record, scoped to whichever building the current node is
   in — a landing can only be added to a node in that same building.
2. **Add a landing per floor** — for each floor the elevator serves, select
   that same elevator from the dropdown (now offered instead of "+ New
   elevator…") on a node on that floor, click **Place on panorama**, and
   click where the doors should sit. Each elevator allows at most one
   landing per floor; adding a floor to what it serves, or removing one
   that still has a landing, is done from the **Elevators in this
   building** list (rejected with the offending node named if a floor with
   a landing is dropped) rather than from the marker itself.
3. **Reposition**/**Remove** on a landing marker work the same as any other
   marker; **Delete** on the elevator itself (from that same list) removes
   every one of its landings too.

### Managing buildings & floors

Three built-in buildings — GD1, GD2, GD3. Add more via **+ New Building**
in the Node Editor toolbar: a name and floor count are required, and you can
also join an existing campus (otherwise the building is its own campus) and
click a map location (used for the cross-campus Flyover). The same dialog's
**Existing Building/s** list lets you **Edit** a building's name, floors and
campus, **Move nodes** from one building to another, and delete custom
buildings (the built-in three can't be deleted); deleting warns first if any
nodes currently use it.

### Filtering & finding nodes

The **Search and Filter** panel narrows the node list by Building, Floor,
Type, Photo status (all, missing, or has a photo filename), and a search
(ID/name/room number).

### Node preview & the other Virtual Map pages

- **Node Preview** (Node Editor toolbar) — a linear walkthrough of every
  node with Prev/Next.
- **Navigation Editor** — click-to-walk through the graph as a
  visitor would; also where links (hotspots), markers, elevators, default
  views and each node's starting view get positioned.
- **Node Flowchart** — the node graph for a building and floor drawn as a
  draggable flowchart; dragging a node saves its position.
- **Room and Facility Editor** — each room's and facility's details
  (description, contact number, link, photos, 360° view), shown on the room
  panel and used by search. A facility is a Facility marker; it is renamed
  here (which relabels the marker) but placed and moved in Virtual Map
  Navigation Editor.
### Analytics

**Analytics** — session and behavior tracking for `/`: sessions over time,
the session funnel, building heatmap, top destinations and searches, most
common routes, walk vs. jump, rating distribution and when people visit,
filterable by date range, platform and building. Only sessions from a
**paired kiosk** count as kiosk sessions; every other session, even one
showing the Compact layout, is a web session. Its **Comments** section is
where feedback (rating + optional comment, and optional name/email, from
the feedback prompt on `/`) is reviewed: unreviewed entries sort first with
a highlighted border and a running count; **Mark reviewed** clears that,
and **Mark unreviewed** puts a row back in the count. The **Status** filter
narrows the list to All, Unreviewed or Reviewed; the "N new" badge always
counts the unreviewed rows in the current range, whatever Status is set to.

### Kiosks

**Kiosks** (`/admin/kiosks`) — the physical kiosk devices. **Add** one with
a name and the map node it stands at; the page shows a one-time pairing
code (8 digits, valid 30 minutes). On the device, tap the logo five times,
then the node name five times, then the bottom band five times, and type the
code on the pairing screen. A paired device is recognised from then on (its
token is kept on the device, only a hash on the server). **Unpair** revokes
it and issues a new code; wrong codes are rate-limited per IP. Only a
paired kiosk's sessions count as kiosk sessions in Analytics, and only a
paired kiosk offers a "Kiosk Location" starting point.

### Emergency Coverage

Under Virtual Map. Runs the same routing as Nearest Exit from every node and
lists what a visitor standing there would get: nodes with no route to a
destination point, nodes whose only route rises above Floor 1, buildings with
no destination point at all, ticked Lobby and Entrance nodes to confirm are
really safe, and ticks that are ignored because of the node's type or floor.
It also lists every destination point and previews the route from any node. Check it after any change to
node types, floors or links.

### Photo Coverage

**Photo Coverage** — a read-only summary of which nodes still don't have a
photo uploaded at all, with the specific missing ones listed by
name/building/floor, not just a bare count.

### Photos (on the Photo Coverage page)

The **Photos** list lower on the same page — every photo uploaded anywhere
in the system (node panoramas, room photos, marker photos, advertisement
media), scanned
directly off disk and checked against what's actually referenced in the
database. Each shows **In use** or **Orphaned**; only orphaned files can be
deleted. The backend independently re-checks "is this still in use" at the
moment of deletion, from a fresh database read — not just trusting whatever
this page last displayed, in case something changed in the meantime.

### Advertisements

**Advertisements** (megaphone icon, `/admin/advertisements`): what plays in the
white band along the bottom of the kiosk screen, below the panorama. That
band is 1080 x 336 px on the 1080 x 1920 kiosk; with nothing live it stays
plain white, as before.

- **Add advertisement** opens a dialog: drop in (or choose) a JPG, PNG, GIF,
  WebP, MP4 or WebM file, up to 100 MB (the server's own
  `upload_max_filesize` is the real limit). Videos play muted and loop.
- **Crop**: a box with the band's exact shape sits over the file, and
  everything outside it is dimmed. Drag the box to move it and drag a
  corner to zoom; **Zoom in / Zoom out / Fit to band** and the keyboard
  (arrow keys, + and -) do the same. A live preview shows the band and the
  whole kiosk screen. A warning appears if the visible part is narrower than
  1080 px, since it would look soft on the kiosk.
- **Details**: a name (admins only), **time on screen** (3 to 600 seconds,
  to a tenth of a second, e.g. 7.5; a video defaults to its own length
  rounded up to the next tenth), an optional **schedule** (starts /
  ends; blank means "now" and "until switched off") and an **on/off**
  switch.
- The file is uploaded only on save, so cancelling leaves nothing behind.
  Deleting an advertisement, or replacing its file, deletes the old file
  too (unless something else still uses it).
- **Rotation settings**: play in list order (reorder with the arrows on
  each row) or shuffled (never the same advertisement twice in a row),
  crossfade or instant switching, and the default time on screen for new
  images. A single live advertisement just stays up.
- Each row shows **Live**, **Scheduled**, **Ended** or **Off**, judged on
  the server's clock. **Playing on the kiosk now** previews the real
  rotation. Kiosks re-read the list every five minutes, and on every new
  Kiosk session.

---

## User guide (`/`)

The public page: no login needed, no editing controls, just the tour. A
signed-in admin just additionally gets an account button (see
[Accounts](#accounts)).

It has two layouts of the same app. The **desktop layout** (a sidebar beside
the panorama) is shown on a normal landscape screen. The **Compact layout**
(a stacked, touch-first layout with a radial menu and on-screen keyboard)
is shown on any narrow screen and on any portrait screen taller than 1.3×
its width, which is also what the portrait kiosk screens get.

### Getting around (desktop layout)

- Loads straight into a starting entrance's 360° photo, with two short
  walkthroughs on first load (how to look around and move, then what the
  sidebar does). The **How to use this tour** button (bottom right) replays
  them.
- **Search** (top of the sidebar) — type a room number or name; results
  appear below, each with **Go To** and **Directions** buttons. The icon
  beside the search box opens **Directions** directly.
- **Directory** (sidebar, when nothing else is open) — an accordion of
  every room by building; picking a room opens its panel. Rooms saved with
  the panel's save button are collected in a **Saved Directories** group.
- **Room panel** — the room's description, photos, contact number and link,
  with **Go To**, **Directions**, and a save button. Saved rooms live only in
  that browser's localStorage, by room name: no account, nothing sent to the
  API, and renaming a room or facility in the Room and Facility Editor drops it from the saved list.
- **In the photo** — click and drag to look around, scroll to zoom, click a
  glowing arrow to walk to the connected location. The keyboard works too:
  A/D or the arrow keys turn, W walks to the nearest arrow on screen, S goes
  back, Shift zooms in and Control zooms out. Click a Room marker to open
  that room's panel; Elevator markers ride to another floor; the other
  marker types are informational.
- **Back** — retraces your steps one node at a time.
- **Nearest Exit** (bottom right) — one tap routes you by stairs to the
  Emergency Exit Destination Point and starts walking. See "Getting
  directions".
- **Give feedback** (bottom right) — a short form: a star rating, an
  optional comment, and optional name/email. Entirely optional and
  skippable.
- **"Done exploring?" prompt** — after about 60 seconds with no activity, a
  centered, locked prompt offers **Keep exploring** or **Give feedback**.
  Only dismissible via one of those two buttons — clicking outside it does
  nothing, and it's suppressed whenever any other panel is already open.
  On the Compact layout it also offers **Start over** and restarts on its
  own after a countdown.

### Compact layout and the Kiosk session

On the Compact layout a visitor first goes through a **Kiosk session**: a
start screen ("Tap to Start"), then a campus screen, then (for a campus with
more than one building) a building screen, then a floor screen, then
exploring. Search, directions, feedback, Nearest Exit and help are on the
radial menu; the on-screen keyboard appears in dialogs with text fields
(built for touchscreen kiosks where the device's own keyboard doesn't
reliably appear). The session ends, and the view resets for the next
visitor, when feedback is finished or on "Start over". The white band
under the panorama plays the live advertisements (see Advertisements
above). On a **paired kiosk** the origin choice for directions also offers
"Kiosk Location".

On a portrait touchscreen the panorama's field of view widens automatically
compared to a landscape screen, to avoid the otherwise-narrower horizontal
view a portrait aspect ratio would produce from the same camera angle.

### Getting directions to a room

1. Search for a room or place (or open the **Directions** icon and type).
2. Click **Directions** next to the result.
3. A **Directions** panel opens with editable **From**/**To** fields.
4. Click **Get directions**. If the destination is on a different floor
   AND both a stairs-only and an elevator-only route exist (and actually
   differ), the panel asks **Take the stairs** or **Take the elevator**
   (the elevator is labeled "step-free") — each labeled with its stop
   count — before computing the route. When only one of the two is
   possible, there's nothing to ask and the route starts right away.
5. The walk starts in one go: you jump to the route's first stop (with
   **Start walking** shown first if you aren't standing on it). Then
   **Walk to `<next stop>`** (an elevator step instead reads **Take the
   elevator** to `<floor>`) advances one step at a time, with a turn
   instruction such as "Turn left toward" past the first stop. **Auto-walk**
   advances by itself every few seconds. A stairs step glows the matching
   arrow green; an elevator step instead glows the elevator's own landing
   marker — tap either it or the button.
6. Progress tracks ("Stop 2 of 5") with an arrival message at the end. Going
   off-route recalculates automatically from wherever you ended up — an
   elevator-mode route only re-routes through another elevator connection,
   never silently falling back to stairs, since the elevator may have been
   the whole point of picking that mode.
7. The close button cancels guidance at any time.

**Fire stairs are emergency-only.** A node carrying an **Emergency Exit
marker** (a fire exit node) is an ordinary node for everyday directions, usually a
hallway, and is walked through like any other. What is emergency-only is the
hidden fire stairs behind the marker's door: the marker lists the nodes
those stairs come out at (its **landings**), and only **Nearest Exit** ever
takes them. Ordinary directions walk neighbor links, and a landing is not
one. The one route that uses them is **Nearest Exit**, which works like this:

- **Destination.** The nearest Emergency Exit Destination Point: an Open
  Area, Parking, Lobby or Entrance node, or a node with an Emergency Exit
  marker (a fire door to the street), on Floor 1 or Underground that an admin
  ticked. Nothing is automatic and no type is trusted by itself (an Entrance
  or Lobby may be indoors). A building with nothing ticked has no destination
  and gets the no-route message with the emergency numbers. A visitor already
  standing on a ticked node is told they have arrived at once.
- **Never an elevator.** Only neighbor links and the markers' landings are
  walked. Stairs are passed through freely.
- **Fire stairs first, within reason.** The hidden fire stairs are protected,
  so a route favors them over an ordinary flight of Stairs by
  `FIRE_STAIRS_PREFERENCE` extra hops (3, in `src/utils/constants.js`). A
  fire exit a few hops further away than an ordinary staircase still wins; one
  much further loses to it, with no special rule needed. A marker lists every
  floor its stairwell reaches: the lowest landing is taken first, and the
  others are the way round when "This way is blocked" is reported. The visitor
  is told "Emergency Exit stairs ahead" (banner, glowing marker and spoken
  line) because the door is a marker in the photo, not an arrow.
- **Down before up.** A route may not rise above its ceiling: the higher of
  the visitor's own floor and Floor 1, which is the ground floor in every
  building. So a visitor on floor 1 is never sent up and over, while someone
  on an underground level does climb to Floor 1, because that is the way
  out. Only when no route within the ceiling exists
  is going higher allowed, and the panel then warns "This route goes up."
- **Hop-based.** Distance is a count of links plus a cost for changing floor
  (a little down, a lot up), not meters.
- **This way is blocked.** A button on the walking panel (and the Kiosk walk
  bar) drops the next stop and re-routes from where the visitor stands, and
  again as often as needed. With every way blocked, or no route at all, the
  panel says so and shows the Bacoor City emergency numbers.
- **Going off the route** re-aims at whichever exit is nearest from the new
  spot, not the old one.

The emergency numbers are listed in `EMERGENCY_CONTACTS` in
`src/utils/constants.js`.

**How stairs vs. elevator routing actually works, and its real limit**: the
node graph has no per-edge "this is a stairs connection" flag — an edge is
just two linked node ids. So "stairs mode" excludes only floor-changing
edges through a Stairs-type node, and "elevator mode" additionally adds
elevator connections (derived from the `elevators` table's landings, not
manually drawn edges — see "Point-of-interest markers" above). A
floor-changing edge an admin drew between two plain nodes without using
the Stairs type won't be correctly excluded from elevator mode — this only
works as well as that node-type convention is followed when authoring the
graph.

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
  photo: "panoramas/gd1/gd1_f2_hallway01.webp",  // a path, not a public URL — resolved through
                                                   // the protected-photo endpoint at view time
  rooms: ["203", "204"],
  neighbors: ["gd1_f2_hallway02"],
  hotspots: {
    "gd1_f2_hallway02": { yaw: 45, pitch: -10 }
  },
  markers: [
    { id: 123, type: "room", label: "Room 203", yaw: 12, pitch: -5 },
    // elevatorId/accessibleFloors are only ever non-empty for type:
    // "elevator" — both are read live from the elevators table below,
    // never stored on the marker itself. See "Point-of-interest markers".
    { id: 124, type: "elevator", label: "Elevator A", yaw: 200, pitch: 0,
      elevatorId: "gd1-elevator-a", accessibleFloors: [-1, 1, 2, 3] }
  ],
  createdAt, updatedAt
}
```

Custom buildings: `{ id, label, floors }`, from the `buildings` table.

Elevators — the single source every landing marker above points at by
`elevatorId`, from the `elevators` table:

```js
{
  id: "gd1-elevator-a",
  label: "Elevator A",
  building: "gd1",
  accessibleFloors: [-1, 1, 2, 3],   // floors this car actually stops at
  landings: [                        // one entry per landing marker pointing at this elevator
    { markerId: 124, nodeId: "gd1_f2_hallway01", floor: 2 }
  ],
  createdAt, updatedAt
}
```

Signage slides (kiosk advertisements), from `signage_slides` via
`toSignageSlide` in `utils/entities.js`:

```js
{
  id: "4",
  title: "Enrollment 2027",
  mediaPath: "signage/enrollment-2027-mupq9sh.webm",  // public; extension decides image vs video
  crop: { x: 0, y: 0.22, w: 1, h: 0.55 },  // fractions of the media's own size, band-shaped
  durationSeconds: 7.5,                    // seconds, in tenths
  sortOrder: 0,                             // rotation position
  active: true,
  startsAt: null,                           // server-local "YYYY-MM-DD HH:MM:SS", or null
  endsAt: "2026-10-31 17:00:00"             // exclusive
}
```

---

## Known limitations / not yet built

- **Directions are shortest-hop, not shortest-distance** — the route finder
  counts number of connections, not physical distance.
- **Turn instructions are coarse** — "Go straight through" / "Turn left
  toward" and so on, computed from the arrow you just came through and the
  next one, not true compass or distance guidance.
- **Orphan/unlinked-node validation** is limited to a lightweight "unlinked"
  tag, not a full connectivity check.
- **Room-level destinations** route to the *node* serving a room, not a
  precise in-room point.
- **Stairs-vs-elevator mode is inferred, not tagged** — a graph edge has no
  "kind" of its own, so excluding stairs-only edges for elevator mode
  relies entirely on the Stairs node-type convention being followed when
  the graph is authored. See "Getting directions to a room" above.
- **Nearest Exit is hop-based and only as good as the graph** — distance is
  a count of links (plus a floor-change cost), not meters, so uneven
  panorama spacing can make a longer walk look shorter. It knows nothing
  about live hazards beyond what the visitor reports with "This way is
  blocked", crowds, or travel-distance limits in the fire code. Destinations
  only count once an admin has ticked "Emergency Exit Destination Point", and
  whether a ticked Lobby or Entrance is really safe is the admin's judgment,
  not something the system can check; review the Emergency Coverage page
  after editing the graph.
- **The mobile app is a fully separate codebase**; changes in this repo
  never affect it directly. `Arise_API` serves it downscaled JPEG copies of
  indoor photos on request, but this README describes the web app only. It
  must not rely on user login, registration or saved rooms: the API no
  longer has them.
- See [Known, still-open security gaps](#known-still-open-security-gaps)
  above for what's outstanding before this could reasonably go live to real
  users on a real domain.

---

## Third-party assets

- `src/assets/sounds/star-sfx-CREATIVE-COMMONS-ZERO.wav` — the feedback
  star-rating sound effect (played from `FeedbackPanel.jsx` when a visitor
  finishes picking a star). Licensed **CC0** (public domain, no attribution
  required). The filename keeps "CREATIVE-COMMONS-ZERO" in it on purpose so
  the license is obvious at a glance — don't rename it away from that.
- `src/assets/icons/question-mark-CREATIVE-COMMONS-ZERO.svg`: the "How to
  use this tour" button icon. "Question mark Pinhead icon" from Wikimedia
  Commons, licensed **CC0**; recolored to the app's grey. Same filename
  convention as above.