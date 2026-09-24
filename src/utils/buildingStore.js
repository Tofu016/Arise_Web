import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "./apiClient";

// Rewritten to call Buildings_API instead of Firestore. Same public
// interface (getCustomBuildings, subscribeCustomBuildings,
// useCustomBuildingsVersion, addCustomBuilding, deleteCustomBuilding)
// preserved exactly — FilterPanel, NodeForm, MainPage, and
// AddBuildingDialog all keep working unchanged. Still a module-level
// singleton cache with a subscriber pattern, not a React hook directly
// — that's what lets four unrelated files share one cache without each
// needing its own fetch.
//
// No live onSnapshot equivalent anymore — confirmed early in this
// migration that reload-to-see-updates is fine. Fetches once on module
// load, then refreshes after any add/delete this session performs.
//
// GD1/GD2/GD3 genuinely never existed as Firestore documents here — the
// two sources (hardcoded constants + this store) were always naturally
// disjoint, which is what let constants.js's allBuildings() safely
// combine them with zero duplicate risk. They DO now exist as real rows
// in the backend (seeded specifically to satisfy nodes.building's
// foreign key), so this explicitly filters them back out — preserving
// that same disjoint-sets property allBuildings() still depends on.

const HARDCODED_IDS = ["gd1", "gd2", "gd3"];

let customBuildings = [];
// Backend names for every row, built-in GD1/GD2/GD3 included, so a rename
// of a built-in building shows up (constants.js overlays these onto its
// hardcoded labels). Only ids that actually have a backend row appear.
let serverNames = {};
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

function toFrontendBuilding(row) {
  return {
    id: row.id,
    label: row.name,
    floors: Array.from({ length: row.floor_count }, (_, i) => i + 1),
    ...(row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : {}),
    // Backend already resolves this via COALESCE(campus_id, id) — an
    // untouched row is its own solo campus, so this is never null.
    campus: row.campus_id,
  };
}

async function refresh() {
  const data = await apiGet("Buildings_API/getAll");
  serverNames = Object.fromEntries(data.buildings.map((b) => [b.id, b.name]));
  customBuildings = data.buildings
    .filter((b) => !HARDCODED_IDS.includes(b.id))
    .map(toFrontendBuilding);
  notify();
}

// Fire-and-forget on module load, same timing as the original
// onSnapshot subscription firing once the first snapshot arrives —
// consumers calling useCustomBuildingsVersion() re-render once this
// resolves and notify() runs. A failed load just leaves the list empty
// (no admin-added buildings) rather than an unhandled rejection at import.
refresh().catch(() => {});

export function getCustomBuildings() {
  return customBuildings;
}

export function getServerBuildingNames() {
  return serverNames;
}

export function subscribeCustomBuildings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useCustomBuildingsVersion() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeCustomBuildings(() => setTick((t) => t + 1)), []);
}

// reservedIds is accepted but no longer used — the backend now handles
// collision-avoidance entirely server-side (and correctly avoids
// gd1/gd2/gd3 too, since they're real rows there now), so there's
// nothing left for a client-side slug computation to do. Kept in the
// signature purely so AddBuildingDialog.jsx's existing call site needs
// no changes at all.
export async function addCustomBuilding({ name, floorCount, reservedIds: _reservedIds, lat, lng, campusId }) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new Error("Building name is required.");
  }

  const count = Math.floor(Number(floorCount));
  if (!Number.isFinite(count) || count < 1) {
    throw new Error("Floor count must be a whole number of at least 1.");
  }
  if (count > 100) {
    throw new Error("Floor count seems too high — double check it.");
  }

  const body = { name: trimmedName, floor_count: count };
  if (typeof lat === "number" && typeof lng === "number") {
    body.lat = lat;
    body.lng = lng;
  }
  const trimmedCampusId = (campusId || "").trim();
  if (trimmedCampusId) {
    body.campus_id = trimmedCampusId;
  }

  const data = await apiPost("Buildings_API/create", body);
  await refresh();
  return toFrontendBuilding(data.building);
}

export async function deleteCustomBuilding(id) {
  await apiDelete(`Buildings_API/delete/${id}`);
  await refresh();
}

// Edits a building that has a backend row (built-in ones included). Pass
// only what changes: name and/or floorCount.
export async function updateBuilding(id, { name, floorCount, campusId }) {
  if (!(id in serverNames)) {
    throw new Error("This building has no backend record to edit.");
  }
  const patch = {};
  if (name !== undefined) {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Building name is required.");
    patch.name = trimmedName;
  }
  if (floorCount !== undefined) {
    const count = Math.floor(Number(floorCount));
    if (!Number.isFinite(count) || count < 1) {
      throw new Error("Floor count must be a whole number of at least 1.");
    }
    if (count > 100) throw new Error("Floor count seems too high — double check it.");
    patch.floor_count = count;
  }
  // Empty string is meaningful here, not "unset" — it tells the backend to
  // write SQL NULL for campus_id (un-groups the building), distinct from
  // campusId being undefined (this edit doesn't touch campus grouping at all).
  if (campusId !== undefined) {
    patch.campus_id = campusId.trim();
  }
  await apiPatch(`Buildings_API/update/${id}`, patch);
  await refresh();
}
