# Astro Booklet

A Vedic and Western astrology web app.

## Stack

- **Frontend:** web app deployed on Netlify (`astro-booklet`)
- **Backend:** Supabase (auth, Postgres, server functions), project `astro-booklet`, Mumbai region
- **Calculations:** own engine built on Swiss Ephemeris (no external astrology API)

## First version scope

- Sign up and save birth details (date, time, place)
- Vedic chart (kundli) and Western natal chart, drawn, with planet and house details
- Compatibility matching
- Daily horoscope

## Repository layout

| Folder | Contents |
|---|---|
| `engine/` | Calculation engine and its tests |
| `supabase/` | Database migrations and server functions |
| `web/` | Frontend app (not started yet) |

## Engine

```bash
cd engine
npm install
npm test
```

`computeChart({ date, time, timezone, latitude, longitude })` returns both the Western (tropical, Placidus)
and Vedic (sidereal Lahiri, whole-sign) chart, including nakshatras, navamsa and the Vimshottari dasha timeline.
Planet positions are tested against an independent astronomy library.

## Database

Five tables, all with row-level security: `profiles`, `birth_profiles`, `charts`, `matches`, `daily_horoscopes`.
Users can only read and change their own data. Charts and matches are written by the server only.

## Licence note

Swiss Ephemeris is dual-licensed (AGPL or a paid professional licence from Astrodienst).
The licence choice must be made before public launch.
