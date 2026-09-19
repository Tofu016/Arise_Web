# Arise

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
