# My Workday

My Workday is a local web application for tracking work hours against a required monthly work-hours target.

The project is designed for a simple attendance workflow: set your expected work schedule, enter daily start and end times, and instantly see whether your current monthly balance is positive, negative, or exactly on target.

## Purpose

The purpose of My Workday is to give users a clear and simple way to manage their personal work-hour balance without depending on an external attendance system.

It helps answer three practical questions:

- How many hours have I worked so far?
- How many hours was I expected to work?
- Am I currently in surplus or deficit?

The app is useful for employees, freelancers, students, or anyone who wants to keep a private monthly ledger of worked hours.

## Main Features

- Monthly work-hours dashboard.
- Daily attendance table.
- Manual time entry for start and end times.
- Support for multiple entries on the same day.
- Configurable workdays and required hours per weekday.
- Default Israeli-style workweek: Sunday through Thursday.
- Friday and Saturday can remain blank as non-working days.
- Monthly required-hours calculation.
- Actual worked-hours calculation.
- Balance calculation shown as `+HH:mm`, `-HH:mm`, or zero.
- Recent entries panel.
- Delete existing entries.
- CSV export.
- Light and dark mode.
- Local browser storage using `localStorage`.
- Israel time zone support using `Asia/Jerusalem`.

## How It Works

Each work entry contains:

```text
date
start time
end time
source
optional note
```

The app calculates worked time from the difference between the end time and the start time.

```text
worked time = end time - start time
```

The monthly balance is calculated by comparing the actual worked time to the required work time.

```text
balance = actual worked hours - required work hours
```

Examples:

```text
09:00-18:00 = 09:00 worked
Required: 09:00
Balance: +00:00
```

```text
09:20-18:00 = 08:40 worked
Required: 09:00
Balance: -00:20
```

```text
08:35-17:57 = 09:22 worked
Required: 09:00
Balance: +00:22
```

If an end time is earlier than the start time, the app treats the entry as passing midnight and continues the calculation into the next day.

## Active Workday Rule

The app uses Israel time (`Asia/Jerusalem`) and treats the active workday as starting at `08:00`.

Before `08:00`, the new calendar day is not counted yet in the required-hours balance. This prevents the app from showing an artificial deficit before the workday has actually started.

## Default Work Schedule

By default, the app is configured for:

| Day | Required Hours |
| --- | ---: |
| Sunday | 9 |
| Monday | 9 |
| Tuesday | 9 |
| Wednesday | 9 |
| Thursday | 9 |
| Friday | 0 |
| Saturday | 0 |

Users can change the active workdays and required hours directly from the settings panel.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
- LocalStorage

## Getting Started

### Prerequisites

Make sure Node.js and npm are installed on your machine.

### Installation

Clone the repository:

```bash
git clone https://github.com/OfirPeer07/my_workday.git
cd my_workday
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build the project for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Deploying to GitHub Pages

This project is configured to deploy automatically to GitHub Pages with GitHub Actions.

The production URL will be:

```text
https://ofirpeer07.github.io/my_workday/
```

To deploy:

1. Push the project to the `main` branch.
2. Open the GitHub repository.
3. Go to `Settings` -> `Pages`.
4. Set `Build and deployment` -> `Source` to `GitHub Actions`.
5. Wait for the `Deploy to GitHub Pages` workflow to finish.

The Vite base path is configured as `/my_workday/` because GitHub Pages serves this repository under that path.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the Vite development server. |
| `npm run build` | Builds the app for production. |
| `npm run preview` | Previews the production build locally. |

## Data Storage

This project can store user data in Firebase so the same account can sync between desktop and phone.

If Firebase is not configured, the app automatically falls back to local browser storage using `localStorage`.

## Firebase Sync

Firebase is used for:

- Email and password authentication.
- Firestore cloud storage.
- Syncing `user_settings` and `time_entries` between devices.

### Firebase setup

In the Firebase Console:

1. Create a Firebase project.
2. Add a Web App.
3. Enable `Authentication` -> `Sign-in method` -> `Email/Password`.
4. Create a Firestore database.
5. Add the Firebase config values to `.env.local`.

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Then fill:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

For GitHub Pages deployment, add the same values as GitHub repository secrets:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

### Firestore rules

Use user-scoped rules so each signed-in user can only access their own data:

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

The same rules are also stored in [`firestore.rules`](./firestore.rules).

To deploy Firestore rules with Firebase CLI:

```bash
npx firebase-tools login
npx firebase-tools use my-workday-d24c0
npx firebase-tools deploy --only firestore:rules
```

## CSV Export

The app can export saved work entries to a CSV file.

The exported file includes:

```text
date,startTime,endTime,netHours,note
```

## Project Status

This is an MVP version focused on local work-hour tracking.

Potential future improvements:

- Cloud sync.
- User authentication.
- Database support with Supabase or PostgreSQL.
- Google Calendar import.
- Monthly report export.
- Better mobile layout.
- Multi-user support.
- Backup and restore options.

## License

No license has been specified yet.
