// Shared by the page (autoinfo.js) and scripts/build-listening.mjs, so artists are matched to Wikipedia the same way in both.

// A page only counts if its short description says it's a performer
export const MUSICAL = /\b(band|(super)?group|musician|singer|rapper|songwriter|dj|producer|composer|(super)?duo|trio|quartet|orchestra|ensemble|guitarist|drummer|pianist|comedian|music|artist)\b/i;
// Tried in order: the bare name, then the usual ways Wikipedia tells same-named pages apart
export const PAGE_SUFFIXES = ["", " (band)", " (musician)", " (American band)", " (English band)", " (British band)", " (French band)", " (Canadian band)", " (Australian band)", " (rapper)", " (singer)"];
// "IDLES" -> "Idles": Wikipedia titles all-caps names in title case
export const pageName = name => {
  if (name.length > 1 && name === name.toUpperCase()) return name[0] + name.slice(1).toLowerCase();
  return name;
};
