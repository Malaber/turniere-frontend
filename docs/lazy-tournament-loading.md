# Lazy tournament loading

`/t/:id` renders the page shell before the full tournament payload is loaded.
The browser first requests `GET /tournaments/:id?simple=true`, shows the
tournament header, navigation, and action links from that basic response, then
hydrates groups, teams, favorites, and playoff data with `GET /tournaments/:id`.

The custom server skips backend tournament resolution for numeric `/t/:id`
routes. That keeps the initial HTML response from waiting on the full tournament
endpoint before the browser can start rendering.

## Current backend API fit

The current backend already exposes `?simple=true`, so the frontend uses that as
the fast view. This is the lowest-risk path because it does not require a new
endpoint or route contract.

Best current backend improvement: make sure `GET /tournaments/:id?simple=true`
returns only metadata needed for the page shell:

- `id`, `code`, `name`, `description`, `public`, `owner_username`
- timer fields used by the nav/header
- `read_only_mode` and sync metadata when available

The simple response should avoid stages, matches, group scores, team lists, and
team action lists.

## Better future fast view

If the backend can add richer metadata without loading the full tournament tree,
the page shell could show useful structure before hydration:

- `team_count`
- `group_count`
- `group_size`
- `playoff_size`
- group-stage state and playoff availability

Either extend `?simple=true` with those scalar fields or add a dedicated
`GET /tournaments/:id/summary`. A dedicated summary endpoint is clearer long
term, but extending `?simple=true` fits the current API with less churn.
