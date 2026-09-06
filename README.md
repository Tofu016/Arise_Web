# ARISE Campus Navigator

A self-built 360° panorama campus tour — an admin editor for mapping real
locations as a linked graph of panoramas, and a public-facing viewer for
walking through the campus and getting directions to a room, hallway by
hallway, the way Street View walks you down a street.

There's no 3D building model behind this (the original `Main_Campus_Parent.glb`
only had flat node markers, not real geometry) — instead, every location is a
360° photo ("node") connected to its neighbors, with clickable arrows
("hotspots") that walk you from one photo to the next.

The app is backed entirely by **Firebase** — Firestore for the campus graph
and buildings list, Firebase Storage for the 360° photos. There's no local
file-based mode anymore; every admin session and every visitor reads/writes
the same live cloud dataset in real time.

---

## Contents

- [Quick start](#quick-start)
- [Firebase setup](#firebase-setup)
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
npm install react-router-dom three @react-three/fiber @react-three/drei firebase
```

**Run it:**
```powershell
npm run dev
```

Open the printed localhost URL:
- `/admin` — the editor, for building and maintaining the campus graph.
- `/` — the public viewer, what a visitor actually sees.

Both talk straight to Firebase — there's no "connect a file" step. Open
`/admin` and start creating nodes; they show up in Firestore (and on `/`)
immediately.

---

## Firebase setup

This only needs doing once per Firebase project (already done for the live
project this app points at — `src/firebase.js` has the config):

1. **Enable Email/Password sign-in**: Firebase console → **Authentication** →
   **Sign-in method** → enable **Email/Password**.
2. **Enable Identity Platform**: Firebase console → **Authentication** →
   "Upgrade to Identity Platform" (free — a different backend for the same
   Auth product, not a plan change). Required for the `enforceEmailDomain`
   blocking Cloud Function below to run.
3. **Deploy the Cloud Functions** (needs the Firebase CLI):
   ```powershell
   npm install -g firebase-tools
   firebase login
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```
   This deploys two functions — see
   [Cloud Functions](#cloud-functions--role-enforcement) below for what they do.
4. **Publish the security rules** — either paste manually, or deploy via CLI
   now that `firebase.json` points at them:
   ```powershell
   firebase deploy --only firestore:rules,storage:rules
   ```
   or manually: Firebase console → **Firestore Database** → **Rules** tab →
   paste `firebase-rules/firestore.rules` → Publish; **Storage** → **Rules**
   tab → paste `firebase-rules/storage.rules` → Publish.
5. **Seed the first admin.** Nobody can be promoted to `admin` through the
   app until at least one admin already exists — register a normal account,
   then in the Firebase console → **Firestore Database** → `users/{your-uid}`
   → manually change `role` from `"pending"` to `"admin"`. Console edits use
   your own Google account's permissions and bypass the security rules
   entirely, which is the expected, normal way to seed the first admin on a
   fresh project. Every admin after that can be promoted from the Users panel.
6. **Set up email notifications** (welcome email on registration, approval
   email once someone's promoted off `pending`) — see
   [Email notifications](#email-notifications) below.

### Cloud Functions & role enforcement

Five functions in `functions/index.js`, deployed together:

- **`enforceEmailDomain`** — a Firebase Auth **blocking function**
  (`beforeUserCreated`). Rejects account creation outright, server-side, if
  the email isn't `@sdca.edu.ph` — real enforcement, not just the client-side
  check already in `Register.jsx` (which only stops someone using the app's
  own form, not someone calling the Auth SDK directly).
- **`syncUserRoleClaim`** — a Firestore trigger on `users/{uid}`. Mirrors
  that document's `role` field onto the user's Auth token as a **custom
  claim** every time it changes. This is what lets the Firestore/Storage
  security rules check `request.auth.token.role` cheaply, instead of each
  rule evaluation having to look up the Firestore document itself.
- **`sendWelcomeEmail`** / **`sendApprovalEmail`** — see
  [Email notifications](#email-notifications) below.
- **`deleteUserAccount`** — a **callable function** the Users panel's
  Delete button invokes. The client-side Auth SDK can only ever delete the
  *currently signed-in* user's own account, never someone else's — this
  runs with Admin SDK privileges to delete both the target's Auth login and
  their Firestore profile together. Checks the caller's `role` claim is
  `admin` and blocks deleting your own account (same reasoning as the
  can't-change-your-own-role guard already in the panel).

**A real limitation worth knowing**: custom claims only take effect on a
*fresh* ID token. `AuthContext.jsx` forces a token refresh as soon as it sees
a role change come through on the Firestore side, which closes most of the
gap — but there's still a brief window (the Cloud Function has to actually
run first) where an admin approving someone and that person's rule-gated
access actually updating aren't perfectly instant. If something looks like it
should work right after an approval but doesn't, waiting a few seconds (or a
manual page reload) resolves it.

### Known gap

There's no way to become the *first* admin except by hand in the Firestore
console — see step 5 above. That's expected, not a bug. After that, admin
promotion works entirely through the Users panel.

### Email notifications

Two Firestore-triggered functions send a plain-HTML email at the relevant
moment — a welcome email right when someone registers, and an approval email
the first time an admin moves their role off `pending`. Neither function
sends email directly; they write a document into a `mail` Firestore
collection, which the **Trigger Email** Firebase Extension watches and
actually delivers, via a Gmail account acting as an SMTP relay.

**One-time setup:**

1. **Create a dedicated Gmail account** for sending (e.g.
   `arise.notifications@gmail.com`) — using a personal account works too, but
   a dedicated one keeps "who sent this" clear and avoids mixing with your
   own inbox.
2. **Enable 2-Step Verification** on that Google account (required for the
   next step): [myaccount.google.com/security](https://myaccount.google.com/security).
3. **Generate an App Password**: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   → create one for "Mail" → copy the 16-character password shown. This is
   what the extension authenticates with — never your real Google password.
4. **Install the Trigger Email extension**: Firebase console → **Extensions**
   → search "Trigger Email" → Install.
   - **SMTP connection URI**:
     `smtps://YOUR_GMAIL_ADDRESS:YOUR_APP_PASSWORD@smtp.gmail.com:465`
     (the app password from step 3, no spaces).
   - **Email documents collection**: `mail` (matches what the Cloud Functions
     write to — must match exactly).
   - Leave the rest as defaults unless you want to customize sender name/reply-to.
5. Redeploy the Cloud Functions if you haven't already since adding
   `sendWelcomeEmail`/`sendApprovalEmail`:
   ```powershell
   firebase deploy --only functions
   ```

**Testing it**: register a test account and check the inbox for a welcome
email; promote it off `pending` in the Users panel and check for the
approval email. If nothing arrives, check Firebase console → **Extensions**
→ Trigger Email → **Logs**, and the Gmail account's "Sent" folder — most
issues at this point are a copy-paste mistake in the SMTP URI or the app
password.

---

## Accounts & roles

Both `/` and `/admin` require signing in — there's no public/anonymous
access. Three roles:

| Role | Can do |
|---|---|
| `pending` | Nothing yet — sees an "awaiting approval" screen after registering. Default for every new account. |
| `user` | Use the public tour (`/`) — search, browse, get directions. No access to `/admin`. |
| `admin` | Everything a `user` can, plus the full `/admin` editor, including the Users panel. |

**Registering**: `/register` requires an `@sdca.edu.ph` email — checked
client-side immediately (a popup error otherwise), and enforced again
server-side by the `enforceEmailDomain` Cloud Function (see
[Cloud Functions & role enforcement](#cloud-functions--role-enforcement)) so
it can't be bypassed by going around the form.

**Getting approved**: every new account starts as `pending` and needs an
existing admin to promote them — from `/admin`, click **👥 Users** (shows a
red badge with the pending count). Each user has a role dropdown; picking
`user` or `admin` takes effect within a couple seconds for that person,
without them needing to log out and back in.

**Deleting an account**: the same panel has a **Delete** button per row —
permanently removes both that person's login and their profile (they'd have
to register again from scratch to come back). Confirms before deleting, and
an admin can't delete their own account from here (same reasoning as not
being able to change your own role — ask another admin instead).

**Signing out**: available from the account chip in MainPage's sidebar, or
the toolbar in `/admin`.

---

## How the data is organized

- **Nodes** — one Firestore document per node, in the `nodes` collection.
  Every field (building, floor, type, neighbors, hotspots, rooms, photo URL)
  lives there; see [Data model reference](#data-model-reference).
- **Custom buildings** (`+ New building`) — one Firestore document per
  building, in the `buildings` collection.
- **360° photos** — Firebase Storage, at `panoramas/{building}/{filename}`.
  Each node's `photo` field stores the Storage download URL directly.

Everything is real-time: any change made in `/admin` (or directly in the
Firebase console) appears on every open `/admin` and `/` session within a
second or two, no reload needed.

**Legacy local files**: `public/nodes.json` and `public/panoramas/*.jpg` are
kept in the repo as an offline archive from before the Firebase migration —
they're not read by the app anymore, just a point-in-time backup.

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
     specific to the selected building (see
     [Managing buildings & floors](#managing-buildings--floors)).
   - **Type** — hallway, lobby, entrance, transition (main stairs),
     transition exit (fire stairs), open area (parking), or portal
     (GD2 ↔ GD3 crossing).
   - **Leads to floor** — only shown for transition types; which floor this
     stairwell/exit connects to.
   - **Rooms served** — type a room number/name and hit Enter or click Add to
     attach it as a removable chip. A room can only be attached to one node
     campus-wide (the tool blocks duplicates), since search needs a single
     answer for "where is room 203."
   - **360° photo filename** / **Choose 360° photo file** — see next section.
   - **Neighbors** — see [Linking neighbors & hotspots](#linking-neighbors--hotspots).
3. Click **Create node** / **Save changes**. Validation errors (bad ID
   format, duplicate ID, duplicate room, missing required field) show inline
   and block saving until fixed.
4. **Delete** (edit mode only) removes the node and automatically cleans it
   out of every other node's neighbor list, so you never end up with a dangling
   link to a node that no longer exists.

### Adding a 360° photo to a node

Click **Choose 360° photo file** and pick the image — it uploads straight to
Firebase Storage at `panoramas/{building}/{filename}` and the node's photo
field is set to the resulting download URL automatically. No manual file
placement, no "connect a folder" step.

- The uploaded file is renamed to match the node's own **ID** (keeping the
  real file extension) rather than whatever it was originally called — so
  re-uploading a replacement photo for the same node cleanly overwrites the
  same Storage path instead of leaving old, differently-named files behind.
  If the node doesn't have an ID yet, it falls back to the original filename.
- Live status shows next to the picker: *Uploading…* → *✓ Uploaded to
  Firebase Storage*.
- Genuine equirectangular panoramas (2:1 aspect ratio — what a 360 camera
  outputs by default) are what this is built for. A flat photo will still
  load but looks warped around the sphere.

### Linking neighbors & hotspots

- The **Neighbors** picker in the node form lists other nodes on the same
  building + floor (portal nodes are always shown regardless of filter, since
  they cross GD2 ↔ GD3). Check a node to link it — links are bidirectional,
  so linking A→B automatically links B→A too.
- Neighbor links alone don't position the clickable arrow in the panorama —
  for that, open **🧭 Test navigation**:
  1. Walk into the node you want to position an arrow in.
  2. Use the placement tool to click on the panorama sphere where you want
     the arrow toward a given neighbor to sit (yaw/pitch), or leave it
     unset — unset hotspots default to evenly spaced arrows around the
     horizon, so navigation still works immediately even before you've
     hand-placed anything.
  3. Positions save automatically the same way any other edit does.
- **Renaming a node's ID** automatically updates every other node's neighbor
  list to match, so links never silently break.

### Point-of-interest markers (rooms, facilities, exits, hydrants)

Separate from navigation hotspots — these are fixed labels that stay put in
the panorama rather than taking you anywhere when clicked. One system covers
four categories (🚪 Room, 📍 Facility, 🚨 Emergency Exit, 🧯 Fire
Hydrant/Extinguisher), so adding a new category later is just adding an icon,
not building a second feature.

Placed the same way as hotspots, inside **🧭 Test navigation**:
1. In the sidebar's **Markers** section, click **+ Add marker**, pick a type
   and type a label (e.g. "Room 203", "Restroom", "Fire Extinguisher").
2. Click **Place on panorama**, then click where on the sphere it should sit.
3. **Reposition**/**Remove** work the same as for links.

Markers show up on both `/admin` (Test Navigation, Preview Tour's linear
walkthrough doesn't render them — see below) and the public `/` page — every
visitor sees the same room/facility/safety labels an admin placed.

**Known scope gap**: Preview Tour uses a simpler standalone viewer that
doesn't currently render hotspots *or* markers (it never rendered hotspots
either) — its job is confirming every node has a working photo, not
verifying marker placement. Use Test Navigation to check markers.

### Managing buildings & floors

By default there are three verified buildings — GD1, GD2, GD3 — with real
floor counts pulled from the original campus model. You can add more:

1. Click **+ New building** in the toolbar.
2. Enter a building name and how many floors it has. Floors are numbered
   1 through your count automatically.
3. The new building immediately appears in every building dropdown across the
   tool — the filter panel, the node form, and the public main page.
4. To remove a custom building, open the same dialog — every admin-added
   building is listed there with a **Delete** button. (The original GD1/GD2/GD3
   can't be deleted; they aren't in this list at all.) If any nodes currently
   use that building, you'll be warned before deleting — the nodes themselves
   aren't touched, they just won't show up under that building filter until
   you re-add it or reassign them.

### Filtering & finding nodes

The **Filter** panel narrows the node list by:
- **Building** / **Floor** (floor options update to match the selected building)
- **Type** (hallway, lobby, entrance, etc.)
- **Photo status** (missing vs. has a photo filename set)
- **Search** (matches ID, name, or room number)

The node list header also shows a running **photo-assignment count** (how
many nodes have a photo filename set), useful for tracking shoot progress.

### Preview tour & navigation testing

- **▶ Preview tour** — a straightforward linear walkthrough of every node
  (entrances first, then in building/floor order) with Prev/Next controls.
  Good for a full once-over of everything you've built. If a photo fails to
  load, a "Missing photo" note shows the actual stored photo reference so you
  can tell whether it's unset or just failed to load.
- **🧭 Test navigation** — the click-to-walk tester described above; this is
  also where you position hotspots and verify the graph actually connects the
  way you intended, exactly as a visitor would experience it.

---

## User guide (`/`)

The public page is what a visitor sees — no editing controls, just the tour.

### Getting around

- The page loads straight into a starting entrance's 360° photo — no menu to
  click through first.
- **Left sidebar** (always visible):
  - **Search** — type a room number or name; matching results appear below.
    Click a result to jump straight there.
  - **Building** — switch which building's entrances are listed below.
  - **Entrances** — pick any listed entrance to jump straight to it as a new
    starting point.
- **In the photo** — click and drag to look around, and click a glowing
  arrow to walk to the connected location. Small labeled icons (🚪 room,
  📍 facility, 🚨 exit, 🧯 fire hydrant/extinguisher) mark points of interest
  an admin has placed — these are informational only, clicking them doesn't
  move you anywhere.
- **← Back** (top of the viewer, once you've moved at least once) — retraces
  your steps one node at a time.

### Getting directions to a room

Instead of just teleporting straight to a destination, you can get a
step-by-step walking route, similar to Street View directions:

1. Search for a room or place.
2. Click **➜ Directions** next to the result you want to walk to (rather than
   clicking the result itself, which still does a direct jump).
3. A **Directions** panel opens with **From** (defaults to your current
   location) and **To** (defaults to what you searched for) fields — both are
   editable; start typing in either to search for a different point and pick
   it from the suggestions.
4. Click **Get directions**. If a walkable route exists, it shows how many
   stops away the destination is.
5. Click **Start walking** (if your starting point isn't where you currently
   are) or **Walk to `<next stop>` →** to advance one step at a time — the
   matching arrow in the photo also glows green as a visual cue for which way
   to go, so you can either click the sidebar button or the arrow itself.
6. The panel tracks your progress ("Stop 2 of 5") and shows an arrival
   message once you reach the destination. If you wander off the suggested
   arrow onto a different one, the route automatically recalculates from
   wherever you ended up rather than leaving you on a broken path.
7. **✕** on the directions panel cancels guidance at any time — normal
   free-roaming navigation and search keep working exactly as before.

---

## Data model reference

```js
{
  id: "gd1_f2_hallway01",
  name: "GD1 2ndFloor Hallway3",
  building: "gd1",                  // gd1 | gd2 | gd3 | any admin-created building id
  floor: 2,                         // -1 = UG, 1 = Ground, 2, 3, ...
  type: "hallway",                  // hallway | lobby | entrance | transition | transitionExit | openArea | portal
  leadsToFloor: null,                // set only for transition / transitionExit types
  photo: "https://firebasestorage.googleapis.com/...",  // Storage download URL — set automatically on upload
  rooms: ["203", "204"],             // rooms this node serves — what search matches against
  neighbors: ["gd1_f2_hallway02"],   // directly walkable connections, kept bidirectional
  hotspots: {                        // per-neighbor arrow position; unset entries fall back to evenly spaced defaults
    "gd1_f2_hallway02": { yaw: 45, pitch: -10 }
  },
  markers: [                         // fixed point-of-interest labels — room/facility/exit/hydrant, don't navigate anywhere
    { id: "m_abc123", type: "room", label: "Room 203", yaw: 12, pitch: -5 }
  ],
  createdAt, updatedAt
}
```

Buildings you add via **+ New building** are stored the same way, in a
separate Firestore `buildings` collection, as `{ id, label, floors }`.

---

## Known limitations / not yet built

- **Custom-claim propagation lag** — see the note under
  [Cloud Functions & role enforcement](#cloud-functions--role-enforcement); a
  role change can take a few seconds (rarely, a manual reload) to fully take
  effect for the affected user.
- **Directions are shortest-hop, not shortest-distance** — the route finder
  counts number of connections, not physical distance, so two short hallway
  segments and one long one both count as "2 stops."
- **No step-by-step turn instructions** — directions guide you node-by-node
  with a highlighted arrow, not compass-style "turn left" text.
- **Orphan/unlinked-node validation** is limited to a lightweight "unlinked"
  tag in the node list, not a full connectivity check across the whole graph.
- **Room-level destinations** — directions currently route to the *node*
  serving a room, not a precise in-room point.
