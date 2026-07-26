# Database migrations

This repo has no Supabase CLI wired up (`npx supabase` fails on at least one
dev machine used on this project: `Error: No matching Supabase CLI binary
package found for win32-x64`), so schema changes aren't auto-applied. That's
exactly what let `admin_invites` sit unapplied for hours after being written
and committed -- the file existed, but nothing forced anyone to actually run
it.

## The rule

**Every schema change gets a new file in this directory first, committed to
git -- before it's ever pasted into the Supabase Dashboard > SQL Editor.**
Never the other way around. Writing the file *is* the reminder to run it;
running SQL ad hoc in the dashboard with no matching file here is exactly
the failure mode this convention exists to prevent.

## Naming

`<14-digit-timestamp>_<short-name>.sql`, e.g. `20260726135400_admin_invites.sql`.
Timestamp format is `YYYYMMDDHHMMSS` (UTC), matching what the Supabase CLI's
own migration tooling expects -- so if the CLI becomes usable in this
environment later, `supabase db pull`/`db push` can adopt these files
directly with no renaming.

## Workflow

1. Write the new `.sql` file here, in a new commit.
2. Copy its contents into the Supabase Dashboard (Project > SQL Editor) and
   run it against the live database.
3. If it's a table/policy change, spot-check it in the Table Editor
   afterward (this is how the missing `admin_invites` table was caught).

## Applying to a fresh project

Run every file in this directory, in filename order, in the SQL Editor.
