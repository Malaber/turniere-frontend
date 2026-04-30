# Beamer Media Backend Contract

TUR-162 adds a frontend-only media catalog for now. TUR-109 can replace this
with backend-owned media packs later, but the current backend only needs to
preserve beamer config values and rebroadcast beamer changes.

## Current Frontend Contract

Mission Control stores Werbung selection on the existing beamer endpoint:

```json
{
  "display_state": "static_image",
  "config": {
    "display_mode": "werbung",
    "werbung_image_keys": ["bpwstr_banner", "bpwstr_logo"],
    "werbung_rotation_seconds": 10
  }
}
```

Required backend behavior:

- `POST /tournaments/:tournament_id/beamers` accepts the config object above.
- `PATCH /tournaments/:tournament_id/beamers/:id` persists the config object
  above without dropping unknown keys.
- `GET /tournaments/:tournament_id/beamers` returns the persisted config.
- `GET /tournaments/:tournament_id/beamers/by_name?name=...` returns the
  persisted config for fullscreen projector pages.
- Beamer ActionCable broadcasts include the same config after create, update,
  and delete fallback events.
- Fullscreen pages remain unauthenticated and keep working for named beamers.

`display_state` stays `static_image` so current backend validation can keep its
known display-state list. The actual Werbung mode is selected by
`config.display_mode === "werbung"`, like existing `timer_only`.

## Hardcoded Media Keys

Frontend currently knows these keys:

- `bpwstr_banner`
- `bpwstr_logo`
- `bpwstr_qr_code`
- `turniere_logo`
- `landingpage_background`
- `tennis_blurred`

Invalid keys are ignored by the frontend. Backend may validate them only after
TUR-109 introduces media-pack records or an equivalent tournament media API.

## Adding More Images (TUR-170)

Add image files under `public/static/images/`, then register each image in
`js/utils/beamerMedia.js` inside `BEAMER_MEDIA_IMAGES`:

```js
{
    key: 'sponsor_banner',
    label: 'Sponsor Banner',
    src: '/static/images/sponsor-banner.jpg'
}
```

Use a stable lowercase key. Mission Control reads this catalog for both
`Statisches Bild` radio buttons and `Werbung` checkboxes. Fullscreen pages use
the same key through beamer `config.image_key` or `config.werbung_image_keys`.
No extra page wiring is needed after the catalog entry is added.

## TUR-109 Follow-Up Shape

When media comes from the backend, add a tournament-scoped media endpoint and
keep this beamer config shape stable until the frontend migration is complete.
Suggested future fields:

```json
{
  "id": "media_123",
  "key": "sponsor_a_banner",
  "label": "Sponsor A Banner",
  "url": "https://...",
  "content_type": "image/png"
}
```

Then `werbung_image_keys` can reference backend media keys instead of the
temporary frontend constants.
