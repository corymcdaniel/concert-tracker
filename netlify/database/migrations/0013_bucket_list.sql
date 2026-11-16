-- A night marked as a bucket list show: one you'd always wanted to see. Like rating and festival, it's written
-- to every act of the night and is public. true or NULL (not marked), never false, so it reads like the other extras.
ALTER TABLE shows ADD COLUMN bucket_list boolean;
