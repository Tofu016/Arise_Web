import { useRef, useState } from "react";
import IconPlaceholder from "../IconPlaceholder";
import SignageCropper from "./SignageCropper";
import SignageMedia from "../SignageMedia";
import { publicPhotoUrl } from "../../utils/photoStore";
import {
  DURATION_RULE,
  SIGNAGE_CATEGORIES,
  SIGNAGE_CATEGORY_IDS,
  SIGNAGE_IMAGE_TYPES,
  SIGNAGE_MAX_SECONDS,
  SIGNAGE_MIN_SECONDS,
  SIGNAGE_VIDEO_TYPES,
  cropMatchesShape,
  defaultCrop,
  durationForVideo,
  formatSeconds,
  fromDateTimeInput,
  isVideoPath,
  parseDuration,
  roundCrop,
  scaleCrop,
  signageFileProblem,
  toDateTimeInput,
} from "../../utils/signage";

const ACCEPT = [...SIGNAGE_IMAGE_TYPES, ...SIGNAGE_VIDEO_TYPES].join(",");
const ZOOM_STEP = 1.1;

// What's still missing before Save works, in the order the dialog asks
// for it, so a disabled Save button never leaves the admin guessing.
function saveHint({ title, media, crop, durationValid, windowValid }) {
  if (!media) return "Choose an image or video to start.";
  if (!crop) return "Loading the file...";
  if (!title.trim()) return "Give it a name to save.";
  if (!durationValid) return "Fix the time on screen to save.";
  if (!windowValid) return "Fix the schedule to save.";
  return "";
}

