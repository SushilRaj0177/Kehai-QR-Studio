/**
 * Frosted glass that stays smooth while scrolling.
 *
 * A real `backdrop-filter: blur()` on the big panels re-blurs everything
 * behind them on every scroll frame (the background is fixed, so it moves
 * relative to the panels). Instead, each panel shows a pre-blurred image of
 * the page background (baked once by useFrost) in a fixed layer, revealed
 * through the panel by a clip-path the compositor moves for free.
 */
export function Glass() {
  return (
    <div className="glass" aria-hidden>
      <div className="backdrop backdrop--frost" />
    </div>
  );
}
