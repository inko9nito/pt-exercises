# Working on this repo

## Issue-driven branch workflow

Whenever asked to make a change:

1. **Figure out the issue.** If the request references a GitHub issue (by number, or a description that matches an open one), that issue drives the work. If we're already mid-task on a branch/issue this session, keep using it — don't start a new branch on top of unfinished work.
2. **Branch per issue.** Create a new branch off `main` named `claude/issue-<N>-<slug>` (matching the existing convention, e.g. `claude/issue-54-c0n040`). One branch per issue.
3. **Comment on the issue at every checkpoint**, not just at the start and end: when you start (approach/plan), whenever something breaks or you hit a blocker/decision point, and when the PR is ready. Keep the issue readable as a running log of what's happening, not a wall of noise — checkpoint comments should be substantive (what changed, what broke, what's still open), not "still working on it" filler.
4. **Open one PR against `main`** as soon as there's something to review. Don't create a separate review/staging branch or a first "review-only" PR — this repo's `pr-preview.yml` workflow already builds and deploys every open PR to a live preview URL (posted as a sticky comment on the PR by that workflow) regardless of its base branch, so a normal PR against `main` *is* the pre-prod review environment. Point the user at the PR and its preview link and wait for explicit approval — never merge on your own judgment.
5. **On explicit approval to merge:** merge that same PR into `main` (never open a second PR for this) and close the linked issue with a final comment summarizing what shipped and any known caveats or limitations.
6. **Follow-up work never gets buried in a closed issue.** If finishing the work surfaces follow-up items, file each as its own new GitHub issue (don't just leave them as a note on the issue being closed) and reference them from the closing comment, since closed issues don't get revisited for follow-ups.
