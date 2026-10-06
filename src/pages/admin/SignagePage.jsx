import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../context/ToastContext";
import { useSignage } from "../../hooks/useSignage";
import KioskSignage from "../../components/KioskSignage";
import SignageMedia from "../../components/SignageMedia";
import SignageSlideEditor from "../../components/admin/SignageSlideEditor";
import { publicPhotoUrl } from "../../utils/photoStore";
import {
  DURATION_RULE,
  SIGNAGE_CATEGORIES,
  SIGNAGE_CATEGORY_IDS,
  SIGNAGE_MAX_SECONDS,
  SIGNAGE_MIN_SECONDS,
  describeWindow,
  formatSeconds,
  isVideoPath,
  mediaLibrary,
  parseDuration,
  reorderWithinCategory,
  serverClock,
  slideStatus,
  slidesInCategory,
} from "../../utils/signage";
import chevronIcon from "../../assets/icons/chevron-right.svg";
import { useConfirm } from "../../context/useConfirm";

const STATUS_LABELS = { live: "Live", scheduled: "Scheduled", ended: "Ended", off: "Off" };
// How often the Live/Scheduled/Ended badges are re-judged while the page
// stays open, so a run window starting or ending shows without a reload.
const STATUS_TICK_MS = 30 * 1000;

function mediaKindLabel(path) {
  if (isVideoPath(path)) return "Video";
  return /\.gif$/i.test(path) ? "GIF" : "Image";
}

// A round's length, e.g. "13.5 s" or "2 min 7.5 s". Summed in tenths so
// decimal durations don't pick up float noise (0.1 + 0.2).
function formatTotal(seconds) {
  const tenths = Math.round(seconds * 10);
  if (tenths < 600) return `${formatSeconds(tenths / 10)} s`;
  const m = Math.floor(tenths / 600);
  const rest = tenths % 600;
  return rest ? `${m} min ${formatSeconds(rest / 10)} s` : `${m} min`;
}

