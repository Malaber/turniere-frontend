# Frontend Guide: Group Stage Decider Matches

This document explains the backend behavior that was added for TUR-58 and what the frontend now needs to do to support it correctly.

It is written as an implementation guide for `turniere-frontend`.

## Goal

The backend now supports decider matches inside a group when the normal ranking criteria are still tied and the tie affects qualification for the playoffs.

The frontend must:

- show why teams are tied or why one team is ahead
- show when a decider match is required
- allow the owner to create that decider match
- render decider matches differently from normal group matches
- edit hidden points for decider matches instead of normal points
- handle the new error when finishing the group stage while a relevant tie is still unresolved

## Business Rules

The ranking order in the backend is now:

1. `group_points`
2. `difference_in_points`
3. `scored_points`
4. direct comparison
5. hidden points from a decider match

Important:

- A decider match is only required if the unresolved tie crosses the advancing cutoff.
- Example: if 2 teams advance, a tie between places 1 and 2 or 2 and 3 blocks playoffs.
- A tie between places 3 and 4 must not block playoff generation, because neither team advances anyway.
- Decider matches do not contribute normal group points, scored points, or received points.
- Decider matches only contribute `hidden_points`, and those are only used as the final ranking criterion.

This is why a decider between places 2 and 3 must not accidentally push somebody to place 1 through normal score math.

## How Decider Matches Are Generated

The backend does not auto-create decider matches.

Instead, the frontend or operator flow must call:

`POST /groups/:group_id/matches`

with:

```json
{
  "team_ids": [12, 13]
}
```

Rules for that endpoint:

- the caller must be the tournament owner
- exactly 2 team ids must be sent
- both teams must already belong to that group
- the new match is appended at the end of the group's matches
- the created match is marked with `decider: true`
- the created match starts in `not_started`

The match then uses the normal match lifecycle:

1. `PATCH /matches/:id` with `{ "state": "in_progress" }`
2. `PATCH /match_scores/:score_id` with hidden points
3. `PATCH /matches/:id` with `{ "state": "finished" }`

The important difference is step 2:

- normal group matches update `points`
- decider matches must update `hidden_points`

## Backend Contract Changes

### Match payload

Matches now include:

```json
{
  "id": 99,
  "state": "finished",
  "position": 6,
  "decider": true,
  "winner": {
    "id": 12,
    "name": "G3-S1"
  },
  "match_scores": [
    {
      "id": 501,
      "points": 0,
      "hidden_points": 3,
      "team": { "id": 12, "name": "G3-S1" }
    },
    {
      "id": 502,
      "points": 0,
      "hidden_points": 1,
      "team": { "id": 13, "name": "G3-S2" }
    }
  ]
}
```

Notes:

- `decider` is the key flag that tells the frontend this is not a normal group match.
- For decider matches, `winner` is derived from `hidden_points`.
- For decider matches, `points` should not be treated as the visible score.

### Match score payload

`match_scores` now include:

- `points`
- `hidden_points`

The frontend needs both fields in state.

### Group score payload

`group_scores[].ranking_decision` is now richer.

Example:

```json
{
  "resolved_by": "direct_comparison",
  "compared_with_team_id": 13,
  "compared_with_team_name": "G3-S2",
  "direct_comparison_result": "won",
  "direct_comparison_match_id": 45,
  "hidden_points_result": "not_played",
  "decider_match_id": null,
  "tied": false,
  "needs_decider_match": false
}
```

Possible values:

- `resolved_by`: `group_points`, `difference_in_points`, `scored_points`, `direct_comparison`, `hidden_points`, `tie`
- `direct_comparison_result`: `won`, `lost`, `draw`, `not_played`
- `hidden_points_result`: `won`, `lost`, `draw`, `not_played`
- `needs_decider_match`: `true` only when the tie matters for advancement
- `decider_match_id`: the match id of the created decider, if one exists

### Finish group stage error

When the owner tries to finish the group stage and a relevant tie still needs a decider, the backend returns `422`:

```json
{
  "error": "Playoffs cannot be generated yet because a decider match is required for an advancing place",
  "blocking_ties": [
    {
      "group_id": 7,
      "group_number": 2,
      "team_ids": [12, 13],
      "team_names": ["G3-S1", "G3-S2"],
      "ranking_decision": {
        "resolved_by": "tie",
        "compared_with_team_id": 13,
        "compared_with_team_name": "G3-S2",
        "direct_comparison_result": "draw",
        "direct_comparison_match_id": 45,
        "hidden_points_result": "not_played",
        "decider_match_id": null,
        "tied": true,
        "needs_decider_match": true
      }
    }
  ]
}
```

The frontend should surface this clearly instead of showing a generic failure toast.

## What The Frontend Currently Loses

At the moment the frontend is not ready for this backend contract.

### `js/redux/tournamentApi.js`

Current problems:

- `convertMatch` ignores `apiMatch.decider`
- `convertMatch` only maps `match_scores[*].points`
- `convertMatch` does not keep `hidden_points`
- `convertGroup` keeps raw `group_scores`, but there is no normalization around `ranking_decision`

