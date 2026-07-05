# Project memory

## Workflow preferences

- **Always open a pull request** for completed work on a feature branch — don't
  stop at pushing the branch.
- **Never enable auto-merge and never merge a PR** until the repo owner
  explicitly says to. Open the PR, then leave it for review.
- **Always surface the live preview link** when reporting a newly opened (or
  updated) PR. This repo's `pr-preview.yml` workflow deploys every PR to
  `https://inko9nito.github.io/pt-exercises/pr-<number>/` and posts it as a
  sticky PR comment (marker `<!-- pr-preview-link -->`) — fetch that comment
  (`pull_request_read` method `get_comments`, or `get_check_runs` for the
  `deploy-preview` job status if the comment hasn't landed yet) and include the
  URL in the reply. Don't just link the PR page itself.

## Retrieving images attached to GitHub issues / PRs

Issue and PR attachments render as `https://github.com/user-attachments/assets/<uuid>`.
In the sandboxed web/CI environment, a direct `curl` of that URL is intercepted
by the GitHub API proxy and returns a JSON error
(`"sessions are bound to their configured repositories"`) instead of the image —
so fetching the `github.com` URL directly will always fail. Don't conclude the
image is unreachable from that error. Retrieve it like this:

1. Call the **WebFetch** tool on the `github.com/user-attachments/assets/<uuid>`
   URL. It won't return the image, but it reports `REDIRECT DETECTED` with a
   signed S3 URL
   (`https://github-production-user-asset-*.s3.amazonaws.com/...?X-Amz-...`).
2. `curl -sSL -o image.png "<signed-s3-url>"` — that S3 host is reachable, so
   this downloads the actual bytes.
3. Open the downloaded file with the **Read** tool to view it.

The signed URL expires quickly (`X-Amz-Expires=300`, ~5 minutes), so download it
promptly after WebFetch hands it back; re-run WebFetch to mint a fresh one if it
lapses.
