import { useState } from "react";
import { useBlurReview } from "./useBlurReview";
import { photoFilename, uploadPhoto } from "../utils/photoStore";
import { useToast } from "../context/ToastContext";

const CENTERED = { x: 50, y: 50 };

const uniqueSuffix = () => Date.now().toString(36);

function slugify(text) {
  return (text || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// An equirectangular 360 photo is exactly twice as wide as it is tall, so a
// photo of that shape is marked 360 up front; the admin can still flip it.
function guessKind(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(Math.abs(img.naturalWidth / img.naturalHeight - 2) < 0.02 ? "360" : "flat");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("flat");
    };
    img.src = url;
  });
}

// The room photo gallery's upload side, shared by the Room and Facility
// Editor's form and its "New Room or Facility" dialog. `setPhotos` is the
// owner's photo list setter; uploads append to it. Render `blurDialog`
// somewhere (after any dialog the gallery sits in, so it stacks above it).
export function useRoomPhotoUploads(setPhotos) {
  const toast = useToast();
  const [uploadState, setUploadState] = useState("idle"); // idle | uploading | done | error
  // Bumped for a photo edited in place (same path, new bytes), so its preview reloads.
  const [photoVersions, setPhotoVersions] = useState({});
  const { requestBlur, reblurStored, blurDialog } = useBlurReview();

  // "Edit blur regions" on an already-saved photo. Saves straight over it;
  // if that ever lands on a different path (old .jpg re-saved as .webp) the
  // photo adopts the new one, and Save then stores it on the room.
  const reblur = async (path) => {
    try {
      const saved = await reblurStored(path);
      if (!saved) return;
      setPhotos((prev) => prev.map((p) => (p.path === path ? { ...p, path: saved.path } : p)));
      setPhotoVersions((prev) => ({ ...prev, [saved.path]: (prev[saved.path] || 0) + 1 }));
      toast.success("Blur regions updated.");
    } catch (err) {
      toast.error(err.message || "Couldn't update the photo.");
    }
  };

  // Each picked file gets its own blur review, one after another; cancelling
  // one review skips only that file. Every file needs a name of its own or it
  // would replace the others. `name` only seeds the file names, so a room
  // that is still being created can upload under its draft title.
  const pickFiles = async (e, { name, building }) => {
    const input = e.target;
    const files = Array.from(input.files || []);
    input.value = ""; // so picking the same file again (e.g. after Cancel) still fires
    if (!files.length || !building) return;
    setUploadState("uploading");
    let added = 0;
    try {
      for (const file of files) {
        const kind = await guessKind(file);
        const reviewed = await requestBlur(file); // null = cancelled
        if (!reviewed) continue;
        const filename = photoFilename(file, `${slugify(name) || "room"}-${uniqueSuffix()}-${added}`);
        const { path } = await uploadPhoto("roomPhoto", reviewed, { building, filename });
        setPhotos((prev) => [...prev, { path, kind, ...CENTERED }]);
        added++;
      }
      setUploadState(added ? "done" : "idle");
      if (added) setTimeout(() => setUploadState((s) => (s === "done" ? "idle" : s)), 2500);
    } catch (err) {
      setUploadState("error");
      toast.error(err.message || "Couldn't upload the room photos.");
    }
  };

  return { uploadState, setUploadState, photoVersions, pickFiles, reblur, blurDialog };
}
