// Translating an eBirder's notes into English, on the reviewer's own machine.
//
// Media notes are written by whoever uploaded the asset, in whatever language
// they use. A reviewer who can't read them is missing the one piece of context
// the photographer thought worth writing down — often the very thing that says
// whether it is a nest.
//
// This uses Chrome's built-in Translator and LanguageDetector (Chrome 138+,
// desktop), which run a model on the device. Nothing is uploaded, which is the
// only reason this is acceptable at all: field notes are the researcher's data
// and a cloud translation API would be sending them to a third party. If the
// APIs aren't there, every function here says so and the app shows the note
// exactly as it was written.
//
// The translation is never written to a spreadsheet. It is a reading aid; the
// original is the record.

/**
 * Both APIs, or neither — there is no useful half of this.
 *
 * Takes the object to look in so the caller can hand it a stand-in. Without
 * that, everything below is untestable anywhere but a Chrome new enough to
 * have the real thing, which is not where the tests run.
 */
export const canTranslate = (api = (typeof self !== 'undefined' ? self : null)) =>
  Boolean(api) && 'Translator' in api && 'LanguageDetector' in api;

/**
 * "es" -> "Spanish", for telling the reviewer what they are reading a
 * translation of. Falls back to the raw tag, which is still better than
 * nothing: "Show original (pt-BR)" is ugly but honest.
 */
export function languageName(code) {
  const tag = String(code ?? '').trim();
  if (!tag) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(tag) || tag;
  } catch {
    return tag;
  }
}

// Below this, a detection is a guess rather than an answer. Notes are short —
// "nest w/ 2 eggs" is barely a sentence — so detection is genuinely uncertain
// and translating on a coin-flip would corrupt the reviewer's understanding of
// a note that was probably English all along.
const MIN_CONFIDENCE = 0.6;

/**
 * The language worth translating from, or null to leave the note alone.
 *
 * Null covers three cases that all mean "show it as written": nothing
 * detected, English already, and a detection too weak to act on.
 */
export function pickLanguage(results, minConfidence = MIN_CONFIDENCE) {
  const [best] = Array.isArray(results) ? results : [];
  if (!best) return null;
  const code = String(best.detectedLanguage ?? '');
  if (!code || code === 'und') return null;
  if ((best.confidence ?? 0) < minConfidence) return null;
  if (code === 'en' || code.startsWith('en-')) return null;
  return code;
}

/** Thrown when Chrome wants a user gesture before it will build a model. */
export class NeedsGestureError extends Error {}

/**
 * The detector and one translator per source language, kept for the session.
 *
 * Chrome wants a user gesture before `create()`, so the first note in a
 * language cannot translate itself — the app offers a button, and the click
 * that presses it is the gesture. Everything after that is automatic, because
 * the instance built by that click is still here. Caching is what turns "click
 * per note" into "click once".
 */
export class Translators {
  constructor(api = self) {
    this.api = api;
    this.detector = null;
    this.byLanguage = new Map();
  }

  async detect(text) {
    if (!canTranslate(this.api)) return null;
    if (!this.detector) {
      this.detector = await this.#build(() => this.api.LanguageDetector.create());
    }
    return pickLanguage(await this.detector.detect(text));
  }

  async translate(text, sourceLanguage) {
    if (!canTranslate(this.api)) return null;
    let translator = this.byLanguage.get(sourceLanguage);
    if (!translator) {
      translator = await this.#build(() => this.api.Translator.create({
        sourceLanguage, targetLanguage: 'en',
      }));
      this.byLanguage.set(sourceLanguage, translator);
    }
    return translator.translate(text);
  }

  /** True once a gesture has bought us the models this note needs. */
  ready(sourceLanguage) {
    return Boolean(this.detector)
      && (!sourceLanguage || this.byLanguage.has(sourceLanguage));
  }

  /**
   * Chrome throws NotAllowedError when it wants a gesture it hasn't had. That
   * is not a failure — it is a "ask me again from a click" — so it is given
   * its own type rather than being reported as something broken.
   */
  async #build(create) {
    try {
      return await create();
    } catch (err) {
      if (err?.name === 'NotAllowedError') throw new NeedsGestureError(err.message);
      throw err;
    }
  }
}
