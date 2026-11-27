# Astro Book

A Vedic and Western astrology web app.

## Stack

- **Frontend:** web app deployed on Netlify (`astro-book-app`), live at https://astro-book-app.netlify.app
- **Backend:** Supabase (auth, Postgres, server functions), project `astro-book-app`, Mumbai region
- **Calculations:** own engine built on Swiss Ephemeris (no external astrology API)
- **Readings and answers:** an AI model (Claude Haiku, through the Anthropic API) writes plain-language text from facts the engine has already calculated

## First version scope

- Sign up and save birth details (date, time, place)
- Vedic chart (kundli) and Western natal chart, drawn, with planet and house details
- Compatibility matching
- Daily horoscope

## Second version: readings for people who don't read charts

- **In plain words:** each saved chart is explained area by area (nature, work, money, marriage, family, wellbeing, current period), with the chart factors behind each note. Written once per chart and language, then stored.
- **A personal day:** the signed-in Today page reads each day against the person's own chart (Moon's house from the birth Moon and lagna, tara bala, dasha, Sade Sati), not their sign alone.
- **Ask your chart:** questions in plain words, answered from that chart. English and Hindi.

The rule throughout: **the engine calculates, the model only explains.** The model is given the chart as facts (house lords, occupants, aspects, dignity, dasha periods) and, for timing questions, a table of month ranges the engine has worked out from the dasha lords and the Jupiter and Saturn transits. It is told to use nothing else, to give timing as month ranges and never dates, and not to predict death, illness, the sex of a child, or the results of exams, court cases or markets. The person's name, email, birth date, birth time and birth place are never sent to the model: only their age, the calculated positions and the question.

## Third version: a consumer app

- **One profile:** a new account is asked for its birth details once (`/welcome`). They are kept as the birth profile marked `is_self` and feed Today, the chart, matching and questions. `/profile` edits them, with the reading language (`profiles.language`) and sign out.
- **New look:** lavender ground, a lilac-to-peach gradient, violet actions, Fraunces headings with Mukta text, the owl logo, and the arch as the repeated shape. Light theme only.
- **Clickable kundli:** tap a house to read what it stands for, how its lord is placed, and whether the person's current dasha period brings it into focus (`readHouse` in `web/src/lib/kundli.js`).
- **Time picker:** hour, minute and AM/PM in place of the browser's time field.
- **Phones:** a bottom tab bar (Today, My charts, Ask, Matching).
- **About page:** credits, privacy and the link to this source code live at `/about`, linked from every footer.

## Fourth version: ten languages and remembered data

**Languages.** The whole app (interface, engine-written sentences, AI readings and answers) can be read in English, Hindi, Gujarati, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam and Punjabi. The list is `config/languages.mjs`.

