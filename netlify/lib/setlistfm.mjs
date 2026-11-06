// Shared by the setlist functions: reading setlist.fm's answers.
export const SEARCH = "https://api.setlist.fm/rest/1.0/search/setlists";

// setlist.fm's search is fuzzy, so results are checked against the artist with this
export const norm = (s) => String(s || "").toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");

// A setlist's songs in order, without tape intros and outros
export const songsOf = (r) => (r.sets?.set || []).flatMap((set) => set.song || [])
  .filter((song) => !song.tape && song.name)
  .map((song) => {
    if (song.cover?.name) return { name: song.name, cover: song.cover.name };
    return { name: song.name };
  });
