-- One-time data backfill, not a schema change. Email verification is being
-- (re)enforced at login as of this migration. Every account that already
-- exists at this point was created under a policy where verification was
-- either not required or already satisfied some other way -- grandfather
-- those in rather than retroactively locking out existing users. Only
-- accounts created AFTER this migration runs go through the normal
-- verify-before-first-login flow.
UPDATE "User" SET "emailVerified" = COALESCE("emailVerified", "createdAt") WHERE "emailVerified" IS NULL;
