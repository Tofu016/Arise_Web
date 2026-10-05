# Arrival view: which way a visitor faces after walking a link

Code: `src/utils/arrivalView.js` (tests beside it). Wired in by
`useNavigation.walk` (visitors) and `useGraphEditor.navigateTo` (the admin
editor's preview). The mobile app has the same chain in
`Arise_Mobile/src/utils/navigation.js` (`walkEntryView`); keep the two in step.

## Why

Panoramas don't share a common north (only about 40% of two-way links point at
each other's opposite angle), so the yaw of the arrow you clicked says nothing
about the next photo. The arrival photo's own return arrow (its link back to
where you came from) is in the right frame, so facing directly away from it is
facing the way you walked.

## Precedence (first match wins)

1. **Manual**: the link's `default_yaw` / `default_pitch`, set by an admin with
   "Set default view". Always wins; existing configurations are untouched.
2. **Automatic**: the arrival node's saved arrow to the node you left, plus 180
   degrees (mod 360), pitch 0. Nothing is stored; it is computed on arrival, so
   moving that return arrow changes the automatic view with it. An unplaced
   link does not count (its drawn angle is only an evenly-spread placeholder).
3. **Arrow**: the clicked arrow's own yaw, pitch 0. Last resort.

## Details

- Skip hallway: the stop just before arrival is the last of the skipped
  `via` nodes, not the node the visitor started the skip from.
- Elevator rides and fire stairs carry their own arrival yaw (out of the
  doors) and pass it as `defaultYaw`, so it is treated as fixed.
- Back keeps its own rule: face the arrow that points at the node being left.
- Jumps (search, rooms, building/floor pickers) are unchanged: the node's
  starting view, else dead ahead.
- Tour stops (`/tour`) use the same chain (`PublicTourPage.goTo`); pitch is not
  carried there, as before.

## Admin override

The Virtual Map Navigation Editor's link list shows each link as "manual
default view" or "automatic default view". **Override** / **Change default
view** captures a manual view (precedence 1); **Back to automatic** clears it.
The editor arrives through a link the same way a visitor does, so it previews
the automatic view before an override is chosen.
