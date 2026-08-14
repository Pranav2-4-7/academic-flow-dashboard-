# 📚 Academic Flow Dashboard

A **production-ready Progressive Web App (PWA)** for students to manage courses, deadlines, and class schedules — all in one beautiful, dark-themed dashboard.

Built with **Next.js 15 (App Router)**, **Tailwind CSS v4**, **Firebase**, and integrated with **Coursera**, **Google Gmail**, and **Notion**.

---

## ✨ Features

### 🏠 Home Dashboard
- **Live Class Panel** — Shows your next upcoming class with a countdown
- **7-Day Attendance Tracker** — Click to cycle attendance status per day (Present / Absent / Holiday)
- **Kanban Board** — Drag-and-drop tasks between **To Do**, **In Progress**, and **Done** columns (desktop)
- **Mobile Checklist** — Touch-friendly task list on smaller screens

### 📅 Study Calendar
- **Monthly Grid** — Colour-coded task pills per day
- **Notion-style Backlog Panel** — Add unscheduled tasks and drag them directly onto calendar day cells
- **Drag-to-Reschedule** — Move tasks between days by dragging
- **Drag-to-Unschedule** — Drag tasks back to the backlog to remove their date
- **Day Side Panel** — Click any day to see its full task list and quick-add events

### ⚙️ Settings & Integrations
| Integration | Status |
|---|---|
| **Coursera ICS Calendar** | ✅ Full sync via iCal URL |
| **Google Gmail** | ✅ OAuth connect + read-only class email scanning |
| **Notion Database** | ✅ Sync tasks from any Notion database |

### 🔒 Auth Modes
- **Google Sign-In** via Firebase Authentication
- **Guest Mode** — Fully functional offline demo with mock data (no account needed)

### 📱 PWA Support
- Installable on desktop and mobile
- Offline service worker via `next-pwa`

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 (custom design system) |
| Auth & Database | Firebase Authentication + Firestore |
| PWA | `next-pwa` with Webpack |
| Notion API | `@notionhq/client` |
| Calendar Parsing | `node-ical` |
| Language | TypeScript |

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/academic-flow-dashboard.git
cd academic-flow-dashboard
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

```env
# 1. Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# 2. Firebase Admin (Server-side)
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# 3. Google OAuth (for Gmail integration)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 4. Notion API Credentials
NOTION_INTEGRATION_TOKEN=
NOTION_DATABASE_ID=
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You can log in with **Guest Mode** immediately — no Firebase setup required.

---

## 🔌 Integration Setup

### Notion
1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Create a new integration and copy the **Integration Token**
3. Share your Notion database with the integration
4. Copy the **Database ID** from the database URL
5. Enter both in **Settings → Notion Workspace Integration**

Your Notion database should have these properties:
| Property | Type | Description |
|---|---|---|
| Title | `title` | Task name |
| Due Date | `date` | Deadline (optional) |
| Status | `status` or `select` | Maps to To Do / In Progress / Done |
| Description | `rich_text` | Task details (optional) |

### Coursera
1. Go to Coursera → Settings → Calendar
2. Copy your personal **iCal URL**
3. Paste it in **Settings → Coursera Calendar Integration**

### Gmail
1. Click **Connect Google** in **Settings → Google Gmail Integration**
2. Authorize read-only access
3. Click **Scan Mail Now** to import upcoming live class links

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx              # Login page
│   ├── dashboard/page.tsx    # Home dashboard (Kanban + attendance)
│   ├── calendar/page.tsx     # Study calendar with drag-and-drop
│   ├── settings/page.tsx     # Integrations settings
│   └── api/
│       ├── auth/google/      # Google OAuth endpoints
│       ├── sync/coursera/    # Coursera iCal sync
│       ├── sync/gmail/       # Gmail class email scanner
│       └── sync/notion/      # Notion database sync
├── components/
│   └── Navigation.tsx        # Responsive sidebar + bottom nav
├── context/
│   └── AuthContext.tsx       # Auth state + Guest Mode
└── lib/
    ├── firebase.ts           # Firebase client config
    ├── firebase-admin.ts     # Firebase Admin SDK
    └── services/
        ├── tasks.ts          # Task CRUD (Firestore + localStorage)
        ├── attendance.ts     # Attendance tracking
        └── notion.ts         # Notion API integration
```

---

## 🎨 Design System

The app uses a custom HSL-based design token system defined in `globals.css`, built on top of Material Design 3 color roles:

- `--primary`, `--on-primary`, `--primary-container`
- `--secondary`, `--tertiary`, `--error`
- `--surface`, `--surface-container`, `--surface-variant`
- Dark mode by default with consistent contrast ratios

---

## 📄 License

MIT


<!-- commit-bot-update -->
### 🤖 Automated Telemetry Status
- Heartbeat pulse checked at: `8/18/2026, 11:46:55 PM`


<!-- commit-bot-update -->
### 🤖 Automated Telemetry Status
- Heartbeat pulse checked at: `8/18/2026, 11:46:55 PM`


<!-- commit-bot-update -->
### 🤖 Automated Telemetry Status
- Heartbeat pulse checked at: `8/18/2026, 11:46:55 PM`


<!-- commit-bot-update -->
### 🤖 Automated Telemetry Status
- Heartbeat pulse checked at: `8/18/2026, 11:46:55 PM`


<!-- commit-bot-update -->
### 🤖 Automated Telemetry Status
- Heartbeat pulse checked at: `8/18/2026, 11:46:56 PM`


<!-- commit-bot-update -->
### 🤖 Automated Telemetry Status
- Heartbeat pulse checked at: `8/18/2026, 11:46:56 PM`


<!-- commit-bot-update -->
### 🤖 Automated Telemetry Status
- Heartbeat pulse checked at: `8/18/2026, 11:46:56 PM`


<!-- commit-bot-update -->
### 🤖 Automated Telemetry Status
- Heartbeat pulse checked at: `8/18/2026, 11:46:56 PM`


<!-- commit-bot-update -->
### 🤖 Automated Telemetry Status
- Heartbeat pulse checked at: `8/18/2026, 11:46:57 PM`


<!-- commit-bot-update -->
### 🤖 Automated Telemetry Status
- Heartbeat pulse checked at: `8/18/2026, 11:46:57 PM`


<!-- commit-bot-update -->
### 🤖 Automated Telemetry Status
- Heartbeat pulse checked at: `8/11/2026, 11:20:47 PM`


<!-- commit-bot-update -->
### 🤖 Automated Telemetry Status
- Heartbeat pulse checked at: `8/12/2026, 6:24:05 PM`


<!-- commit-bot-update -->
### 🤖 Automated Telemetry Status
- Heartbeat pulse checked at: `8/13/2026, 12:43:21 PM`


<!-- commit-bot-update -->
### 🤖 Automated Telemetry Status
- Heartbeat pulse checked at: `8/14/2026, 7:50:29 AM`
