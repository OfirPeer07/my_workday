# My Workday

My Workday is a local web application for tracking worked hours against a required work-hours target.

The app is designed for a simple attendance workflow: define workdays and required hours, enter daily start and end times, and immediately see whether the monthly balance is positive, negative, or exactly on target.

## Purpose

The project helps users answer three practical questions:

- How many hours have I worked?
- How many hours was I required to work?
- Am I currently in surplus or deficit?

It is useful for employees, freelancers, or anyone who needs a clear monthly work-hours ledger without connecting to an external attendance system.

## Core Features

- Monthly attendance table.
- Workday settings by weekday.
- Default support for Sunday through Thursday workweeks.
- Friday and Saturday can be shown as blank/non-working days.
- Daily time entry using `HH:mm` format.
- Date display using `dd/MM/yyyy` format.
- Multiple entries per day.
- Monthly required hours calculation.
- Actual worked hours calculation.
- Balance calculation as `+HH:mm` or `-HH:mm`.
- Local persistence using `localStorage`.
- CSV export.
- Light and dark mode.

## Calculation Model

Each saved entry contains:

```text
date
start time
end time
source
optional note
```

The app calculates worked time as:

```text
end time - start time = actual worked time
```

The balance is calculated as:

```text
actual worked time - required work time = balance
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

## Active Workday Rule

The app treats the active workday as starting at `08:00` Israel time.

Before `08:00`, the new calendar day is not counted yet in the required-hours balance. This prevents the app from showing an artificial deficit before the workday has actually started.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- LocalStorage

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Storage

This MVP stores all data locally in the browser using `localStorage`.

No backend, database, authentication, or external API is required.

## Future Improvements

Potential next steps:

- Cloud sync.
- User authentication.
- Supabase or PostgreSQL backend.
- Google Calendar import.
- Manual correction workflow for imported events.
- Monthly report export.
- Mobile card layout for small screens.
