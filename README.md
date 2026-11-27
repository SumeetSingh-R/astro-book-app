# Astro Book

Read your kundli. Meet people who fit it.

A free web app that draws a person's birth chart, explains it in plain words, and shows them people whose charts fit theirs, with family invited in on the person's own terms. Vedic and Western astrology; made for young adults in India.

**Positioning.** Astrology is what a person gets on day one, alone: their chart, a reading for each day, and answers from their own chart. Matching is what it leads to: a 36-point kundli match with the reasons shown, for someone they already know (by link) or for people they meet here. The person makes their own choices; a parent can help only as far as the person allows. The landing page (`web/src/pages/Home.jsx`) follows this order and says plainly that the app is new.

**Voice and names.** The app is written for young adults in India, in Hinglish by default: English with everyday Hindi mixed in, in Roman letters. Plain English stays in the language menu, next to Hindi and the other Indian languages.

| What it is | What the app calls it |
|---|---|
| Meeting people (swipe or browse) | Vibe match |
| Comparing charts with someone you know, by link | Vibe check |
| The 36-point kundli score | Vibe score, always shown out of 36 kundli points |
| The tests that went best for two people | Green flags |
| The one thing worth discussing | Talk about this |
| The reading for the day | Today's vibe |
| A parent helping, on the person's terms | Family mode |
| Suggested first messages | Icebreakers |
| Comparing any two saved charts | Kundli match |

Older sections of this file still use the earlier names (meet and match, family help, invite to match).

How Hinglish works: it is a language choice with the code `hg`, marked as English underneath (`config/languages.mjs`). Its lines are written by hand in `i18n/seed/hg.mjs` and ship with the app; anything not written there reads in English, so nothing is machine-translated and nothing waits for the server. Safety, privacy, errors and settings are left in plain English on purpose. Readings and answers written by the AI model are asked for in Hinglish (`api/lib/prompts.mjs`); text the engine writes stays in English. New accounts start in Hinglish (`20261127150000_hinglish.sql`).

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

**Stage 2 (built): Discover, likes and photo review.**

- `/discover`: everyone the person can meet, as one card at a time (Swipe) or a list (Browse all), best fit first, with "Why you fit": the strongest of the eight tests, the one thing to talk about, and which preferences fit. `/matches` lists mutual likes.
- Scores are real Ashtakoot results computed in the browser by the same engine (`scoreBetween` in `web/src/lib/meet.js`). Each person shares only "match keys" (`meet_keys`): the nakshatra quarter of the Moon and where Mars sits. A test proves the score from keys equals the score from full charts. A man and a woman take the groom and bride roles; any other pair is ordered by id so both see the same score.
- Other people never read the profile tables. `discover_people()` returns a filtered copy: only discoverable profiles whose "show me" fits both ways, with religion, community and income removed where switched off.
- Photos are `pending` until a reviewer approves them (`/admin/photos`, for accounts listed in `meet_admins`). Only approved photos of discoverable people can be fetched by others. People cannot change a photo's status themselves.
- Likes and passes are in `meet_likes`; a person can see who liked them.

**Admin portal (built).** `/admin`, reached from the Profile page by admins only. Admins sign in like anyone else; a row in `meet_admins` (role `owner` or `reviewer`) is what the database checks on every admin action, so the page itself grants nothing.

- Overview: counts of accounts, profiles, photos to review, likes, mutual matches and suspensions.
- Photos: approve or reject.
- Reports: what people have reported, with suspend or close.
- People: search profiles, suspend one with a reason the person sees, or restore it. A suspended profile leaves Discover and its photos are hidden.
- Team (owners only): add an existing account by email as reviewer or owner, or remove someone. Reviewers never see emails.
- Admins cannot see birth details, charts, readings or conversations. The first owner is added once, directly in the database.

**Stage 3 (built): chat, block, report and unmatch.**

