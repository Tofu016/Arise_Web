// The feedback form's state, as plain data plus transitions — no React, no
// DOM, no network. Star selection supports both a precise tap (selectStar)
// and a drag/slide across the row (startDrag/dragTo/endDrag), which is why
// rating and hoverRating are tracked separately from the drag bookkeeping.
//
// State: { rating, hoverRating, dragging, lastStar, comment, name, email,
//          submitting, submitted, error }
//   lastStar  the star the drag last touched, kept after the drag ends so
//             shouldPlaySfx can still see it while endDrag is deciding

export function initial() {
  return {
    rating: 0,
    hoverRating: 0,
    dragging: false,
    lastStar: 0,
    comment: "",
    name: "",
    email: "",
    submitting: false,
    submitted: false,
    error: "",
  };
}

export function displayRating(state) {
  return state.hoverRating || state.rating;
}

// Pointer down always starts a drag (so subsequent moves respond even if
// the initial tap missed a star), but only touches rating/hoverRating when
// it actually landed on one.
export function startDrag(state, star) {
  if (!star) return { ...state, dragging: true };
  return { ...state, dragging: true, rating: star, hoverRating: star, lastStar: star };
}

export function dragTo(state, star) {
  if (!state.dragging || !star) return state;
  return { ...state, rating: star, hoverRating: star, lastStar: star };
}

// Whether the drag/tap that's ending should pop the sfx — only once, for
// the star it actually settled on, not for every star it passed through.
export function shouldPlaySfx(state) {
  return state.dragging && !!state.lastStar;
}

export function endDrag(state) {
  return { ...state, dragging: false, hoverRating: 0 };
}

export function setRating(state, star) {
  return { ...state, rating: star };
}

export function setHover(state, star) {
  return { ...state, hoverRating: star };
}

export function clearHover(state) {
  return { ...state, hoverRating: 0 };
}

export function editField(state, field, value) {
  return { ...state, [field]: value };
}

// Matches Feedback_API's own server-side validation (1-5, rejected
// otherwise); rating is the only required field.
export function validate(state) {
  return state.rating < 1 ? "Please select a rating." : "";
}

export function buildPayload(state) {
  return {
    rating: state.rating,
    comment: state.comment.trim() || undefined,
    name: state.name.trim() || undefined,
    email: state.email.trim() || undefined,
  };
}

export function validationFailure(state, message) {
  return { ...state, error: message };
}

export function submitStart(state) {
  return { ...state, submitting: true, error: "" };
}

export function submitSuccess(state) {
  return { ...state, submitting: false, submitted: true, error: "" };
}

export function submitFailure(state, message) {
  return { ...state, submitting: false, error: message };
}
