# Setting up Nearest Exit: admin manual

For campus admins who maintain the Virtual Map in the CMS (`/admin`). No coding is needed. Allow an hour or two per building the first time.

## 1. What you are setting up

Visitors can tap **Nearest Exit** from any panorama. The app walks them, step by step, to the nearest node **you have marked as an Emergency Exit Destination Point**. It cannot tell whether a place is safe, so it only trusts your ticks. A wrong tick can leave someone standing somewhere dangerous, and a missing tick leaves them with no route. This manual is how you avoid both.

How the app chooses a route:

- It only ends at nodes you ticked **Emergency Exit Destination Point**. Nothing is automatic: an Open Area, Parking, Lobby, Entrance or Fire Exit node that is not ticked is never a destination.
- It never uses an elevator, even if an elevator is shorter.
- It passes through Stairs and fire stairwells freely, since those are the way down.
- It never climbs above **Floor 1** or above the visitor's own floor. Floor 1 is the ground floor in every building. Someone Underground does climb to Floor 1, because that is the way out. Someone on Floor 1 is never sent up and over. It climbs higher only when no other way exists, and then it warns the visitor.
- "Nearest" means fewest links between panoramas (plus a small cost for changing floors), not meters.
- If the visitor taps **This way is blocked**, it drops that step and finds another way out. If there is none, it shows the Bacoor City emergency numbers.
- **If a building has no ticked node, Nearest Exit finds no route there.** Visitors see "No safe way out was found from here" and the emergency numbers until you finish this manual for that building.

## 2. Words you need

| Word | Meaning |
|---|---|
| **Emergency Exit Destination Point** | A node you ticked to say: someone who reaches this node is out of danger. Where Nearest Exit ends. |
| **Open Area**, **Parking** | Outdoor nodes. They can be ticked. Not every open area is a safe place, so none are automatic. |
| **Lobby**, **Entrance** | Can be indoor spaces, or open into one. They can be ticked, but see the warning in section 5. |
| **Fire Exit** | Either a fire **stairwell** (leads between floors) or a fire **door**. Only a door people walk out through should be ticked. |
| **Stairs** | An ordinary staircase. Cannot be ticked, but routes pass through it. |

## 3. Before you start

1. Sign in to `/admin` with an admin account.
2. Get the floor plan or walk the building. For each building, write down the places a person can reach and **truly be out of danger**: fire doors to the street or a yard, an outdoor assembly area, a parking lot, a ground-floor lobby that is itself safe. Leave out anything that only leads into another indoor space.
3. Note every staircase and fire stairwell that connects the floors, and which floors each one reaches.
4. Open **Virtual Map** in the sidebar. You will use three pages: **Node Editor**, **Virtual Map Navigation Editor** and **Emergency Coverage**.

## 4. Step 1: Make sure each destination has a node

In **Node Editor**, check that every place you wrote down has a node of a fitting **Type**. Use **New Node** for any that are missing:

- A fire door people walk out through: **Fire Exit**.
- An outdoor assembly area or yard: **Open Area**.
- A parking lot: **Parking**.
- A ground-floor lobby or entrance that is itself safe: **Lobby** or **Entrance**.

For each node set the **Building** and **Floor** (the node ID must match them), a clear **Name**, and upload its 360 photo.

Do **not** change an existing Entrance node's **Type** just to make it a destination. If it is flagged as the Campus entrance or Building entrance, the kiosk shortcuts depend on it. Entrances can be ticked as they are (step 2).

For each fire **stairwell** (a Fire Exit or Stairs node that changes floor), create one node **on each floor it serves** and fill in **Leads to floor(s)**: tick every floor that node reaches. This is required for stairwells.

## 5. Step 2: Tick "Emergency Exit Destination Point"

This is the step that makes a node a destination. For each place you wrote down:

1. Open its node in **Node Editor**.
2. Tick **Emergency Exit Destination Point**.
3. Save.

Rules:

- **Tick only if someone who reaches this node is out of danger.** That is the whole test.
- It is only available on **Floor 1 or Underground**. On any upper floor the box is disabled. This stops a lobby ticked on every floor from ending every route where it started.
- Only **Open Area, Parking, Lobby, Entrance and Fire Exit** nodes show the box.
- A ticked Fire Exit door does **not** need **Leads to floor(s)**: a door has no other floor to lead to. An unticked Fire Exit (a stairwell) still does. A ground-floor stairwell exit can be ticked and still list its floors.
- **Lobby and Entrance show a red warning.** These can be indoor spaces, or open into one (a corridor, a connected building, an elevator hall), where a visitor is **not** out of danger. The system cannot check this. If you tick one, visitors are told they have reached their exit and to follow staff instructions, so tick only a ground-floor Lobby or Entrance that is truly safe, never one per floor.
- A visitor already standing on a ticked node who taps Nearest Exit is told they have arrived straight away.

## 6. Step 3: Connect everything in Virtual Map Navigation Editor

A route can only use links between nodes, so a missing link means a missing way out.

1. Open **Virtual Map Navigation Editor** and select a node.
2. In the **Links** box use **+ Add Links**, pick the neighbor, then click on the panorama where its arrow should sit. Links go both ways.
3. Check each of these chains is fully linked:
   - Every hallway on a floor to the stairs or fire stairwell node on that floor.
   - The stairwell node on one floor to the stairwell node on the floor below, for every floor it serves.
   - The ground-floor stairwell node (or hallway) to the ticked destination node.
   - The destination node to the hallway inside it, and to any outdoor node beyond it.
