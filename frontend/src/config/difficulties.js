import i18n from '../i18n';

export const PIECE_OPTIONS = [
  { id: "extra_easy", count: 6,  cols: 2, rows: 3, recommended: false },
  { id: "easy", count: 15, cols: 3, rows: 5, recommended: false },
  { id: "classic", count: 18, cols: 3, rows: 6, recommended: true },
  { id: "challenging", count: 28, cols: 4, rows: 7, recommended: false },
];

export const OCCASIONS = [
  { id: "love" },
  { id: "birthday" },
  { id: "anniversary" },
  { id: "congrats" },
  { id: "sorry" },
  { id: "missyou" },
  { id: "getwell" },
  { id: "thankyou" },
  { id: "newbaby" },
  { id: "justbecause" },
];

export const TONES = [
  { id: "romantic" },
  { id: "funny" },
  { id: "deep" },
  { id: "short" },
  { id: "poetic" },
  { id: "family" },
  { id: "friendship" },
  { id: "playful" },
];

export function suggestedMessage(occ, tone) {
  if (!occ || !tone) return "";
  // Translate dynamically using the active instance language
  return i18n.t(`messages.${occ}.${tone}`) || "";
}
