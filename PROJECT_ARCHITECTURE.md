# Project Architecture: MMI SK Batu 10

## Overview

MMI SK Batu 10 is a web application for recording teacher presence in classrooms according to instructional time slots. The app supports daily MMI records, sit-in teacher tracking, class-based analysis, monthly PDF reports, and admin management for teacher/class lists.

The production app is primarily accessed through Vercel:

- Vercel: `https://mmi-sk-batu-10.vercel.app`
- Firebase Hosting backup: `https://mmi-sk-batu-10.web.app`

Both deployments use the same Firebase backend, so users entering through either URL access the same data.

## Main Technology Stack

- Frontend: React with Vite
- Styling: Tailwind CSS via CDN in `index.html`
- Charts: Recharts
- PDF generation: jsPDF
- Icons: lucide-react
- Backend services: Firebase
- Authentication: Firebase Authentication
- Database: Cloud Firestore
- Storage: Firebase Storage
- Server backend: Firebase Functions
- Hosting: Vercel and Firebase Hosting

## Key Files

- `src/App.jsx`
  Main application file. Contains the form, dashboard, analysis views, admin views, PDF generation logic, Firebase reads/writes, and UI state.

- `src/main.jsx`
  React entry point.

- `public/manifest.json`
  PWA metadata, including app name, theme color, and icon references.

- `public/icon-192.png`
  App icon for smaller install surfaces.

- `public/icon-512.png`
  App icon for larger install surfaces.

- `public/icon-original.png`
  Source-sized generated app icon.

- `public/logo-sekolah.png`
  School logo used where required, separate from the app icon.

- `functions/index.js`
  Firebase Functions backend, including monthly report automation and manual report generation.

- `firebase.json`
  Firebase configuration for Functions and Hosting.

- `.firebaserc`
  Firebase project binding. Default project: `mmi-sk-batu-10`.

- `vite.config.js`
  Vite configuration. Enables local network access for phone testing.

## Frontend Structure

The app is structured around tabs:

- `Rekod`
  Daily record form and daily dashboard.

- `Analisis`
  Daily analysis charts and class-by-class instructional slot status.

- `Laporan Bulanan`
  Monthly report list, PDF generation, and monthly summary.

- `Login/Admin`
  Admin authentication and management of teacher/class lists.

## Core Data Collections

### `rekod_mmi`

Stores daily MMI records submitted by teachers.

Important fields:

- `tarikh`
- `hari`
- `masaHantar`
- `kelas`
- `guru`
- `masa`
- `masaArray`
- `jenisGuru`
- `guruYangDiganti`
- `createdAt`

### `senarai_guru`

Stores teacher names used in dropdown lists.

Important fields:

- `nama`

### `senarai_kelas`

Stores class names used in dropdown lists and analysis.

Important fields:

- `nama`

### `laporan_bulanan`

Stores generated monthly report metadata and PDF URLs.

Important fields may include:

- `tajuk`
- `bulan`
- `tahun`
- `pdfUrl`
- `createdAt`

## Record Form Logic

Teachers submit records by selecting:

- Class name
- Teacher name
- One or more teaching time slots
- Teacher type:
  - `Guru Mata Pelajaran`
  - `Guru Sit-in`

When `Guru Sit-in` is selected:

- A new dropdown appears: `Guru yang diganti`
- The currently selected teacher is excluded from that dropdown
- Submission is blocked if `Guru yang diganti` is empty

After submission:

- The selected class filter is preserved
- The form resets teacher/time/type fields
- The selected class remains active for easier repeated entry

## Daily Reset Logic

Daily views use `today.tarikh` to filter records.

The following dashboard and analysis values are based on records for the current date only:

- `Jumlah Rekod Hari Ini`
- `Kelas Direkod Hari Ini`
- `Sit-in Hari Ini`
- Daily class analysis
- Daily teacher type pie chart
- Daily time-slot chart
- Daily sit-in class chart

Historical records remain in Firestore but are not shown in daily dashboard/analysis views unless used by monthly reporting.

## Time Slot Logic

Base time slots:

