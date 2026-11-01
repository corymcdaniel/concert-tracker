// Shared by the page and scripts/build-listening.mjs, so names match the same way in both.

// Log spellings that no amount of tidying will match to Spotify's name
const ALIASES = {
  daveattel: 'daveattell',
  idkhow: 'idontknowhowbuttheyfoundme',
  megtheestalion: 'megantheestallion',
};
const tidy = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Spotify and the log can spell a name differently: "The Cure" / "Cure", "Bjork" / "Björk", "A & B" / "A and B"
export const matchKey = name => {
  const key = tidy(name).replace(/^the\s+/, '').replace(/[&+]/g, 'and').replace(/[^\p{L}\p{N}]/gu, '');
  return ALIASES[key] ?? key;
};

// Spotify: "Song - Remastered 2011", "Song (feat. Someone)". setlist.fm: "Song".
export const songKey = title => tidy(title).replace(/\s+-\s.*$/, '').replace(/\s*[([].*$/, '').replace(/&/g, 'and').replace(/[^\p{L}\p{N}]/gu, '');
