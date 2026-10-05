import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch } from "../utils/apiClient";
import { directorySettingsBody, toDirectorySettings } from "../utils/entities";
import { DEFAULT_DIRECTORY_SETTINGS } from "../utils/directorySettings";
import { useCollection } from "./useCollection";

// Directory_API hooks: the admin page's editable copy (useDirectorySettings)
// and the visitor sidebar's read-only one (useLiveDirectorySettings).

async function load() {
  const data = await apiGet("Directory_API/getPublic");
  return toDirectorySettings(data.settings);
}

export function useDirectorySettings() {
  const { items: settings, loading, error, mutate } = useCollection(load, DEFAULT_DIRECTORY_SETTINGS);

  const saveSettings = useCallback(
    (patch) =>
      mutate(() => apiPatch("Directory_API/settings", directorySettingsBody(patch)), {
        success: "Directory saved.",
        errorPrefix: "Couldn't save the directory",
      }),
    [mutate]
  );

  return { settings, loading, error, saveSettings };
}

// A failed read keeps showing everything: a blip in the network shouldn't
// empty the directory.
export function useLiveDirectorySettings() {
  const [settings, setSettings] = useState(DEFAULT_DIRECTORY_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((next) => {
        if (!cancelled) setSettings(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}
