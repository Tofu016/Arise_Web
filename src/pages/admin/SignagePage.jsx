import { useEffect, useMemo, useState } from "react";
import { useSignage } from "../../hooks/useSignage";
import KioskSignage from "../../components/KioskSignage";
import SignageMedia from "../../components/SignageMedia";
import SignageSlideEditor from "../../components/admin/SignageSlideEditor";
import { publicPhotoUrl } from "../../utils/photoStore";
import { SIGNAGE_REFERENCE_SIZE } from "../../utils/kioskLayout";
import {
  DURATION_RULE,
  SIGNAGE_MAX_SECONDS,
  SIGNAGE_MIN_SECONDS,
  describeWindow,
  formatSeconds,
  isVideoPath,
  parseDuration,
  serverClock,
  slideStatus,
} from "../../utils/signage";
import chevronIcon from "../../assets/icons/chevron-right.svg";

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
        <span className="signage-field-label">Switching between ads</span>
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
          <button type="button" className="signage-btn" onClick={() => setDraft(null)} disabled={saving}>
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

// Advertisements: the media rotating in the white band along the bottom of
// the kiosk screen (signage, see utils/signage.js). The page reads top to
// bottom as what the admin does: see what's playing now, adjust how the
// rotation behaves, then manage the advertisements themselves.
export default function SignagePage() {
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

  const liveSlides = slides.filter((s) => statuses[s.id] === "live");
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

  const move = (index, delta) => {
    const ids = slides.map((s) => s.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved);
    run(moved, () => reorderSlides(ids));
  };

  const remove = (slide) => {
    if (!window.confirm(`Delete "${slide.title}"? Its file is deleted too. This can't be undone.`)) return;
    run(slide.id, () => deleteSlide(slide));
  };

  let liveSummary = "Nothing is playing. The kiosk shows a plain white band.";
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
            Images, GIFs and videos shown in the band along the bottom of the kiosk screen (
            {SIGNAGE_REFERENCE_SIZE.width} x {SIGNAGE_REFERENCE_SIZE.height} px). Several advertisements take turns;
            kiosks pick up changes within five minutes.
          </p>
        </div>
        <button type="button" className="signage-add-btn" onClick={() => setEditor({ slide: null })} disabled={!settings}>
          Add advertisement
        </button>
      </header>

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
                <h3 id="signage-live-title">Playing on the kiosk now</h3>
                <span className="signage-card-sub">{liveSummary}</span>
              </div>
              <div className="signage-band-frame signage-band-frame--live">
                {liveSlides.length > 0 ? (
                  <KioskSignage slides={liveSlides} settings={settings} />
                ) : (
                  <span className="signage-band-empty">Plain white band</span>
                )}
              </div>
            </section>

            <RotationSettings settings={settings} onSave={saveSettings} />
          </div>

          <section className="signage-card" aria-labelledby="signage-list-title">
            <div className="signage-card-head">
              <h3 id="signage-list-title">All advertisements</h3>
              {slides.length > 1 && (
                <span className="signage-card-sub">
                  {settings.rotationOrder === "shuffle"
                    ? "Shuffle is on, so the order below is not used."
                    : "Played top to bottom. Use the arrows to change the order."}
                </span>
              )}
            </div>

            {slides.length === 0 ? (
              <div className="signage-empty">
                <p className="signage-empty-title">No advertisements yet</p>
                <p className="signage-field-hint">
                  Add an image, GIF or video. You'll crop it to the band's shape before it goes live.
                </p>
                <button type="button" className="signage-add-btn" onClick={() => setEditor({ slide: null })}>
                  Add advertisement
                </button>
              </div>
            ) : (
              <ol className="signage-list">
                {slides.map((slide, i) => (
                  <SlideRow
                    key={slide.id}
                    slide={slide}
                    position={i}
                    count={slides.length}
                    status={statuses[slide.id]}
                    busy={anyBusy}
                    onMove={(delta) => move(i, delta)}
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
          defaultDuration={settings?.defaultDurationSeconds}
          onSave={(draft) => saveSlide(editor.slide?.id ?? null, draft)}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