- `/chats` lists matches with the latest message and an unread count; `/chats/:id` is the conversation, with three conversation starters and both Moon signs when it is empty. New messages are fetched every few seconds while a chat is open.
- A message can be sent only while both people like each other, neither has blocked the other and neither is suspended (`meet_can_chat`, checked by the database on every insert). Messages cannot be edited or deleted.
- The safety menu in every chat: unmatch, block, or report (reason, optional details, and "also block"). Blocking removes each person from the other's Discover and chats.
- Admin portal, Reports tab: open reports with the reason and what the reporter wrote; "Suspend and close" or "Close". Admins never see conversations.

- `/people/:id` is another person's full profile: photos, details, the signs from their kundli (never their birth details), why the two fit, and all eight tests with scores. Like, pass, open the chat, or report and block from there.
- Pausing a profile takes it out of Discover but existing matches keep each other in their chats and can still see approved photos (`20261127050000_meet_matches_stay.sql`).

**Invite to match (built).** `/invite` makes a link (`/m/<code>`, valid 7 days) to send to someone you already know. They sign up or sign in, add their birth details if they have none, accept, and both people see the 36-point result with reasons and all eight tests. Neither needs a meet-and-match profile. Only a first name and the match keys are shared (`open_invite`, `accept_invite`, `my_invites` in `20261127060000_meet_invites.sql`).

**Message limits (built).** The database checks every message: at most 20 a minute and 500 a day from one person, and at most 5 to someone who has not replied yet. The chat explains the limit in plain words and pauses the message box while waiting for a first reply. Message times are set by the database, so a limit cannot be dodged by back-dating.

**Notifications (built).** A bell in the header and a count on Chats. The database writes a notification when a like completes a match, when a photo is approved or rejected, and when an invite link is accepted; unread messages are counted from the messages themselves. Admins also see how many photos and reports are waiting. `/notifications` lists them and marks them as seen. The app asks once a minute while it is open (`meet_inbox`); nothing is sent by email or to a phone (`20261127070000_meet_limits_notifications.sql`).

**Live delivery (built).** Messages, read receipts ("Seen") and notifications arrive over a socket, using Supabase Realtime: one connection per signed-in person, opened in `web/src/lib/inbox.jsx`, listening for changes to their own rows in `meet_messages` and `meet_notifications`. Row level security decides what a person is sent, so no extra server or secret is involved. If the socket cannot connect, the chat falls back to asking every 6 seconds; with it connected, it still asks every 30 seconds as a safety net. The free Supabase plan allows 200 people connected at the same time (`20261127090000_meet_live.sql`).

**Account deletion (built).** A person can delete their own account from the profile page; an owner can delete someone's account from the People tab of the admin portal (not their own, and not a team member's until they are taken off the team). Deleting the sign-in record removes everything that belongs to it, because every table refers to it with `on delete cascade`. Photo files go first, through the storage service, and the database refuses to delete an account while any file is left. The last owner cannot delete their own account (`20261127100000_account_deletion.sql`).

**Typing and online (built).** "Dev is typing…" is sent over a private socket channel named for the two people; the database lets only that matched pair join, listen or send (`meet_chat_topic_ok`, policies on `realtime.messages`). Online status needs no extra connection: each inbox check notes the time, and a person seen in the last two minutes shows a green dot to their matches only. "Show when I am online" on the profile page turns it off both ways (`20261127110000_meet_typing_online.sql`).

**Family help (built).** A person invites a parent (or another family member) with a one-person link from `/family`, and chooses what they may do: seeing people and suggesting them is always included; liking or passing, and reading and replying to chats, are separate switches. The person can change these, pause the helper or remove them at any time, and sees a list of everything the helper did. The helper signs in with their own account (no birth details needed) and uses the same Discover, profile and chat pages under `/family/<person>/…`, with a bar that says whose pages they are.

How it is enforced: the database function `meet_acts_for(person, what)` answers whether the signed-in person may act for someone, and the row level security policies on profiles, filters, match keys, likes and messages use it. Every like and message made by a helper is stamped by the database (`acted_by`, `sent_by`), messages show "Sent by family" to both sides, and a profile with an active helper says so to other people. A helper never sees birth details, and cannot edit the profile, photos or filters, block, report, or invite others (`20261127120000_family.sql`).