// The already-uploaded files (from either category), to reuse for this one.
function MediaLibrary({ items, onPick }) {
  return (
    <ul className="signage-library" aria-label="Uploaded files">
      {items.map((item) => (
        <li key={item.mediaPath}>
          <button type="button" className="signage-library-item" onClick={() => onPick(item)} title={item.titles.join(", ")}>
            {isVideoPath(item.mediaPath) ? (
              <video src={publicPhotoUrl(item.mediaPath)} className="signage-library-thumb" muted preload="metadata" />
            ) : (
              <img src={publicPhotoUrl(item.mediaPath)} alt="" className="signage-library-thumb" loading="lazy" />
            )}
            <span className="signage-library-name">{item.titles[0]}</span>
            <span className="signage-library-meta">
              {item.categories.map((c) => SIGNAGE_CATEGORIES[c].label).join(" + ")}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// The add/edit dialog for one advertisement (signage slide): pick the file,
// crop it to the kiosk's bottom band while watching a live preview, then
// set its title, time on screen, run dates and on/off. The file is only
// uploaded on Save (see useSignage), so Cancel never leaves one behind.
//
// Deliberately not closed by clicking the backdrop: a stray click would
// throw away a crop the admin spent a while lining up.
export default function SignageSlideEditor({ slide, category: initialCategory, library, defaultDuration, onSave, onClose }) {
  const editing = !!slide;
  const fileInputRef = useRef(null);
  // Every object URL made for a picked file, revoked when the dialog closes.
  const objectUrls = useRef([]);

  const [title, setTitle] = useState(slide?.title ?? "");
  const [category, setCategory] = useState(slide?.category ?? initialCategory ?? "footer");
  // An already-uploaded file picked from the library (a path), instead of a new upload.
  const [libraryPath, setLibraryPath] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [media, setMedia] = useState(() =>
    slide ? { src: publicPhotoUrl(slide.mediaPath), video: isVideoPath(slide.mediaPath), name: null } : null
  );
  const [mediaInfo, setMediaInfo] = useState(null);
  const [crop, setCrop] = useState(slide?.crop ?? null);
  const [duration, setDuration] = useState(formatSeconds(slide?.durationSeconds ?? defaultDuration ?? 10));
  const [durationTouched, setDurationTouched] = useState(editing);
  const [active, setActive] = useState(slide?.active ?? true);
  const [startsAt, setStartsAt] = useState(toDateTimeInput(slide?.startsAt));
  const [endsAt, setEndsAt] = useState(toDateTimeInput(slide?.endsAt));
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const target = SIGNAGE_CATEGORIES[category];
  const mediaAspect = mediaInfo ? mediaInfo.width / mediaInfo.height : null;
  const videoSeconds = mediaInfo?.duration && Number.isFinite(mediaInfo.duration) ? mediaInfo.duration : null;

  const close = () => {
    objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrls.current = [];
    onClose();
  };

  const pickFile = (picked) => {
    if (!picked) return;
    const problem = signageFileProblem(picked);
    if (problem) {
      setError(problem);
      return;
    }
    const src = URL.createObjectURL(picked);
    objectUrls.current.push(src);
    setError("");
    setFile(picked);
    setLibraryPath(null);
    setLibraryOpen(false);
    setMedia({ src, video: SIGNAGE_VIDEO_TYPES.includes(picked.type), name: picked.name });
    setMediaInfo(null);
    setCrop(null); // a new shape needs a new crop, picked once it loads
    if (!title.trim()) setTitle(picked.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
  };

  const pickLibrary = (item) => {
    setError("");
    setFile(null);
    setLibraryPath(item.mediaPath);
    setLibraryOpen(false);
    setMedia({ src: publicPhotoUrl(item.mediaPath), video: isVideoPath(item.mediaPath), name: null });
    setMediaInfo(null);
    setCrop(null);
    if (!title.trim()) setTitle(item.titles[0]);
  };

  // A slide's crop is cut to its category's shape, so switching category
  // starts over from the largest centered crop of the new shape.
  const changeCategory = (next) => {
    setCategory(next);
    if (mediaAspect) setCrop(defaultCrop(mediaAspect, SIGNAGE_CATEGORIES[next].aspect));
  };

  // The media loaded: now its shape is known. Keep a stored crop that still
  // fits it (editing), otherwise start from the largest centered one. A new
  // video's time on screen defaults to its own length (to the tenth), so it
  // plays through once per turn, until the admin sets one themselves.
  const handleMediaInfo = (info) => {
    if (!info.width || !info.height) return;
    const aspect = info.width / info.height;
    setMediaInfo(info);
    setCrop((current) => (current && cropMatchesShape(current, aspect, target.aspect) ? current : defaultCrop(aspect, target.aspect)));
    if (!durationTouched && info.duration && Number.isFinite(info.duration)) {
      setDuration(formatSeconds(durationForVideo(info.duration)));
    }
  };

  const seconds = parseDuration(duration);
  const durationValid = seconds !== null;
  const videoMatch = videoSeconds ? durationForVideo(videoSeconds) : null;
  const windowValid = !startsAt || !endsAt || endsAt > startsAt;
  const canSave = !saving && title.trim() && media && crop && durationValid && windowValid;
  let submitLabel = editing ? "Save changes" : "Add to rotation";
  if (saving) submitLabel = file ? "Uploading..." : "Saving...";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setError("");
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        category,
        ...(file ? { file } : {}),
        ...(libraryPath && libraryPath !== slide?.mediaPath ? { mediaPath: libraryPath } : {}),
        crop: roundCrop(crop),
        durationSeconds: seconds,
        active,
        startsAt: fromDateTimeInput(startsAt),
        endsAt: fromDateTimeInput(endsAt),
      });
      close();
    } catch (err) {
      setError(err.message || "Couldn't save the advertisement.");
      setSaving(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const dropProps = {
    onDragOver: (e) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop,
  };

  return (
    <div className="modal-overlay">
      <form
        className="modal signage-editor"
        onSubmit={handleSubmit}
        aria-labelledby="signage-editor-title"
        onKeyDown={(e) => e.key === "Escape" && !saving && close()}
      >
        <div className="preview-header">
          <h3 id="signage-editor-title">{editing ? "Edit" : "New"} {target.noun}</h3>
          <button type="button" className="close-btn" onClick={close} aria-label="Close" disabled={saving}>
            <IconPlaceholder name="close" className="signage-editor-close-icon" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="signage-file-input"
          onChange={(e) => {
            pickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <div className="signage-editor-body">
          <div className="signage-editor-media">
            <section className="signage-editor-section">
              <h4 className="signage-editor-step">
                <span className="signage-step-num">1</span> Media
              </h4>
              {!media ? (
                <div className={"signage-dropzone" + (dragOver ? " signage-dropzone--over" : "")} {...dropProps}>
                  <p className="signage-dropzone-title">Drop an image or video here</p>
                  <p className="signage-dropzone-hint">
                    JPG, PNG, GIF, WebP, MP4 or WebM. Best at {target.size.width} x {target.size.height} px or larger.
                    Videos play muted and loop.
                  </p>
                  <div className="signage-dropzone-actions">
                    <button type="button" className="signage-btn signage-btn--accent" onClick={() => fileInputRef.current?.click()}>
                      Choose file
                    </button>
                    {library.length > 0 && (
                      <button type="button" className="signage-btn" onClick={() => setLibraryOpen((o) => !o)}>
                        Use an uploaded file
                      </button>
                    )}
                  </div>
                  {libraryOpen && <MediaLibrary items={library} onPick={pickLibrary} />}
                </div>
              ) : (
                <div className={"signage-crop-area" + (dragOver ? " signage-dropzone--over" : "")} {...dropProps}>
                  <p className="signage-help">
                    Drag the box to choose what shows on the kiosk; drag a corner to zoom. The dimmed part is cut off.
                  </p>
                  <SignageCropper
                    src={media.src}
                    video={media.video}
                    crop={crop}
                    mediaAspect={mediaAspect}
                    targetAspect={target.aspect}
                    onChange={setCrop}
                    onMediaInfo={handleMediaInfo}
                  />
                  <div className="signage-crop-tools">
                    <button
                      type="button"
                      className="signage-btn"
                      disabled={!crop}
                      onClick={() => setCrop(scaleCrop(crop, 1 / ZOOM_STEP, mediaAspect, target.aspect))}
                    >
                      Zoom in
                    </button>
                    <button
                      type="button"
                      className="signage-btn"
                      disabled={!crop}
                      onClick={() => setCrop(scaleCrop(crop, ZOOM_STEP, mediaAspect, target.aspect))}
                    >
                      Zoom out
                    </button>
                    <button type="button" className="signage-btn" disabled={!mediaAspect} onClick={() => setCrop(defaultCrop(mediaAspect, target.aspect))}>
                      Fit to frame
                    </button>
                    <span className="signage-crop-tools-spacer" />
                    {library.length > 0 && (
                      <button type="button" className="signage-btn" onClick={() => setLibraryOpen((o) => !o)}>
                        Use an uploaded file
                      </button>
                    )}
                    <button type="button" className="signage-btn" onClick={() => fileInputRef.current?.click()}>
                      Replace file
                    </button>
                  </div>
                  {libraryOpen && <MediaLibrary items={library} onPick={pickLibrary} />}
                  {mediaInfo && (
                    <p className="signage-media-facts">
                      {media.name ? `${media.name}: ` : ""}
                      {mediaInfo.width} x {mediaInfo.height} px
                      {videoSeconds ? `, ${videoSeconds.toFixed(1)} s video` : ""}
                      {crop && crop.w * mediaInfo.width < target.size.width && (
                        <span className="signage-warn">
                          {" "}
                          The visible part is only {Math.round(crop.w * mediaInfo.width)} px wide, so it will look soft on
                          the kiosk. Zoom out or use a larger file.
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}
            </section>

            {media && crop && (
              <section className="signage-editor-section">
                <h4 className="signage-editor-step">
                  <span className="signage-step-num">2</span> Preview
                </h4>
                <div className="signage-preview-row">
                  <div className="signage-preview-band-wrap">
                    <div className="signage-band-frame" style={{ aspectRatio: target.aspect }}>
                      <SignageMedia src={media.src} video={media.video} crop={crop} />
                    </div>
                    <span className="signage-caption">{target.label} advertisement, as the kiosk shows it</span>
                  </div>
                  <div className="signage-kiosk-mock" aria-hidden="true">
                    <div className="signage-kiosk-mock-header" />
                    <div className="signage-kiosk-mock-panorama" />
                    <div className={`signage-kiosk-mock-band signage-kiosk-mock-band--${category}`}>
                      <SignageMedia src={media.src} video={media.video} crop={crop} />
                    </div>
                    <span className="signage-caption">Whole screen</span>
                  </div>
                </div>
              </section>
            )}
          </div>

          <div className="signage-editor-details">
            <h4 className="signage-editor-step">
              <span className="signage-step-num">{media && crop ? 3 : 2}</span> Details
            </h4>

            <fieldset className="signage-field">
              <legend className="signage-field-label">Plays on</legend>
              <div className="signage-segmented" role="radiogroup">
                {SIGNAGE_CATEGORY_IDS.map((id) => (
                  <label key={id} className={"signage-segmented-opt" + (category === id ? " signage-segmented-opt--on" : "")}>
                    <input
                      type="radio"
                      name="signage-category"
                      value={id}
                      checked={category === id}
                      onChange={() => changeCategory(id)}
                    />
                    {SIGNAGE_CATEGORIES[id].label}
                  </label>
                ))}
              </div>
              <span className="signage-field-hint">
                {target.label} advertisements play in {target.where} ({target.size.width} x {target.size.height} px).
              </span>
            </fieldset>

            <label className="signage-field">
              <span className="signage-field-label">Name</span>
              <input
                type="text"
                value={title}
                maxLength={255}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Enrollment 2027"
              />
              <span className="signage-field-hint">Only admins see this.</span>
            </label>

            <label className="signage-field">
              <span className="signage-field-label">Time on screen</span>
              <span className="signage-inline-input">
                <input
                  type="number"
                  inputMode="decimal"
                  min={SIGNAGE_MIN_SECONDS}
                  max={SIGNAGE_MAX_SECONDS}
                  step={0.1}
                  value={duration}
                  onChange={(e) => {
                    setDuration(e.target.value);
                    setDurationTouched(true);
                  }}
                  aria-invalid={!durationValid}
                />{" "}
                seconds
              </span>
              {!durationValid ? (
                <span className="signage-field-error">{DURATION_RULE}</span>
              ) : (
                <span className="signage-field-hint">
                  {videoSeconds
                    ? `The video is ${videoSeconds.toFixed(1)} s; it loops if shown longer.`
                    : "How long it stays before the next advertisement, to a tenth of a second. Ignored when it's the only one."}
                </span>
              )}
              {videoMatch && durationValid && seconds !== videoMatch && (
                <button type="button" className="signage-link-btn" onClick={() => setDuration(formatSeconds(videoMatch))}>
                  Match the video's length ({formatSeconds(videoMatch)} s)
                </button>
              )}
            </label>

            <fieldset className="signage-field signage-schedule">
              <legend className="signage-field-label">Schedule</legend>
              <label className="signage-schedule-row">
                <span>Starts</span>
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                {startsAt && (
                  <button type="button" className="signage-link-btn" onClick={() => setStartsAt("")}>
                    Clear
                  </button>
                )}
              </label>
              <label className="signage-schedule-row">
                <span>Ends</span>
                <input
                  type="datetime-local"
                  value={endsAt}
                  min={startsAt || undefined}
                  onChange={(e) => setEndsAt(e.target.value)}
                  aria-invalid={!windowValid}
                />
                {endsAt && (
                  <button type="button" className="signage-link-btn" onClick={() => setEndsAt("")}>
                    Clear
                  </button>
                )}
              </label>
              {windowValid ? (
                <span className="signage-field-hint">Leave blank to start right away and run until you switch it off.</span>
              ) : (
                <span className="signage-field-error">The end has to be after the start.</span>
              )}
            </fieldset>

            <label className="signage-toggle">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <span className="signage-toggle-track" aria-hidden="true" />
              <span>
                <span className="signage-toggle-label">{active ? "On" : "Off"}</span>
                <span className="signage-field-hint">
                  {active ? "Plays on the kiosk during its schedule." : "Kept here, but never shown."}
                </span>
              </span>
            </label>

          </div>
        </div>

        {/* Outside the scrolling body, so Save is always in reach however
            tall the media makes the dialog. */}
        <div className="signage-editor-footer">
          {error ? (
            <div className="error-box signage-editor-error" role="alert">
              <p>{error}</p>
            </div>
          ) : (
            <span className="signage-field-hint">{saveHint({ title, media, crop, durationValid, windowValid })}</span>
          )}
          <div className="form-actions signage-editor-actions">
            <button type="button" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={!canSave}>
              {submitLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
