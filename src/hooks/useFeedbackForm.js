import { useState } from "react";
import * as form from "../utils/feedbackForm";
import { apiPost } from "../utils/apiClient";
import { playSfx } from "../utils/sfx";
import starSelectSfx from "../assets/sounds/star-sfx-CREATIVE-COMMONS-ZERO.wav";

// Wraps the pure transitions in utils/feedbackForm.js and owns the seams
// that cross into the browser: the star row's hit-test, the settle sfx,
// and the submit request. onSubmitted fires right when the rating is
// accepted by the server, ahead of any thank-you countdown the caller runs.
//
// Returns the state fields plus:
//   handleStarPointerDown/Move, endStarDrag   wire onto the star row
//   selectStar, hoverStar, clearHover         tap/mouse-hover on one star
//   editField(field, value)                   comment/name/email
//   submit(event)                             validates, posts, updates state
export function useFeedbackForm({ onSubmitted } = {}) {
  const [state, setState] = useState(form.initial);

  const starAtPoint = (clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY)?.closest("[data-star]");
    return el ? Number(el.dataset.star) : null;
  };

  const handleStarPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const star = starAtPoint(e.clientX, e.clientY);
    setState((s) => form.startDrag(s, star));
  };

  const handleStarPointerMove = (e) => {
    const star = starAtPoint(e.clientX, e.clientY);
    setState((s) => form.dragTo(s, star));
  };

  const endStarDrag = () => {
    setState((s) => {
      if (form.shouldPlaySfx(s)) playSfx(starSelectSfx, { volume: 0.05 });
      return form.endDrag(s);
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const validationError = form.validate(state);
    if (validationError) {
      setState((s) => form.validationFailure(s, validationError));
      return;
    }
    setState(form.submitStart);
    try {
      await apiPost("Feedback_API/submit", form.buildPayload(state));
      setState(form.submitSuccess);
      onSubmitted?.();
    } catch (err) {
      const message = err.message || "Couldn't submit feedback. Please try again.";
      setState((s) => form.submitFailure(s, message));
    }
  };

  return {
    ...state,
    displayRating: form.displayRating(state),
    handleStarPointerDown,
    handleStarPointerMove,
    endStarDrag,
    selectStar: (star) => setState((s) => form.setRating(s, star)),
    hoverStar: (star) => setState((s) => form.setHover(s, star)),
    clearHover: () => setState((s) => form.clearHover(s)),
    editField: (field, value) => setState((s) => form.editField(s, field, value)),
    submit,
  };
}
