import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { uploadPhoto } from "../utils/photoStore";
import { signageFilename } from "../utils/signage";
import { toSignageSlide, signageSlideBody, toSignageSettings, signageSettingsBody } from "../utils/entities";
import { useCollection } from "./useCollection";

// Signage_API hooks: the admin's full list (useSignage) and the kiosk's
// live rotation (useLiveSignage). See utils/signage.js for what signage is.

const EMPTY = { slides: [], settings: null, serverTime: null, readAt: 0 };

async function loadAll() {
  const data = await apiGet("Signage_API/getAll");
  return {
    slides: data.slides.map(toSignageSlide),
    settings: toSignageSettings(data.settings),
    serverTime: data.server_time,
    readAt: Date.now(),
  };
}

// Admin page. Media is uploaded only when a slide is saved (not when it is
// picked), so a cancelled edit never leaves a file behind; the API deletes
// a slide's file with the slide, or when the slide's media is replaced.
export function useSignage() {
  const { items: state, loading, error, mutate } = useCollection(loadAll, EMPTY);

  // `draft`: { title, crop, durationSeconds, active, startsAt, endsAt },
  // plus `file` when new media was picked. Resolves once saved.
  const saveSlide = useCallback(
    (id, draft) =>
      mutate(
        async () => {
          const { file, ...fields } = draft;
          if (file) {
            const { path } = await uploadPhoto("signage", file, { filename: signageFilename(fields.title) });
            fields.mediaPath = path;
          }
          const body = signageSlideBody(fields);
          if (id) await apiPatch(`Signage_API/update/${id}`, body);
          else await apiPost("Signage_API/create", body);
        },
        {
          success: id ? `"${draft.title}" saved.` : `"${draft.title}" added to the rotation.`,
          errorPrefix: "Couldn't save the advertisement",
        }
      ),
    [mutate]
  );

  const setSlideActive = useCallback(
    (slide, active) =>
      mutate(() => apiPatch(`Signage_API/update/${slide.id}`, signageSlideBody({ active })), {
        success: `"${slide.title}" ${active ? "switched on" : "switched off"}.`,
        errorPrefix: "Couldn't change the advertisement",
      }),
    [mutate]
  );

  const deleteSlide = useCallback(
    (slide) =>
      mutate(() => apiDelete(`Signage_API/delete/${slide.id}`), {
        success: `"${slide.title}" deleted.`,
        errorPrefix: "Couldn't delete the advertisement",
      }),
    [mutate]
  );

  // `ids`: every slide id in the new rotation order.
  const reorderSlides = useCallback(
    (ids) =>
      mutate(() => apiPost("Signage_API/reorder", { ids }), {
        success: "Rotation order saved.",
        errorPrefix: "Couldn't save the order",
      }),
    [mutate]
  );

  const saveSettings = useCallback(
    (patch) =>
      mutate(() => apiPatch("Signage_API/settings", signageSettingsBody(patch)), {
        success: "Rotation settings saved.",
        errorPrefix: "Couldn't save the settings",
      }),
    [mutate]
  );

  return {
    slides: state.slides,
    settings: state.settings,
    serverTime: state.serverTime,
    readAt: state.readAt,
    loading,
    error,
    saveSlide,
    setSlideActive,
    deleteSlide,
    reorderSlides,
    saveSettings,
  };
}

// How often the kiosk re-reads its rotation, so a slide's run window
// starting or ending (or an admin's edit) reaches a kiosk that stays up for
// days without a reload. A Kiosk session ending remounts the visitor view,
// which reads it again too.
const LIVE_REFRESH_MS = 5 * 60 * 1000;

// Kiosk: the slides live right now, in rotation order, and the settings.
// A failed read keeps whatever was last shown (an empty band before the
// first success), since a blip in the network shouldn't blank the band.
export function useLiveSignage(enabled = true) {
  const [state, setState] = useState({ slides: [], settings: null });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const load = () =>
      apiGet("Signage_API/getPublic")
        .then((data) => {
          if (cancelled) return;
          setState({ slides: data.slides.map(toSignageSlide), settings: toSignageSettings(data.settings) });
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, LIVE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return state;
}
