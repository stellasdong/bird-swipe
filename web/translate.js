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

const isEnglish = code => code === 'en' || code.startsWith('en-');

/**
 * The most likely language of a note, English and "don't know" aside.
 *
 * Confidence is not consulted. This is the answer to "what would this be, if
 * it is anything?", and it is deliberately easy to satisfy — see below.
 */
export function suggestLanguage(results) {
  const [best] = Array.isArray(results) ? results : [];
  if (!best) return null;
  const code = String(best.detectedLanguage ?? '');
  if (!code || code === 'und' || isEnglish(code)) return null;
  return code;
}

/**
 * The language worth translating from **without being asked**.
 *
 * Same answer as suggestLanguage, but only when the detector is sure. The two
 * exist separately because the cost of being wrong is not symmetric:
 *
 *   Translating an English note unasked replaces what the eBirder wrote with
 *   a machine's guess at it, and the reviewer may not notice.
 *   Offering a button nobody wanted costs a button.
 *
 * So the threshold guards the doing, and nothing guards the offering. That is
 * the fix for notes like "Tres huevos" — two words, correctly detected as
 * Spanish, and never with enough confidence to clear the bar. The old code
 * had one gate for both and left the reviewer looking at a note they could
 * not read with no way to ask.
 */
export function pickLanguage(results, minConfidence = MIN_CONFIDENCE) {
  const [best] = Array.isArray(results) ? results : [];
  const code = suggestLanguage(results);
  if (!code) return null;
  if ((best.confidence ?? 0) < minConfidence) return null;
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

  /**
   * What to do with a note: `auto` is a language confident enough to translate
   * unasked, `suggested` is the best guess at any confidence. Both null means
   * leave it alone.
   */
  async detect(text) {
    if (!canTranslate(this.api)) return null;
    if (!this.detector) {
      this.detector = await this.#build(() => this.api.LanguageDetector.create());
    }
    const results = await this.detector.detect(text);
    return { auto: pickLanguage(results), suggested: suggestLanguage(results) };
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
