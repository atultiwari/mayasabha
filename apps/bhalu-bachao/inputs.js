// The ways a child can save Bear (pure checks on what the camera sees). Any one of them works.

const TOUCH_REACH = 1.25; // a hand counts a little beyond Bear's outline: small arms, big wall
const RED_MIN_AREA = 0.02; // of the camera frame: a cushion held up, not a red toy across the room

/** A hand (stage px) on or near Bear. bear: { x, y, w, h } centre and size, stage px. */
export function touchedBear(hands, bear) {
  return (hands ?? []).some((h) => Math.abs(h.x - bear.x) <= (bear.w / 2) * TOUCH_REACH && Math.abs(h.y - bear.y) <= (bear.h / 2) * TOUCH_REACH);
}

/** Both hands above the head: "STOP!" (body from kit/vision bodyFromPose, stage px, y down). */
export function armsUp(body) {
  if (!body || body.arms?.length < 2) return false;
  return body.arms.every((arm) => arm[arm.length - 1].y < body.head.y);
}

/** A big red patch held up to the camera, like a stop signal (outlines from blobOutlines, sizes 0..1). */
export function redSignal(outlines) {
  return (outlines ?? []).some((o) => o.size.w * o.size.h >= RED_MIN_AREA);
}

/**
 * Only the moment a child starts helping counts (arms going up, red appearing), so someone still
 * holding a pose from the last round doesn't save Bear the instant the next one begins.
 */
export const startsHelping = (wasHelping, isHelping) => isHelping && !wasHelping;