- English text is the key: components call `t('Save')` (`useT()` in `web/src/lib/language.jsx`). Text kept in tables outside components is marked with `msg('…')`.
- `npm run build:strings` (part of `npm run build`) reads the source and writes the catalogue of every string, `i18n/catalog.mjs`, plus `i18n/version.mjs`. Proper names (rashis, grahas, nakshatras, matching terms) come from the engine through `i18n/names.mjs`.
- `GET /api/i18n?lang=gu` returns the catalogue in one language. Hindi is bundled and hand-written (`i18n/seed/hi.mjs`), so it needs no AI. Every other language is translated once by the AI model, in small batches, and kept in the site's Netlify Blobs store (`api/lib/store.mjs`, `api/lib/translate.mjs`); later visitors get it from there and from the CDN. Only text the app itself wrote is ever translated, never text typed by a visitor.
- Engine-written sentences in API answers (horoscope, match notes, the day's theme) are translated the same way on the server. AI readings and answers are written directly in the chosen language.
- Without `ANTHROPIC_API_KEY`, Hindi still works in full; the other languages stay in English until the key is set.
- Fonts for each script are loaded from Google Fonts only when that language is chosen.

**Remembered data.** `web/src/lib/cache.js` keeps what the app has loaded (profile, charts list, each chart, readings, today, horoscope, conversation, match results) in memory and in the browser's storage, per signed-in person. Pages show the remembered answer at once and refresh it quietly when it has aged; edits forget what they make stale; signing out wipes everything. The server also runs its independent database lookups together instead of one after another.

There is no Redis: readings and charts are already stored in Supabase, translations in Netlify Blobs, and the waiting people noticed was the browser asking again for things it already had.

## Fifth version, in stages: meet and match

The plan is a profile other people can see, a swipe-and-browse Discover ranked by kundli match and preferences, likes, and chat after a mutual like. The clickable prototype has every screen. It is being built in stages.

**Stage 1 (built): a person's own profile, photos and preferences.** Nothing is visible to other people yet.

- `/me`: photos (up to 6, shrunk in the browser to 1600px JPEG), "I am / show me / looking for", a prompt, the basics, background and family (religion, community, mother tongue, gotra, income as a range, family), each of religion, community and income with its own "show" switch, and the signs from the person's kundli. A completeness bar names the next thing to add (`web/src/lib/meet.js`).
- `/me/preferences`: who to show, age, height, income, looking-for, marital status, religion, community and mother tongue (empty means open to all), the lowest kundli score to show, a Manglik preference, the two visibility switches, and deleting the profile.
- Tables `meet_profiles`, `meet_preferences`, `meet_photos`, and the private storage bucket `meet-photos`; every row and file is readable and writable by its owner only (`supabase/migrations/20261127010000_meet_profile.sql`). Profiles can only be made by adults (18+), checked by the database policy.
- Birth date, time and place are never part of this profile. Only the year of birth (for age) and, later, the signs needed for matching are shared.

**Next stages:** Discover (a filtered, read-only view of other profiles, and match keys so scores are computed without exposing birth details), likes and mutual matches, chat with report and block, photo checks before a photo is shown to others.

### Switching the AI on

Set these in the Netlify site's environment variables (never in the code):

| Variable | Required | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | API key from the Claude Console |
| `AI_MODEL` | No | Model id. Default `claude-haiku-5-5` |
| `AI_EFFORT` | No | Thinking effort. Default `low` |

Without a key the app still works: readings fall back to fixed text built from the same facts, and "Ask your chart" says it is not switched on. Each person can ask 10 questions a day (`ASK_LIMIT` in `api/lib/handlers.mjs`); the count is kept in the database by a function the browser cannot reset.

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
| `chartFacts(chart)` | The chart restated as facts: each house's rashi, lord, occupants and aspects; each graha's dignity; the running dasha |
| `topicWindows(chart, topic)` | Month ranges traditionally read as supportive for a topic (marriage, career, money, children, education, home, travel), with reasons |
| `personalDay(chart, date)` | A day read against one chart: Moon's house from the birth Moon and lagna, tara bala, dasha, Saturn and Jupiter from the Moon |

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
- Timing windows combine two tests, month by month: the antardasha or mahadasha lord is a significator of the topic (lord or occupant of its house, its natural significator, or a node acting for one of these), and Jupiter occupies or aspects the house or its lord. A month where Saturn does too is marked as strongest. Other timing methods exist and astrologers weigh them differently; no windows are produced for health
- Graha aspects used: the 7th for all, plus Mars 4 and 8, Jupiter 5 and 9, Saturn 3 and 10. Rahu and Ketu are given no aspects

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
| `POST /api/reading` `{ birthProfileId, language }` | Signed in | The chart in plain words (`language` is `en` or `hi`) |
| `POST /api/today` `{ birthProfileId, language, date?, timezone? }` | Signed in | Today read against one person's chart: the day's facts and a reading |
| `POST /api/ask` `{ birthProfileId, question, language }` | Signed in | A question answered from the chart; saved to the conversation |

Place data: GeoNames cities with population over 1,000 (about 135,000 places), timezone derived from coordinates.

## Database

Eight tables, all with row-level security: `profiles`, `birth_profiles`, `charts`, `matches`, `daily_horoscopes`, `readings`, `chat_messages`, `ai_usage`.
Users can only read and change their own data. Stored charts, matches and readings are cleared automatically when a profile's birth details change. One birth profile per account can be marked `is_self`; the Today page follows it.

## Licence

Copyright (C) 2026 Sumeet Singh

Astro Book is free software: you can redistribute it and/or modify it under the terms of the
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
