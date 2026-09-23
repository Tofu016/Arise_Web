import { describe, it, expect } from "vitest";
import * as form from "./feedbackForm";

describe("initial state", () => {
  it("starts blank with nothing rated or submitted", () => {
    expect(form.initial()).toMatchObject({
      rating: 0, hoverRating: 0, dragging: false, lastStar: 0,
      comment: "", name: "", email: "",
      submitting: false, submitted: false, error: "",
    });
  });
});

describe("displayRating", () => {
  it("prefers the hover rating while hovering", () => {
    expect(form.displayRating({ rating: 2, hoverRating: 4 })).toBe(4);
  });

  it("falls back to the committed rating otherwise", () => {
    expect(form.displayRating({ rating: 2, hoverRating: 0 })).toBe(2);
  });
});

describe("tap selection", () => {
  it("setRating commits a rating outright", () => {
    expect(form.setRating(form.initial(), 3)).toMatchObject({ rating: 3 });
  });

  it("setHover/clearHover preview without committing", () => {
    const hovered = form.setHover(form.initial(), 5);
    expect(hovered).toMatchObject({ rating: 0, hoverRating: 5 });
    expect(form.clearHover(hovered)).toMatchObject({ hoverRating: 0 });
  });
});

describe("dragging", () => {
  it("startDrag begins dragging even off a star, without touching the rating", () => {
    expect(form.startDrag(form.initial(), null)).toMatchObject({
      dragging: true, rating: 0, hoverRating: 0, lastStar: 0,
    });
  });

  it("startDrag on a star commits rating, hoverRating and lastStar", () => {
    expect(form.startDrag(form.initial(), 3)).toMatchObject({
      dragging: true, rating: 3, hoverRating: 3, lastStar: 3,
    });
  });

  it("dragTo ignores moves while not dragging", () => {
    const state = form.initial();
    expect(form.dragTo(state, 4)).toBe(state);
  });

  it("dragTo ignores moves off any star", () => {
    const dragging = form.startDrag(form.initial(), 2);
    expect(form.dragTo(dragging, null)).toBe(dragging);
  });

  it("dragTo slides the rating to whichever star the pointer is over", () => {
    const dragging = form.startDrag(form.initial(), 2);
    expect(form.dragTo(dragging, 5)).toMatchObject({ rating: 5, hoverRating: 5, lastStar: 5 });
  });

  it("shouldPlaySfx is true only mid-drag, having touched a star", () => {
    expect(form.shouldPlaySfx(form.initial())).toBe(false);
    expect(form.shouldPlaySfx(form.startDrag(form.initial(), null))).toBe(false);
    expect(form.shouldPlaySfx(form.startDrag(form.initial(), 3))).toBe(true);
  });

  it("endDrag stops dragging and clears the hover preview", () => {
    const dragging = form.startDrag(form.initial(), 3);
    expect(form.endDrag(dragging)).toMatchObject({ dragging: false, hoverRating: 0, rating: 3 });
  });
});

describe("fields", () => {
  it("editField updates the named field only", () => {
    const state = form.editField(form.initial(), "comment", "Great tour");
    expect(state).toMatchObject({ comment: "Great tour", name: "", email: "" });
  });
});

describe("validate", () => {
  it("requires a rating", () => {
    expect(form.validate(form.initial())).toBe("Please select a rating.");
  });

  it("passes once a rating is set", () => {
    expect(form.validate(form.setRating(form.initial(), 1))).toBe("");
  });
});

describe("buildPayload", () => {
  it("trims text fields and drops empty ones to undefined", () => {
    const state = { ...form.initial(), rating: 5, comment: "  nice  ", name: "", email: "  " };
    expect(form.buildPayload(state)).toEqual({
      rating: 5, comment: "nice", name: undefined, email: undefined,
    });
  });
});

describe("submit transitions", () => {
  it("validationFailure sets the error without touching submitting", () => {
    expect(form.validationFailure(form.initial(), "Please select a rating.")).toMatchObject({
      error: "Please select a rating.", submitting: false,
    });
  });

  it("submitStart clears any prior error and flags submitting", () => {
    const errored = form.validationFailure(form.initial(), "oops");
    expect(form.submitStart(errored)).toMatchObject({ submitting: true, error: "" });
  });

  it("submitSuccess flags submitted and clears submitting", () => {
    const inFlight = form.submitStart(form.initial());
    expect(form.submitSuccess(inFlight)).toMatchObject({ submitting: false, submitted: true, error: "" });
  });

  it("submitFailure clears submitting and records the error", () => {
    const inFlight = form.submitStart(form.initial());
    expect(form.submitFailure(inFlight, "Couldn't submit feedback.")).toMatchObject({
      submitting: false, submitted: false, error: "Couldn't submit feedback.",
    });
  });
});