Because of that, decider matches currently arrive but cannot be rendered correctly.

### `js/components/GroupStage.js`

Current problems:

- the group score table only renders `position`, `team.name`, `group_points`, `difference_in_points`, `scored_points`
- `ranking_decision` is ignored completely
- no UI exists for "decider needed"
- no UI exists for "resolved by direct comparison" or "resolved by hidden points"
- no owner action exists to create `POST /groups/:group_id/matches`

### `js/components/Match.js`

Current problems:

- finished messaging assumes normal match semantics
- no "Entscheidungsmatch" labeling
- card badge only shows group and position
- the local match state only updates `team1.score` and `team2.score`

### `js/components/MatchTable.js`

Current problems:

- it always shows `score`
- it has no way to display hidden points as a different score type
- there is no decider-specific label

### `js/components/MatchModal.js`

Current problems:

- score editing always calls `submitMatchScores(...)` with normal `points`
- end-match validation assumes normal visible scores
- there is no decider mode that edits hidden points

### `js/api.js`

Current problems:

- `SUBMIT_MATCH_SCORES` only patches `{ points: ... }`
- there is no action for creating a decider match
- there is no action for patching hidden points instead of points
- there is no specialized handling for the new `blocking_ties` stage-finish response

## Recommended Frontend Data Shape

The simplest safe approach is to normalize decider information immediately in `convertMatch`.

Recommended frontend match structure:

```js
{
  id,
  state,
  decider,
  allowUndecided,
  winnerTeamId,
  position,
  group,
  scoreMode: decider ? 'hidden_points' : 'points',
  team1: {
    id,
    name,
    score,
    hiddenScore,
    scoreId
  },
  team2: {
    id,
    name,
    score,
    hiddenScore,
    scoreId
  }
}
```

Recommended rule:

- keep both `score` and `hiddenScore` in state
- derive the displayed score from `scoreMode`

That keeps normal matches untouched and makes decider rendering explicit.

## Visual Changes Needed

### 1. Show ranking explanation in the group table

Each row in the group table should show why the row is on that rank when a tie exists.

Recommended extra column or sub-line:

- `Direkter Vergleich gegen <team> gewonnen`
- `Direkter Vergleich gegen <team> verloren`
- `Entscheidungsmatch gegen <team> gewonnen`
- `Entscheidungsmatch gegen <team> verloren`
- `Entscheidungsmatch gegen <team> erforderlich`

Recommended rendering behavior:

- only show explanatory text if `ranking_decision` exists
- use a warning style if `needs_decider_match === true`
- use a neutral informative style for direct comparison
- use a success style when resolved by hidden points

### 2. Highlight rows that still block playoff creation

When `ranking_decision.needs_decider_match === true`, the affected rows should stand out.

Recommended visual treatment:

- warning badge or icon on both tied teams
- helper text below the team name
- optional action button for owners: `Entscheidungsmatch anlegen`

### 3. Render decider matches as a separate visual type

Decider matches should not look like ordinary group matches.

Recommended additions on the match card:

- badge: `Entscheidungsmatch`
- subtitle: `Zaehlt nur als Tie-Breaker`
- score label: `Hidden Points` or German equivalent such as `Tie-Breaker`

Recommended behavior:

- keep them inside the group they belong to
- sort them by `position` like normal matches
- visually separate them from ordinary round-robin matches

### 4. Match modal must switch scoring mode

For normal group matches:

- edit `points`

For decider matches:

- edit `hidden_points`
- do not call the score fields "Punkte" if that is confusing with group points
- use a label that makes clear that these points only decide the tie

Recommended wording:

- `Verdeckte Punkte`
- `Tie-Breaker Punkte`
- `Nur fuer Entscheidungsmatch relevant`

### 5. Stage-finish error must be actionable

When finishing the group stage fails with `blocking_ties`, the owner should not just see:

- `Die Phase konnte nicht beendet werden`

Instead the UI should say:

- which group is blocked
- which teams are involved
- that a decider match is required before playoffs can start

Best case:

- scroll to the affected group
- show the `Entscheidungsmatch anlegen` action right there

## Recommended UX Flow

### Owner flow when a relevant tie exists

1. The group table shows both tied teams with `Entscheidungsmatch erforderlich`.
2. The owner clicks `Entscheidungsmatch anlegen`.
3. The frontend calls `POST /groups/:group_id/matches`.
4. The group reloads.
5. A new match appears in the match list as `Entscheidungsmatch`.
6. The owner starts the match.
7. The owner edits hidden points.
8. The owner finishes the match.
9. The group reloads.
10. The ranking explanation switches from `needs_decider_match` to `resolved_by: hidden_points`.
11. Finishing the group stage now succeeds.

### Viewer flow

Viewers should be able to understand:

- why the ranking is not final yet
- that a specific extra match exists only to break the tie
- that the decider does not change the normal group points table

## Concrete Implementation Steps

### Step 1: extend match conversion

Update `js/redux/tournamentApi.js`:

- map `apiMatch.decider`
- map `match_scores[*].hidden_points`
- keep both regular score and hidden score
- expose a derived display mode

