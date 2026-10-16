# GraytCars – how it works

A private, installable web app (PWA) for Nathan's cars: what's due, logging the work, and fuel economy. Works on phone, tablet and laptop, and offline.

## Where everything lives

| Part | Service | What's in it |
|---|---|---|
| App code + version history | GitHub (`graytrees/GraytCars`) | The program only. No records, photos or the Simply Auto backup. Public. |
| App web address | GitHub Pages | `https://graytrees.github.io/GraytCars/` |
| Sign-in | Firebase Authentication (Google), project `graytcars` | Only `graytshotz@gmail.com` is allowed in. |
| Records | Cloud Firestore, Sydney, project `graytcars` | Cars (incl. photo), jobs, work history, fill-ups. Free tier. |
| Backups | Google Drive → `GraytCars/Backups` | Weekly JSON + fuel CSV + work CSV. Uses the Drive permission already given to GraytTrees. |

## How it thinks

- **Jobs and checks** belong to a car. Each has an interval in km and/or months ("whichever comes first").
  - *Job* → logged with **Done** (tyre rotation, drain pre-filter).
  - *Check* → **OK** or **Needs attention** (battery, wheel alignment, tyre pressures).
  - *Service* → a visit that covers several jobs. Ticking it also ticks the jobs it includes, so they all reset together.
- **Traffic lights**: green under 85% of the interval, amber from 85%, red when due. The shift-light bar fills by whichever of km or time is closer.
- **Estimated due date** uses how far the car has actually travelled over the last year.
- **Wrong-car check**: a reading lower than the car's last one, a jump bigger than it normally travels, or more litres than it has ever taken asks "Is this the Mustang?" with both cars shown, and one tap moves it to the other car.
- **Fuel economy** is worked out per full tank (part fills are added into the next full one), in L/100km or km/L.
- History is never silently lost: edits keep the previous version; deletes go to the **Recycle bin** (Settings).

## Shortcuts

Long-press the GraytCars icon → **Fill up Mustang** / **Fill up Everest**. Drag either onto the home screen for a one-tap fill-up. (Android doesn't allow home-screen widgets for web apps.)

## Making a change

1. Describe the change to Claude (a screenshot helps).
2. Claude edits the code and pushes to `main`.
3. GitHub Actions (`.github/workflows/publish.yml`) builds and publishes in ~2 minutes.
4. Devices show "Update available – tap to refresh" next time the app is opened.

## Code map (`src/`)

- `main.js` – start-up, sign-in gate, shortcuts, update banner
- `app.js` – screens: Garage, car page (Status · Fuel · History · Specs), Settings, Recycle bin, printable service history
- `sheets.js` – fill-up, log work, job details, odometer, import, add a car
- `calc.js` – odometer, driving rate, due status, fuel economy, wrong-car check
- `simplyauto.js` – reads a Simply Auto backup zip/CSVs
- `ui.js` – icons, car art, odometer drums, shift-light bars, sheets, photo colour picking
- `chart.js` – fuel economy chart
- `store.js` – Firestore reads/writes, revisions, recycle bin
- `drive.js`, `backup.js` – weekly Drive backup
- `config.js` – Firebase project settings and owner email

Testing without the real cloud: `npm run test:ui` runs against an in-memory stand-in (`test/mocks/`). Put a converted backup at `test/seed.json` (git-ignored) to test with real data.
