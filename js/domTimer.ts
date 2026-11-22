/**
 * DOM-sichere Timer für Produktivcode.
 *
 * Ein Timer, den ein Test startet, feuert nach dem jsdom-Abriss weiter. Die
 * Callbacks greifen auf `document`/`window` zu und werfen dann als Unhandled
 * Rejection bzw. Uncaught Exception. vitest zaehlt das als `Errors 1 error`,
 * ohne dass ein einziger Test rot wird — dreimal belegt (TimeManager-Intervall,
 * TutorController-Debounce, StandardMode-Timeout). Ein Guard pro Callback zu
 * setzen ist Whack-a-Mole: der naechste Timer taucht auf.
 *
 * Hier sitzt der Guard zentral und in einer Form, die dieselbe Argumentreihenfolge wie
 * `setTimeout` hat — die Aufrufstellen sind ein reiner Text-Tausch. Im Browser
 * ist das Verhalten identisch, in Node ohne DOM macht der Callback nichts.
 */

const hasDom = (): boolean => typeof document !== 'undefined';

/** Wie `setTimeout`, aber ohne Wirkung, sobald das DOM abgerissen ist. */
export function afterDom(
  fn: (..._args: never[]) => void,
  ms?: number,
  ..._args: unknown[]
): ReturnType<typeof setTimeout> {
  return setTimeout((...a: unknown[]) => {
    if (!hasDom()) return;
    fn(...(a as never[]));
  }, ms, ..._args);
}

/** Wie `setInterval`, aber ohne Wirkung ohne DOM. */
export function everyDom(
  fn: (..._args: never[]) => void,
  ms?: number,
  ..._args: unknown[]
): ReturnType<typeof setInterval> {
  return setInterval((...a: unknown[]) => {
    if (!hasDom()) return;
    fn(...(a as never[]));
  }, ms, ..._args);
}

/** Wie `requestAnimationFrame`, aber ohne Wirkung ohne DOM. */
export function frameDom(fn: (..._args: never[]) => void): ReturnType<typeof requestAnimationFrame> {
  return requestAnimationFrame(() => {
    if (!hasDom()) return;
    fn();
  });
}
