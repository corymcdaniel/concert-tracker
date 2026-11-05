-- The festival a night was part of ("Dia de los Deftones", "Kilby Block Party"). Like rating, it's
-- written to every act of the night and is public. Set by hand on Edit bill, never guessed from the
-- venue: a stadium or park hosts plenty of nights that aren't festivals. A festival that runs several
-- days is one night per day, each with the same name.
ALTER TABLE shows ADD COLUMN festival text;