- `7:15 - 7:45`
- `7:45 - 8:15`
- `8:15 - 8:45`
- `8:45 - 9:15`
- `9:15 - 9:45`
- `9:45 - 10:15`
- `10:15 - 10:35 (REHAT)`
- `10:35 - 11:05`
- `11:05 - 11:35`
- `11:35 - 12:05`
- `12:05 - 12:35`
- `12:35 - 13:05`

The visible slots depend on:

- Selected class year
- Current day
- Class-specific end time

Recess is shown but disabled for user selection.

## Attendance Percentage Logic

The class analysis calculates instructional slot coverage:

- Registered slots: slots with a matching record
- Unregistered slots: required slots without a record
- Recess is excluded from percentage calculation
- Tuesday first slot `7:15 - 7:45` is treated as registered by default because it is assembly time

The analysis also lists unregistered time slots for admin review.

## PDF Logic

The daily/monthly PDF generator creates a full schedule-style table.

For each active school day and class:

- All required time slots are shown
- Empty slots are shown with `-`
- Recess is inserted as a highlighted row
- `Guru Diganti` is included as a column
- Table layout is compacted so up to 12 slots fit on one landscape page

PDF columns:

- `Bil`
- `Masa`
- `Kelas`
- `Guru`
- `Guru Diganti`
- `Jenis Guru`
- `Masa Hantar`

Saturday and Sunday are excluded from generated school-day reports.

If all classes have no active records for a date, the report marks the day as inactive or holiday.

## Monthly Report Logic

Monthly reporting uses historical records grouped by month.

It calculates:

- Total records
- Guru Mata Pelajaran count
- Guru Sit-in count
- Percentages
- Records by class
- Classes with missing records
- Most frequent sit-in class
- Most frequent sit-in teacher

Monthly report automation is handled by Firebase Functions.

## Firebase Functions

Important functions:

- `janaLaporanBulananAuto`
  Scheduled function for automatic monthly report generation.

- `janaLaporanBulananManual`
  HTTPS callable/manual trigger for report generation.

The scheduled monthly report is intended to run near the end of the month and generate the report when the next day is the first day of the new month.

## Authentication

The app uses Firebase Authentication.

Current login flow:

- Email and password login
- Admin-only sections are guarded by login state

Firebase Dynamic Links shutdown does not affect the current login flow because the app does not rely on email link authentication or Cordova OAuth.

## Admin Features

Admin can:

- Log in with Firebase Authentication
- Add teacher names
- Delete teacher names
- Add class names
- Delete class names
- Generate monthly PDFs manually
- Access management views

## Deployment Architecture

### Vercel

The main QR code URL uses Vercel:

- `https://mmi-sk-batu-10.vercel.app`

GitHub is connected to Vercel. Pushes to `main` trigger Vercel auto-deploy.

Typical observed deploy delay:

- Around 25-30 seconds after push

### Firebase Hosting

Firebase Hosting is configured as a backup deployment:

- `https://mmi-sk-batu-10.web.app`

Deploy command:

```bash
firebase deploy --only hosting --project mmi-sk-batu-10
```

### Firebase Functions

Functions are deployed separately when backend code changes.

Deploy command:

```bash
firebase deploy --only functions --project mmi-sk-batu-10
```

## Standard Update Workflow

1. Edit locally.
2. Run build:

```bash
npm run build
```

3. Test locally or via phone network URL:

```bash
npm run dev
```

4. Commit changes:

```bash
git add .
git commit -m "Descriptive message"
```

5. Push to GitHub:

```bash
git push origin main
```

6. Verify Vercel auto-deploy status.
7. Deploy Firebase Hosting backup if required:

```bash
firebase deploy --only hosting --project mmi-sk-batu-10
```

8. Deploy Firebase Functions only if backend/functions changed.

## Operational Notes

- Vercel URL is the recommended official URL because QR codes have already been created using it.
- Firebase Hosting is available as a backup public URL.
- Both frontend deployments connect to the same Firebase project and therefore share the same data.
- Daily dashboards should use current-day data only.
- Monthly reports should use historical monthly data.
- Do not delete historical Firestore records just to reset daily views; daily reset is handled by date filtering.

