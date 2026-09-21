import { useCountdown } from "../hooks/useCountdown";
import { AUTO_WALK_STEP_SECONDS } from "../hooks/useDirections";
import CountdownRing from "./CountdownRing";

const noop = () => {};

// The ring that drains until auto-walk's next step. Mount it with
// key={stepIndex} so it starts full again after every step; it only shows
// the wait, the step itself is fired by useAutoWalk.
export default function AutoWalkCountdown() {
  const remaining = useCountdown(AUTO_WALK_STEP_SECONDS, noop);
  return (
    <span className="auto-walk-countdown">
      <CountdownRing total={AUTO_WALK_STEP_SECONDS} remaining={remaining} />
    </span>
  );
}
