# Organic randomness regression report (2026-10-23)

This test was run against the actual game JavaScript and the 363-word bank, before publishing commit `ed813909fe0fb754f781d05908603ab1c6ee4b94`.

## Why it changed

The previous selector used a shuffle bag for impostors and always chose the least-used categories/groups. This forced nearly identical totals and made the first 100 category selections almost exactly 8 or 9 each. The current selector uses **weighted random choice**: less-used players, categories and groups remain favored, but they are no longer selected deterministically just because they have the lowest total. Recently used players/categories/groups also receive a soft penalty, while the immediately previous impostor is excluded outright.

The no-repeat word ledger is unchanged: once a word is drawn it cannot appear again until the user explicitly resets the 363-word deck.

## Regression tests

20 separate full runs of 500 successful rounds were simulated for **each** of the 5, 6 and 7 player modes: **30,000 successful round selections**, plus the exhaustion checks. Each run explicitly reset the word deck after round 363 to finish 500 rounds.

| Metric | 5 players | 6 players | 7 players |
|---|---:|---:|---:|
| Runs | 20 | 20 | 20 |
| Successful rounds | 10,000 | 10,000 | 10,000 |
| Average max/min impostor count spread across 500 rounds | 5.7 | 6.8 | 8.2 |
| Smallest observed spread | 2 | 2 | 4 |
| Largest observed spread | 12 | 11 | 13 |
| Category first-100 min/max observed | 3–14 | 4–12 | 4–13 |
| Repeated words before manual reset | 0 | 0 | 0 |
| Consecutive same impostor | 0 | 0 | 0 |
| Invalid six-choice guessing options or hint mismatches | 0 | 0 | 0 |
| Correct deck exhaustion after round 363 | 20 | 20 | 20 |

## Sample 500-round runs

| Player | 5-player game | 6-player game | 7-player game |
|---|---:|---:|---:|
| 1 | 99 | 82 | 72 |
| 2 | 99 | 77 | 70 |
| 3 | 101 | 87 | 72 |
| 4 | 99 | 83 | 71 |
| 5 | 102 | 84 | 70 |
| 6 | — | 87 | 74 |
| 7 | — | — | 71 |

### First 100 categories, 7-player sample

| Category | Selections |
|---|---:|
| مهن وشخصيات | 9 |
| أماكن | 9 |
| مواصلات | 9 |
| أكل وشرب | 5 |
| رياضة وألعاب | 7 |
| أغراض البيت | 9 |
| ملابس وإكسسوارات | 13 |
| تكنولوجيا | 6 |
| أغراض المدرسة | 12 |
| حيوانات | 8 |
| طبيعة وطقس | 6 |
| مناسبات وأحداث | 7 |

## Notes

This is a randomized regression test, so exact player totals vary on each run. Balance is a *soft* statistical tendency, not a strict per-block promise. The intentionally retained rules are **no repeat of any word before an explicit reset**, **no immediately repeated impostor within an uninterrupted session**, and **six distinct word guessing choices**. Refreshing the page restarts in-memory player-history balancing, while word-history persistence continues as before.