### Step 2: normalize ranking decision on group scores

Still in `js/redux/tournamentApi.js`:

- normalize `ranking_decision`
- keep `direct_comparison_match_id`
- keep `decider_match_id`
- keep `needs_decider_match`

The group table should not need to inspect raw backend JSON everywhere.

### Step 3: add decider match creation action

Add a new API action in `js/api.js`:

- `createDeciderMatch(groupId, teamIds, successCallback, errorCallback)`

This should call:

`POST /groups/:group_id/matches`

### Step 4: add hidden score submit action

Do not overload the existing score submit silently.

Better options:

- add `submitDeciderMatchScores(...)`
- or extend `submitMatchScores(...)` with a score mode parameter

Recommended payload for decider matches:

```js
patch('/match_scores/:id', { hidden_points: value })
```

### Step 5: adapt `MatchModal`

`MatchModal` needs a decider-aware mode:

- button text should reflect hidden points
- the editable table should display the decider score field
- finishing must still be blocked on equality for knockout-style matches if the backend expects a winner

For decider matches, equality of hidden points should keep `winner === null`, so the owner should not be able to finish the match while tied.

### Step 6: adapt `GroupStage`

`GroupStage` should:

- show ranking explanation per row
- show owner action for unresolved relevant ties
- show decider matches in the match list

Recommended deduplication rule for the action button:

- render the create button only once per tied pair
- easiest source of truth is `ranking_decision.compared_with_team_id`
- only show the button on the row where `team.id < compared_with_team_id`

Also:

- if `decider_match_id` already exists, show a link, badge, or scroll target instead of a create button

### Step 7: adapt finish-group-stage handling

Wherever the owner currently finishes the group stage:

- inspect `422` responses
- if `error` matches the decider-required message, surface `blocking_ties`

Recommended UI copy:

- `Playoffs koennen noch nicht gestartet werden.`
- `Zwischen Team A und Team B ist ein Entscheidungsmatch fuer das Weiterkommen noetig.`

### Step 8: review fullscreen and statistics pages

Statistics:

- normal statistics remain valid because decider matches are excluded from group stats
- but if ranking explanations are shown on the main tournament page, consider whether the statistics page should also reference them

Fullscreen:

- decide whether decider matches should be shown in the normal group fullscreen list
- if yes, label them clearly as `Entscheidungsmatch`

## Suggested UI Text

Use consistent wording everywhere. Suggested German labels:

- `Entscheidungsmatch`
- `Direkter Vergleich`
- `Tie-Breaker`
- `Verdeckte Punkte`
- `Entscheidung fuer Platzierung`
- `Entscheidungsmatch erforderlich`
- `Zaehlt nicht fuer die normalen Gruppenpunkte`

## Edge Cases To Support

### Tie between places 1 and 2, 2 teams advance

Expected:

- no decider required
- both teams advance anyway
- only ranking explanation matters if order is needed visually

Important note:

The backend only requires a decider when the unresolved tie crosses the advancing cutoff.

So the frontend must trust `needs_decider_match`, not invent its own rule from visible positions.

### Tie between places 2 and 3, 2 teams advance

Expected:

- decider required
- group stage finish blocked until resolved

### Tie between places 3 and 4, 2 teams advance

Expected:

- no decider required
- playoffs can be started
- still acceptable to show that the teams remain tied

### Decider match exists but is not finished

Expected:

- show the decider match in the match list
- keep warning that ranking is not final
- group stage finish should still fail if the tie is relevant

### Decider match finished and hidden points decide the tie

Expected:

- group table shows final rank order
- explanatory text references hidden points / decider
- no blocking warning remains

## Suggested E2E Coverage

The frontend E2E suite should eventually cover:

1. Group page shows `Entscheidungsmatch erforderlich` for a relevant unresolved tie.
2. Owner can create the decider match from the affected group.
3. The new decider match card is rendered with a dedicated label.
4. Owner edits hidden points, not normal points.
5. After finishing the decider, the ranking explanation changes to a resolved state.
6. Finishing the group stage fails with the actionable blocking message before the decider.
7. Finishing the group stage succeeds after the decider.
8. A non-relevant tie, for example 3 vs 4 when only top 2 advance, does not block playoffs.

## Minimum File Set To Change

At minimum, expect changes in:

- `js/redux/tournamentApi.js`
- `js/api.js`
- `js/components/GroupStage.js`
- `js/components/Match.js`
- `js/components/MatchTable.js`
- `js/components/MatchModal.js`
- likely `js/components/EditableMatchTable.js`

Possibly also:

- fullscreen pages
- tournament statistics page
- E2E scenario helpers and Playwright tests

## Summary

The backend side is already done.

Frontend support now mainly means:

- keep the new backend fields instead of dropping them
- represent decider matches as a distinct group-match subtype
- edit hidden points for deciders
- explain ranking decisions in the group table
- make the "group stage cannot be finished yet" case actionable for owners

If the frontend does only one thing, it must not treat decider matches as normal group matches.
That is the most important invariant to preserve visually and behaviorally.