// Segmented choice (two or three options) for the rotation settings.
function Segmented({ name, value, options, onChange }) {
  return (
    <div className="signage-segmented" role="radiogroup">
      {options.map((opt) => (
        <label key={opt.id} className={"signage-segmented-opt" + (value === opt.id ? " signage-segmented-opt--on" : "")}>
          <input type="radio" name={name} value={opt.id} checked={value === opt.id} onChange={() => onChange(opt.id)} />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

function RotationSettings({ settings, onSave }) {
  const toast = useToast();
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const current = draft ?? settings;
  const seconds = parseDuration(current.defaultDurationSeconds);
  const valid = seconds !== null;
  const dirty =
    !!draft &&
    (draft.rotationOrder !== settings.rotationOrder ||
      draft.transition !== settings.transition ||
      seconds !== settings.defaultDurationSeconds);

  const update = (patch) => setDraft({ ...current, ...patch });

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ ...current, defaultDurationSeconds: seconds });
      setDraft(null);
    } catch {
      // useSignage's mutate already reported it.
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="signage-card signage-settings-card" aria-labelledby="signage-settings-title">
      <div className="signage-card-head">
        <h3 id="signage-settings-title">Rotation settings</h3>
      </div>
      <div className="signage-setting">
        <span className="signage-field-label">Order</span>
        <Segmented
          name="signage-order"
          value={current.rotationOrder}
          onChange={(rotationOrder) => update({ rotationOrder })}
          options={[
            { id: "sequence", label: "In list order" },
            { id: "shuffle", label: "Shuffle" },
          ]}
        />
        <span className="signage-field-hint">
          {current.rotationOrder === "shuffle"
            ? "A new random order every round; never the same one twice in a row."
            : "Top to bottom, as listed below, then starts over."}
        </span>
      </div>
      <div className="signage-setting">
        <span className="signage-field-label">Switching between advertisements</span>
        <Segmented
          name="signage-transition"
          value={current.transition}
          onChange={(transition) => update({ transition })}
          options={[
            { id: "fade", label: "Crossfade" },
            { id: "cut", label: "Instant" },
          ]}
        />
      </div>
      <label className="signage-setting">
        <span className="signage-field-label">Default time on screen</span>
        <span className="signage-inline-input">
          <input
            type="number"
            inputMode="decimal"
            min={SIGNAGE_MIN_SECONDS}
            max={SIGNAGE_MAX_SECONDS}
            step={0.1}
            value={current.defaultDurationSeconds}
            onChange={(e) => update({ defaultDurationSeconds: e.target.value })}
            aria-invalid={!valid}
          />{" "}
          seconds
        </span>
        <span className={valid ? "signage-field-hint" : "signage-field-error"}>
          {valid ? "Pre-filled for new images. A new video uses its own length." : DURATION_RULE}
        </span>
      </label>
      <div className="signage-settings-actions">
        {dirty && (
          <button type="button" className="signage-btn" onClick={() => {
              setDraft(null);
              toast.info("Changes cancelled.");
            }}
            disabled={saving}>
            Discard
          </button>
        )}
        <button type="button" className="signage-btn signage-btn--accent" onClick={save} disabled={!dirty || !valid || saving}>
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </section>
  );
}

function SlideRow({ slide, position, count, status, busy, onMove, onToggle, onEdit, onDelete }) {
  return (
    <li className={"signage-row" + (status === "live" ? "" : " signage-row--idle")}>
      <div className="signage-row-order">
        <button
          type="button"
          className="signage-icon-btn"
          onClick={() => onMove(-1)}
          disabled={busy || position === 0}
          aria-label={`Move "${slide.title}" up`}
          title="Move up"
        >
          <img src={chevronIcon} alt="" className="signage-chevron signage-chevron--up" />
        </button>
        <span className="signage-row-pos" aria-label={`Position ${position + 1} of ${count}`}>
          {position + 1}
        </span>
        <button
          type="button"
          className="signage-icon-btn"
          onClick={() => onMove(1)}
          disabled={busy || position === count - 1}
          aria-label={`Move "${slide.title}" down`}
          title="Move down"
        >
          <img src={chevronIcon} alt="" className="signage-chevron signage-chevron--down" />
        </button>
      </div>

      <button type="button" className="signage-row-thumb" onClick={onEdit} aria-label={`Edit "${slide.title}"`}>
        <SignageMedia src={publicPhotoUrl(slide.mediaPath)} video={isVideoPath(slide.mediaPath)} crop={slide.crop} />
      </button>

      <div className="signage-row-main">
        <span className="signage-row-title" title={slide.title}>
          {slide.title}
        </span>
        <span className="signage-row-meta">
          {mediaKindLabel(slide.mediaPath)} · {formatSeconds(slide.durationSeconds)} s · {describeWindow(slide.startsAt, slide.endsAt)}
        </span>
      </div>

      <span className={`signage-status signage-status--${status}`}>{STATUS_LABELS[status]}</span>

      <label className="signage-toggle signage-toggle--compact" title={slide.active ? "Switch off" : "Switch on"}>
        <input
          type="checkbox"
          checked={slide.active}
          disabled={busy}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`Show "${slide.title}" on the kiosk`}
        />
        <span className="signage-toggle-track" aria-hidden="true" />
      </label>

      <div className="signage-row-actions">
        <button type="button" className="signage-btn" onClick={onEdit} disabled={busy}>
          Edit
        </button>
        <button type="button" className="danger signage-btn" onClick={onDelete} disabled={busy}>
          Delete
        </button>
      </div>
    </li>
  );
}

// Advertisements (signage, see utils/signage.js) in two categories: footer
// advertisements in the white band along the bottom of the kiosk screen, and
// starting advertisements in the 16:9 rectangle on the kiosk starting screen.
// The page reads top to bottom as what the admin does: pick a category, see
// what's playing now, adjust how the rotation behaves, then manage the
// advertisements themselves. One uploaded file can be used by both
// categories; it is deleted only with the last advertisement using it.
export default function SignagePage() {
  const { confirm } = useConfirm();
  const {
    slides,
    settings,
    serverTime,
    readAt,
    loading,
    error,
    saveSlide,
    setSlideActive,
    deleteSlide,
    reorderSlides,
    saveSettings,
  } = useSignage();
  // null: closed; { slide: null }: adding; { slide }: editing.
  const [editor, setEditor] = useState(null);
  const [category, setCategory] = useState("footer");
  const [busyId, setBusyId] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), STATUS_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Judged on the server's clock, the one the kiosk's live list uses.
  const statuses = useMemo(() => {
    const now = serverClock(serverTime, readAt)();
    return Object.fromEntries(slides.map((s) => [s.id, slideStatus(s, now)]));
    // `tick` re-judges the same slides as time passes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, serverTime, readAt, tick]);

  const target = SIGNAGE_CATEGORIES[category];
  const categorySlides = slidesInCategory(slides, category);
  const library = useMemo(() => mediaLibrary(slides), [slides]);
  const liveSlides = categorySlides.filter((s) => statuses[s.id] === "live");
  const roundSeconds = liveSlides.reduce((sum, s) => sum + s.durationSeconds, 0);
  const anyBusy = busyId !== null;

  const run = async (id, fn) => {
    setBusyId(id);
    try {
      await fn();
    } catch {
      // useSignage's mutate already reported it.
    } finally {
      setBusyId(null);
    }
  };

  const move = (slide, delta) => {
    const ids = reorderWithinCategory(slides, slide.id, delta);
    if (ids) run(slide.id, () => reorderSlides(ids));
  };

  const remove = async (slide) => {
    const shared = slides.some((s) => s.id !== slide.id && s.mediaPath === slide.mediaPath);
    const fileNote = shared
      ? "Its file stays, because another advertisement still uses it."
      : "Its file is deleted too.";
    const ok = await confirm({
      title: "Delete advertisement?",
      message: `Delete "${slide.title}"? ${fileNote} This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    run(slide.id, () => deleteSlide(slide));
  };

  let liveSummary =
    category === "starting"
      ? "Nothing is playing. The starting screen shows no advertisement."
      : "Nothing is playing. The kiosk shows a plain white band.";
  if (liveSlides.length === 1) liveSummary = "1 advertisement playing, shown continuously.";
  else if (liveSlides.length > 1) {
    liveSummary = `${liveSlides.length} advertisements playing; one full round takes ${formatTotal(roundSeconds)}.`;
  }

  return (
    <div className="signage-page">
      <header className="signage-page-header">
        <div>
          <h2 className="admin-page-heading">Advertisements</h2>
          <p className="signage-page-intro">
            Images, GIFs and videos shown on the kiosk. Footer advertisements play in the band along the bottom of
            the screen ({SIGNAGE_CATEGORIES.footer.size.width} x {SIGNAGE_CATEGORIES.footer.size.height} px);
            starting advertisements play in the rectangle on the starting screen (
            {SIGNAGE_CATEGORIES.starting.size.width} x {SIGNAGE_CATEGORIES.starting.size.height} px). A file you
            uploaded for one can be reused for the other. Kiosks pick up changes within five minutes.
          </p>
        </div>
        <button type="button" className="signage-add-btn" onClick={() => setEditor({ slide: null })} disabled={!settings}>
          Add {target.noun}
        </button>
      </header>

      <div className="signage-tabs">
        <Segmented
          name="signage-category-tab"
          value={category}
          onChange={setCategory}
          options={SIGNAGE_CATEGORY_IDS.map((id) => ({
            id,
            label: `${SIGNAGE_CATEGORIES[id].label} (${slidesInCategory(slides, id).length})`,
          }))}
        />
      </div>

      {error && (
        <div className="error-box" role="alert">
          <p>Couldn't load advertisements: {error}</p>
        </div>
      )}

      {loading && <p className="empty-hint">Loading...</p>}

      {!loading && settings && (
        <>
          <div className="signage-top-grid">
            <section className="signage-card" aria-labelledby="signage-live-title">
              <div className="signage-card-head">
                <h3 id="signage-live-title">Playing now: {target.label.toLowerCase()}</h3>
                <span className="signage-card-sub">{liveSummary}</span>
              </div>
              <div className="signage-band-frame signage-band-frame--live" style={{ aspectRatio: target.aspect }}>
                {liveSlides.length > 0 ? (
                  <KioskSignage slides={liveSlides} settings={settings} />
                ) : (
                  <span className="signage-band-empty">{category === "starting" ? "Nothing shown" : "Plain white band"}</span>
                )}
              </div>
            </section>

            <RotationSettings settings={settings} onSave={saveSettings} />
          </div>

          <section className="signage-card" aria-labelledby="signage-list-title">
            <div className="signage-card-head">
              <h3 id="signage-list-title">All {target.label.toLowerCase()} advertisements</h3>
              {categorySlides.length > 1 && (
                <span className="signage-card-sub">
                  {settings.rotationOrder === "shuffle"
                    ? "Shuffle is on, so the order below is not used."
                    : "Played top to bottom. Use the arrows to change the order."}
                </span>
              )}
            </div>

            {categorySlides.length === 0 ? (
              <div className="signage-empty">
                <p className="signage-empty-title">No {target.noun}s yet</p>
                <p className="signage-field-hint">
                  Add an image, GIF or video, or reuse a file already uploaded. You'll crop it to the shape of{" "}
                  {target.where} before it goes live.
                </p>
                <button type="button" className="signage-add-btn" onClick={() => setEditor({ slide: null })}>
                  Add {target.noun}
                </button>
              </div>
            ) : (
              <ol className="signage-list">
                {categorySlides.map((slide, i) => (
                  <SlideRow
                    key={slide.id}
                    slide={slide}
                    position={i}
                    count={categorySlides.length}
                    status={statuses[slide.id]}
                    busy={anyBusy}
                    onMove={(delta) => move(slide, delta)}
                    onToggle={(active) => run(slide.id, () => setSlideActive(slide, active))}
                    onEdit={() => setEditor({ slide })}
                    onDelete={() => remove(slide)}
                  />
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      {editor && (
        <SignageSlideEditor
          slide={editor.slide}
          category={category}
          library={library}
          defaultDuration={settings?.defaultDurationSeconds}
          onSave={(draft) => saveSlide(editor.slide?.id ?? null, draft)}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