4. Do not link floors to each other by drawing a link between two ordinary hallway nodes on different floors. Always change floors through **Stairs** or **Fire Exit** nodes, so the system recognizes a stairwell.

Elevators are never used for evacuation, whatever you set up.

## 7. Step 4: Check your work on Emergency Coverage

Open **Emergency Coverage** (under **Virtual Map**). It runs the same routing the public app uses, from every node, so it shows exactly what a visitor standing there would be told. Pick a building at the top to focus on one at a time.

The four cards at the top:

| Card | What it means | Goal |
|---|---|---|
| **Destination points** | How many ticked nodes count | At least one per building |
| **Route stays level or down** | Nodes with a good route | Everything |
| **Route must go up** | Nodes whose only way out climbs above Floor 1 | Zero |
| **No route** | Nodes with no way out at all | Zero |

Then read the colored notes and the lists below the cards:

| Message | What it means | Fix |
|---|---|---|
| **No destination point at all** | A building has nothing ticked | Tick the places that are really out of danger (steps 1 and 2) |
| **Confirm these are really out of danger** | Lists every ticked Lobby and Entrance | Re-check each one on the plan. Untick any that opens into another indoor space |
| **Tick ignored** | A node is ticked but cannot count (wrong type, or above Floor 1) | Untick it, or fix its type or floor |
| A node under **Nodes that need attention**: *No route to any destination point* | It is not connected to any ticked node | Add the missing links (step 3) |
| A node under **Nodes that need attention**: *Only route goes up first* | Its only way out climbs above Floor 1 | Link its floor's stairwell down to the lower floor, or tick a closer node |

Use **Open in Node Editor** on any row to jump straight to that node. The **Emergency Exit Destination Points** list shows everything that currently counts.

At the bottom, **Preview a route** lets you pick any starting node and see the exact path and where it ends. Check at least these starts in every building: the top floor, a middle floor, Floor 1 and any Underground level. The path should go down the stairs to a ticked node (or, from Underground, up to Floor 1), with no elevators and no detours above Floor 1.

## 8. Step 5: Test it as a visitor

Do this on the public viewer (`/`, or a kiosk) after the Emergency Coverage page looks clean.

1. Go to a node on an upper floor and tap **Nearest Exit** (bottom right on desktop, in the side dock on a kiosk). Confirm it walks you down the stairs to the right place.
2. Repeat from Floor 1, from an Underground level if you have one, and from a far corner of the building.
3. During a route, tap **This way is blocked**. Confirm it offers another way out, or the emergency numbers if there is none.
4. Confirm the panel says "Use the stairs. Do not use elevators." and shows the emergency contacts.
5. Walk to the end and confirm the arrival message reads "You have reached your emergency exit point. Follow instructions from staff."

If a visitor in a building ever sees "No safe way out was found from here" with no one blocked, that building has no reachable ticked node: go back to step 2.

## 9. Keeping it correct

Re-open **Emergency Coverage** and clear every warning whenever you:

- add or remove a building, floor, stairwell or exit door;
- change a node's **Type**, **Floor** or **Building**;
- add, remove or re-wire links in the **Virtual Map Navigation Editor**;
- move nodes between buildings.

Also re-check after any construction that closes a door or stairwell. The app has no way to know a door is shut for the day: remove the link in the **Virtual Map Navigation Editor** (or untick the node) until it reopens, and restore it afterward.

## 10. Quick checklist per building

- [ ] Every place where a person is truly out of danger has a node, ticked **Emergency Exit Destination Point**, on Floor 1 or Underground.
- [ ] Every ticked **Lobby** or **Entrance** was checked against the plan and does not open into another indoor space.
- [ ] No lobby or entrance is ticked on more than the ground floor.
- [ ] Every staircase and fire stairwell has a node on each floor it serves, with **Leads to floor(s)** filled in.
- [ ] Hallways, stairwells and destination nodes are linked end to end, floor by floor.
- [ ] **Emergency Coverage** shows no **No route**, no **Route must go up**, no **No destination point at all** and no **Tick ignored**.
- [ ] **Preview a route** from the top floor, a middle floor and Floor 1 ends at a ticked node you expect.
- [ ] Tested **Nearest Exit** and **This way is blocked** on the public viewer.

## 11. What the app cannot do

- It cannot tell whether a ticked node is really safe. That is your judgment, most of all for Lobby and Entrance nodes.
- It does not know about fire, smoke or crowds. The only live information is a visitor tapping **This way is blocked**.
- It measures distance in links, not meters. Panoramas shot far apart can make a long walk look short.
- It does not check fire-code travel distances.
- It is a guide, not a substitute for the building's posted exit signs, the evacuation plan or instructions from staff.

## 12. Emergency numbers

Shown to visitors whenever Nearest Exit is open (Bacoor City):

| Service | Number |
|---|---|
| Priority Emergency Hotline | 161 or (046) 417-0207 |
| Bureau of Fire Protection (BFP) Bacoor | (046) 417-6060 |
| Bacoor CDRRMO (Rescue) | (046) 417-0727 |
| Bacoor Police (PNP) | (046) 417-6366 |

These live in `EMERGENCY_CONTACTS` in `src/utils/constants.js`. Changing them needs a developer and a new web build.