**Alerts when the app is closed (built, switched off until set up).** Web push: a person turns alerts on for their device from the Notifications page, and gets one for a new message, a match, an accepted invite, a family update or a photo review. An alert never contains what a message says. No outside service or account is involved.

- *How it is sent.* After the action, the app asks `POST /api/push { to, kind }`. The database function `push_targets` decides whether an alert is due: the caller must really have just caused it (their message or notification from the last two minutes), the same alert must not have just been sent, and the person must not be looking at the app. The server function then sends to that person's devices with the `web-push` library and forgets devices that no longer exist.
- *Setup, once, by an owner.* Admin portal, Alerts tab: make a pair of keys (made in the browser, shown once), paste them into Netlify as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, deploy. Until then every part of this reports "not set up" and the app behaves as before.
- *Files.* `web/public/sw.js` (shows the alert, opens the page when tapped; no caching), `web/public/manifest.webmanifest` and icons (needed for iPhone, where alerts work only from the Home Screen), `web/src/lib/push.js`, `api/lib/push.mjs`, `netlify/functions/push.mjs`, `20261127130000_push.sql`.
- *A known trade-off.* The server function runs as the signed-in sender, like every other function here (no admin key). So a person who may alert someone could also read that someone's device addresses by calling the database directly. Those addresses are useless without the private key, which only the server has.

## The clickable prototype

`npm run build:prototype` builds the same app with a stand-in backend, so every screen can be clicked through with no server, no accounts and no deploy. It replaces the earlier design canvas, which showed screens as pictures.

- *What it is.* The real pages and components, started from `web/src/demo/main.jsx` instead of `web/src/main.jsx`. Every request the app makes (sign-in, the database, the server functions) is answered in the browser by `web/src/demo/backend.js` from a made-up world: a member called Asha, eight people she can match with, her mum who helps through Family mode, her papa who has an invite waiting, plus chats, notifications, a report and admin rights. Nothing leaves the page.
- *What works.* Liking and matching, chat (the sample people "type", read and answer), message limits, vibe checks, Family mode from both sides, photo upload and admin review, filters, saved charts, kundli match, notifications, account deletion, and Hinglish, English and Hindi. Changes are remembered in that browser until "Start over".
- *What is a fixed sample.* The chart, the readings, today's reading, the kundli match result and the answers to questions (each answer says so). Vibe scores and the horoscope are real: `scripts/build-demo-data.mjs` works them out with the engine when the prototype is built. Other languages and alerts need the live site.
- *The strip at the top* (`web/src/demo/DemoBar.jsx`) lists every screen and lets the viewer switch person. It is not part of the product and is not in the normal build.
- *Rules it follows.* `backend.js` copies the database's rules where a screen depends on them (who sees what, what a helper may do, limits, notifications). It is a copy for showing the product, not a test of those rules; the migrations stay the source of truth.
- *Small changes to the app for it.* `App` takes an optional `Router` and `overlay`; `web/src/lib/site.js` holds the three things that depend on where the app is served (address for copied links, reload after deletion, logo path).

Output goes to `web/dist-prototype/` (`index.html` plus `assets/` and `brand/`), which can be opened from any static host or published as a page.

## Before the next deploy

Everything from "ten languages" onward is saved here and in the database but not yet deployed. One deploy publishes all of it. A checklist for that day:

1. In Netlify, add `ANTHROPIC_API_KEY` (readings, answers, and languages other than English and Hindi) and, for alerts, `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.
2. Deploy once. Commit messages carry `[skip netlify]`, so a deploy has to be started by hand or by a commit without that tag.
3. With two real accounts: save a meet profile, upload a photo, approve it as admin, like each other, send a message (it should arrive at once, with "typing" and "Seen"), open an invite link, invite a family helper and act as them, turn alerts on and close the tab, delete the test account.
4. In Supabase, check Realtime is on for the project (Database, Publications: `meet_messages` and `meet_notifications` are in `supabase_realtime`).

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
| `scripts/` | Build scripts (place dataset, i18n catalogue, prototype sample data) |
| `web/` | Frontend app (React + Vite) |
| `web/src/demo/` | The clickable prototype: sample world and stand-in backend |

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
