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

| Function | What it returns |
|---|---|
| `computeChart({ date, time, timezone, latitude, longitude })` | Western (tropical, Placidus) and Vedic (sidereal Lahiri, whole-sign) chart, with nakshatras, navamsa and the Vimshottari dasha timeline |
| `matchVedic(groomChart, brideChart)` | Ashtakoot (Guna Milan) score out of 36, koota by koota, with doshas and a Manglik check |
| `matchWestern(chartA, chartB)` | Synastry: cross-chart aspects sorted by tightness, with a harmonious/challenging count |
| `dailyHoroscopesAll(date)` | 24 readings for the day: 12 Sun signs (Western) and 12 Moon signs (Vedic) |

Checks in the test suite:

- Planet positions against an independent astronomy library, across birth dates from 1910 to 2026
- Ascendant against an independent formula
- Ashtakoot against a published worked example (17.5/36) and structural checks on every lookup table
- Nakshatra, navamsa and dasha rules against hand-worked cases

Conventions chosen (these vary between astrologers and can be changed):

- Lahiri ayanamsa, mean lunar node for Rahu/Ketu, 365.25-day year for dasha dates
- Vashya and Gana scoring tables: the versions most widely used in matching software (see `src/matchTables.mjs`)
- Bhakoot and Nadi dosha cancellation rules are not applied
- Daily horoscopes are evaluated at 06:00 India time and driven by the Moon's house from the sign

## Database

Five tables, all with row-level security: `profiles`, `birth_profiles`, `charts`, `matches`, `daily_horoscopes`.
Users can only read and change their own data. Charts and matches are written by the server only.

## Licence note

Swiss Ephemeris is dual-licensed (AGPL or a paid professional licence from Astrodienst).
The licence choice must be made before public launch.
