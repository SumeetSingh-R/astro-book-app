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
| `api/` | API handlers, place search and their tests |
| `netlify/functions/` | Thin Netlify Function wrappers that expose the API |
| `config/` | Public client configuration (Supabase URL and publishable key) |
| `supabase/` | Database migrations |
| `scripts/` | Build scripts (place dataset) |
| `web/` | Frontend app (React + Vite) |

## Engine

```bash
npm install
npm run build:places   # generates the place-lookup dataset
npm test               # engine + API tests
npm run build          # place dataset + web app
npm run preview        # serves the app and API together on http://localhost:8888
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
- Dosha cancellation rules checked (the score is never changed; the dosha is shown as "cancelled" with the reason):
  - Nadi dosha: same Moon sign with different nakshatras; same nakshatra with different Moon signs; same nakshatra with different padas
  - Bhakoot dosha: both Moon signs have the same lord; or the two lords are mutual natural friends
  - Gana dosha: both Moon signs have the same lord; or the two lords are mutual natural friends
  - Not checked: navamsa-based and other chart-level exceptions
- Daily horoscopes are evaluated at 06:00 India time and driven by the Moon's house from the sign

## API

Runs as Netlify Functions. Signed-in calls forward the user's Supabase token, so row-level security
applies to everything the API reads or writes. No admin key is used anywhere.

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/chart` `{ birthProfileId }` | Signed in | Returns the chart for a saved birth profile (calculated once, then served from the database) |
| `POST /api/match` `{ system, groomProfileId, brideProfileId }` or `{ system: "western", profileAId, profileBId }` | Signed in | Runs and saves a compatibility match |
| `POST /api/chart/preview` `{ date, time, timezone, latitude, longitude }` | Public | Calculates a chart without saving anything |
| `GET /api/horoscope?system=&sign=&date=` | Public | Daily readings (all 12 signs when `sign` is omitted) |
| `GET /api/places?q=&country=` | Public | Birth-place search: name, state, country, coordinates and timezone |

Place data: GeoNames cities with population over 1,000 (about 135,000 places), timezone derived from coordinates.

## Database

Five tables, all with row-level security: `profiles`, `birth_profiles`, `charts`, `matches`, `daily_horoscopes`.
Users can only read and change their own data. Stored charts and matches are cleared automatically when a profile's birth details change.

## Licence

Copyright (C) 2026 Sumeet Singh

Astro Booklet is free software: you can redistribute it and/or modify it under the terms of the
GNU Affero General Public License as published by the Free Software Foundation, either version 3
of the License, or (at your option) any later version. It is distributed in the hope that it will be
useful, but WITHOUT ANY WARRANTY. See [LICENSE](LICENSE) for the full text.

The AGPL applies because the app is built on Swiss Ephemeris, which Astrodienst offers under the AGPL
(or a paid professional licence). Anyone who runs a modified copy as a public service must offer its
source code to their users. The live app links to this repository from its footer for that reason.

Third-party components:

| Component | Licence |
|---|---|
| [Swiss Ephemeris](https://www.astro.com/swisseph/) (Astrodienst AG) | AGPL-3.0 |
| `swisseph-wasm` (WebAssembly build of Swiss Ephemeris) | GPL-3.0-or-later |
| `astronomy-engine` (used only in tests as an independent check) | MIT |
| Place data from [GeoNames](https://www.geonames.org/) via `all-the-cities` | CC BY 4.0 |
| React, Vite, Supabase client | MIT |
