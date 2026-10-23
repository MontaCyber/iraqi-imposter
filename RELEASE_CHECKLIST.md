# منو الدخيل؟ — Deep-audit remediation and production checklist

**Candidate:** v1.5.0. Changes are on a QA branch until automated checks pass and a pull request is merged.

## Fixed code-level defects

| Audit | Action | Evidence |
|---|---|---|
| A01 Secret-word hint disclosure | Removed the leaking food clue; sanitize all hint variants and question starters against all candidate words at runtime | Static bank checks + repeated full-deck simulations |
| A02 Legacy score resurrection | Legacy import is one-time in `core.initial`; removed accidental reimport from `saveRoster` | Reset → Start → Reload regression |
| A03 Duplicated-tab overwrite | New per-document token (never in cloneable sessionStorage), storage revision check and pagehide release | Tab clone, stale owner, takeover tests |
| A04 Dormant question banks | Use the actual ten group question angles; keep special per-word questions editorial-only because showing them reveals the answer | Every drawn hint pair must come from its safe group |
| A05 Old JavaScript pinned by service worker | New v5 asset URLs and precache; network-first with offline fallback | Simulated release-A/release-B update and offline reload |
| A06 QA-gated publishing | New Pages publish job depends on engine, offline, Chromium and WebKit tests; publish only verified public files | GitHub Actions pipeline |
| A07 Skippable discussion | Ordinary ending requires one question cycle covering all players. Host may explicitly override | 3–10 player tests |
| A08 Removing one word disables six options | Warn about total group impact before disabling | UI confirmation test |
| A11 Unequal question recipients | Each cycle chooses separate random asker and target permutations without self-questions | 3–10 player cycle tests |
| A12 Duplicate saved player IDs | Repair IDs and decline to restore ambiguous active secrets | Malformed-save test |
| A13 Short vocabulary | 526 unique Iraqi nouns/topics in 15 categories, each in a 6+ candidate group | Dynamic 526-word full-deck tests |
| A16 Local backup fragility | JSON export and validated JSON restore | Real Chromium browser tests |
| A17 Cross-engine confidence | Added Linux WebKit tests to the existing Chromium small-screen and offline suite | GitHub Actions browser jobs |
| A18 CSP hardening | Moved CSS to external stylesheet, CSP with same-origin scripts and no inline JavaScript | Browser smoke tests |

## Preserved product decisions

- **A09/A10:** Keep organic role variation instead of perfectly scripted equal rotation. The previous 500-round randomizer was perceived as unnaturally balanced; do not change that without an explicit setting.
- **A14:** 526 entries selected for recognizable nouns/topics; some might still be awkward in specific Iraqi groups. The word-review UI allows exclusion and inspection of hints and ten prompts. Human Iraqi playtesting is not replaceable with a scripted test.
- **A15:** No mandatory voting. The gameplay remains word guessing, with a clearly labeled host-controlled early exit.

## Remaining external verifications

- Real iPhone Safari, physical Android Chrome, phone sleep/low-memory OS behaviors and screen-reader walkthrough require physical-device access.
- GitHub Pages currently has an independent legacy “pages build and deployment” workflow. The new tested publish job cannot by itself guarantee that legacy branch publishing is disabled. Confirm **Settings → Pages → Build and deployment → Source: GitHub Actions**, so only the QA-gated workflow publishes.
- Verify the actual live Pages address after the deployment run succeeds; GitHub Actions success on a PR is not proof that a new commit is already live.
- Test gameplay with actual Iraqi players and mark poor words in the review UI. Do not claim editorial certification based on word count.

## Release rules

1. All Node, offline, Chromium and WebKit CI jobs must pass.
2. The PR must be reviewed and merged only after green checks.
3. The verified commit must be published through the QA-gated workflow, and the deployed URL checked.
4. No new hardcoded or candidate-word hints; no automatic reset of used words; no duplicate per-round impostors.
