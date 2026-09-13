# Bright Future Secondary School - Website

A static, dependency-free website for Bright Future Secondary School, Lagos, built to match
the supplied homepage design (kept for reference at [`design/homepage-mockup.png`](design/homepage-mockup.png)).

Plain HTML, CSS and vanilla JavaScript, with no build step, no framework, no package manager.
Open `index.html` in a browser and it works.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Homepage: hero carousel, quick links, about, academics, admissions, news & events, gallery, portals, testimonials |
| `about.html` | Mission, vision, values, school history, leadership team, facilities |
| `academics.html` | JSS/SSS curriculum, teaching approach, WAEC results, school calendar |
| `admissions.html` | Application steps, requirements, key dates, fees, application form, FAQ |
| `students.html` | Student portal, e-learning, house system, clubs, school day, code of conduct |
| `parents.html` | Parent portal, communication, fees & payment, term dates, PTA, FAQ |
| `news.html` | News articles, upcoming events, newsletter sign-up |
| `gallery.html` | Photo gallery and photography/consent information |
| `contact.html` | Contact details, enquiry form, department directory, visiting information |
| `signup.html` | Create a portal account, checked against the school register |
| `login.html` | Sign in to the portal |
| `setup.html` | Setup status: what is working, what is not, what to do next |
| `portal.html` | Student dashboard |
| `parent.html` | Parent dashboard: one child's day, results, attendance and homework |
| `teacher.html` | Teacher dashboard: today's periods, classes and pupil numbers |
| `admin.html` | Admin dashboard: the roll, the staff list, portal accounts, sign-up state |
| `portal-profile.html` | The pupil's school record and subjects |
| `portal-classes.html` | Weekly timetable, one tab per day |
| `portal-assignments.html` | All assignments, filterable by status |
| `portal-results.html` | Subject scores with WAEC grades |
| `portal-attendance.html` | Attendance totals and recent days |
| `portal-messages.html` | Inbox; opening a message marks it read |
| `portal-calendar.html` | Term dates and announcements |
| `portal-resources.html` | Learning materials |
| `portal-settings.html` | Change password, account details |

## Structure

```
.
├── index.html … contact.html     # 9 pages, each with the shared header/footer inlined
├── assets/
│   ├── css/style.css             # design tokens + all component styles
│   ├── css/auth.css              # sign-in / sign-up layout
│   ├── js/main.js                # nav, search, carousels, counters, forms
│   ├── css/portal.css            # dashboard layout
│   ├── js/auth.js                # role tabs, validation, calls the auth API
│   ├── js/portal.js              # renders every dashboard, whichever role
│   └── img/                      # photography + favicon
├── api/
│   ├── _lib/                     # db, crypto, http, validation, rate limiting, sessions
│   ├── auth/[action].js          # one function for every /api/auth/* route
│   ├── auth/_routes/             # signup, login, logout, me, mode
│   ├── portal/[section].js       # one function for every /api/portal/* route
│   └── portal/_routes/           # dashboard, classes, assignments, results, attendance,
│                                 #   messages, profile, password, demo,
│                                 #   parent, teacher, admin
├── db/
│   ├── schema.sql                # accounts, sessions, register
│   ├── portal-schema.sql         # timetable, assignments, results, attendance
│   ├── demo-register.sql         # demo register rows
│   ├── demo-portal.sql           # demo timetable, results and attendance
│   └── sample-register.csv       # the CSV shape the importer expects
├── scripts/
│   ├── dev-server.mjs            # static files + /api routes, for local work
│   ├── build-schema.mjs          # db/*.sql -> api/_lib/schema.js, for the migrate endpoint
│   ├── check-deploy.mjs          # function count, dispatchers, schema drift
│   ├── db.mjs                    # setup / demo / status, no psql needed
│   ├── import-register.mjs       # spreadsheet CSV -> register table
│   ├── test-auth.mjs             # 65 end-to-end auth tests
│   ├── test-portal.mjs           # 31 pupil dashboard tests
│   ├── test-signup-mode.mjs      # 25 open/closed sign-up tests
│   └── test-roles.mjs            # 91 parent / teacher / admin tests
└── design/homepage-mockup.png    # the original design this build follows
```

The marketing pages are still plain static HTML with no build step. Only the portal
needs Node and a database.

## Running it

Any static host works. Locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly from the filesystem also works; nothing depends on a server.

## Design system

All colours, spacing, radii, shadows and fonts are CSS custom properties at the top of
`assets/css/style.css`. Rebranding is mostly a matter of editing that one block:

```css
--navy-900: #0a2452;   /* headers, footer, dark panels */
--blue-600: #1a6fe0;   /* primary action colour       */
--green / --purple / --orange / --teal / --pink   /* quick-link + card accents */
```

Fonts are Plus Jakarta Sans (headings) and Inter (body), loaded from Google Fonts with a
system-font fallback stack, so the site still renders correctly offline.

## JavaScript

`assets/js/main.js` is one IIFE with no dependencies. Every widget is opt-in via a `data-`
attribute and silently does nothing if the markup isn't on the page:

| Attribute | Behaviour |
| --- | --- |
| `data-hero` | Hero carousel: arrows, auto-advance every 7s, pauses on hover/focus |
| `data-rail` | Horizontal scrolling rail (homepage gallery) |
| `data-testimonials` | Testimonial rotator with generated dot navigation |
| `data-count-to` | Counts a statistic up when it scrolls into view |
| `data-nav-toggle` | Mobile navigation drawer |
| `data-search-toggle` | Header search panel |
| `data-dropdown` | Header login menu |
| `data-to-top` | Back-to-top button |
| `data-demo-form` | Client-side form validation and confirmation message |
| `.reveal` | Fade/slide element in on scroll |

`prefers-reduced-motion` is respected throughout: auto-advancing carousels, counters and
reveal animations all stand down.

## Accessibility & responsiveness

- Skip link, landmark elements, `aria-current` on the active nav item, labelled controls
  and `aria-expanded` state on every toggle.
- Every image has alt text; decorative SVG is `aria-hidden`.
- Layouts reflow at 1180px, 1080px (nav collapses to a drawer), 860px, 640px and 420px;
  no page scrolls horizontally at 390px.
- Print stylesheet hides the chrome.

## Known gaps

These need a decision or a backend before the site goes live:

1. **The public forms are front-end only.** The application, contact and newsletter forms
   validate and show a confirmation, but submit nowhere. Each one says so on the page.
   Point them at a real endpoint (or a form service) when one exists. Sign-in and sign-up
   are the exception: those are real, see "The portal" below.
2. **Images are low-resolution.** The photography was extracted from the design mockup at
   thumbnail size (as small as 170x60), so it goes soft when scaled up. No code change can
   add detail back; the fix is real photographs. `hero-campus.png` and `about-campus.png`
   were additionally cropped, because the mockup's own hero copy, carousel pill and quote
   card were baked into those crops and showed through as ghost UI.

   Drop replacements into `assets/img/` using the **same filenames** and every page picks
   them up automatically. Everything uses `object-fit: cover`, so exact aspect ratios are
   forgiving. Suggested sizes (roughly 2x the largest display size, for sharp rendering on
   high-density screens):

   | File | Now | Suggested | Shown as |
   | --- | --- | --- | --- |
   | `hero-campus.png` | 548x230 | 2400x1000 | Full-width homepage hero |
   | `about-campus.png` | 328x220 | 1200x800 | About figure, ~590x330 |
   | `admissions-student.png` | 220x165 | 700x760 | Admissions promo, portrait crop |
   | `news-academic-session.png` | 205x80 | 800x450 | News card, 16:9 |
   | `news-sports.png` | 220x80 | 800x450 | News card, 16:9 |
   | `news-ict.png` | 175x80 | 800x450 | News card, 16:9 |
   | `gallery-*.png` (5 files) | ~170x60 | 900x560 | Gallery tiles, 16:10 |

   Current magnification, measured in Chromium (`object-fit: cover`, so the larger axis wins):

   | Where | Source | Desktop | Phone |
   | --- | --- | --- | --- |
   | Hero slide 1 | `hero-campus.png` 548x230 | 2.34x | 2.34x |
   | Hero slide 2 | `about-campus.png` 328x220 | 3.90x | 2.32x |
   | Hero slide 3 | `hero-campus.png` 548x230, alt crop | 2.34x | 2.22x |
   | News cards | ~205x80 | 1.78x | 1.44x |
   | Gallery tiles | ~170x60 | 2.88x | 1.72x |

   Hero slide 3 was originally `gallery-graduation.png`, a 170x60 gallery thumbnail, which
   stretched to 7.5x across the full page width and was visibly mushy. It now reuses the
   campus photograph at a different crop (`.hero__media--alt`). **Restore the graduation
   photo as soon as a full-size one exists** by pointing that slide's `src` back at
   `assets/img/gallery-graduation.png`; there is a comment in `index.html` marking the spot.

   News cards use a 112px side thumbnail on phones rather than a full-width banner, which is
   why they stay reasonably crisp.
3. **Placeholder content.** Contact details, fees, results, term dates, staff names and news
   items are realistic drafts, not the school's real data, so replace them before publishing. The
   homepage news and events reproduce the dates shown in the mockup (Aug/Sep 2025), while the
   footer copyright year is generated from the visitor's clock, so the two will disagree until
   the content is refreshed.
4. **Contact page map** is a styled placeholder pending the school's exact coordinates.
5. **Search** is a UI shell; it reports that lookup isn't connected yet.
6. **Social and legal links** (`href="#"`) need real destinations.
7. **Sign-in and sign-up are built** and need a database to run. See "The portal" below
   for setup, and for what is deliberately not included.

## The portal

Sign-in and sign-up are built and working. The site stays static; the portal is four
serverless functions under `api/` plus a PostgreSQL database.

### How sign-up is kept closed

Once a register has been imported, anyone can open the sign-up page but an account is only
created when the details match a row in it. Before that import, sign-up is open so the site
can be set up; see "Open sign-up" above. That register is imported from the office spreadsheet, so
the school decides who exists, not the form.

| Role | What must match |
| --- | --- |
| Student | Admission number exists and is `active`, the class chosen matches the register, and the surname on file appears in the name given |
| Parent | The same admission number and class, **and** the email or phone entered is one already held for that child |
| Teacher | Staff number exists and is `active`, surname matches, and where the school recorded an email for that member of staff, it is the one used |

Every failure returns the same message, so the form cannot be used to discover who attends
or teaches at the school. A pupil marked `left` cannot sign up. One student account and one
parent account per child, one account per member of staff, all enforced by unique indexes
rather than by application code.

### Security

- **Passwords** are hashed with scrypt (N=32768, r=8, p=1, 64-byte key, 16-byte random
  salt), using only `node:crypto`, so there is no native build step. Verification is a
  constant-time compare.
- **A failed login spends the same time** whether the email exists or not, so the response
  time does not reveal which addresses are registered.
- **Sessions** are 256-bit random tokens. Only their SHA-256 is stored, so a database leak
  does not hand over live sessions. The cookie is `HttpOnly`, `SameSite=Lax` and `Secure`
  over HTTPS, and expires after 7 days.
- **Rate limiting** counts failed attempts per IP and per identifier over 15 minutes
  (6 logins, 5 sign-ups per identifier). It lives in the database because serverless
  instances do not share memory.
- **Every query is parameterised.** There is no string concatenation anywhere near SQL.
- **Request bodies are capped at 16KB**, rejected on `Content-Length` before being read.
- Responses never include the password hash.

### Getting it running

You need a PostgreSQL database. Without one the site still serves, but sign-up and the
portal return 503 with a "contact the school office" message rather than pretending to
work. There is no way around this: accounts have to live somewhere.

**Stuck? Open `/setup.html` on the deployed site.** It checks each piece in turn (API
deployed, database connected, tables created) and names the next action. It reports only
whether each piece is in place, never the connection string and nothing about who is on the
register.

**On Vercel, from nothing to a working sign-up. No terminal needed:**

1. Create a free Postgres. Neon (neon.tech) and Supabase both have a free tier, and Vercel
   offers one under Storage. Copy the connection string, which looks like
   `postgres://user:password@host/dbname?sslmode=require`.
2. In your Vercel project: **Settings -> Environment Variables**, add `DATABASE_URL` with
   that value, for all environments. Redeploy so it takes effect.
3. Open **`/setup.html`** on the site. It will say the database is connected but the tables
   are missing, with a **Create the tables** button. Press it.
4. Optionally press **Load sample data** for a timetable, results and announcements, so a
   new account has something to show.
5. Press **Create an account**. Any admission number works while sign-up is open.

Steps 3 and 4 exist because setting this up from a phone is the common case. They are safe
to expose: the SQL is fixed and shipped with the function rather than taken from the
request, every statement only adds (`CREATE ... IF NOT EXISTS`), and each refuses once it
has been done, so neither can overwrite a real school's data.

**From a terminal instead**, if you have one:

```bash
npm install
export DATABASE_URL="postgres://...(the same string)"
npm run db:setup     # create the tables
npm run db:demo      # optional sample data
npm run db:status    # what is connected, and whether sign-up is open
```

`db:setup` and `db:demo` run through the `pg` driver, so the `psql` client is not required.

**Locally:**

```bash
npm install
export DATABASE_URL="postgres://user:pass@localhost:5432/bfss"
npm run db:setup
npm run db:demo
npm run dev          # http://localhost:3000
npm run check        # deployment checks, no database needed
npm test             # checks + 212 API tests, needs DATABASE_URL
npm run test:roles   # just the parent, teacher and admin dashboards
```

Each suite puts the database into a known state before it runs, so they pass in any order.

### Open sign-up

Sign-up is **open until a real register is imported**. On a fresh database any admission or
staff number is accepted, and a register entry is created from what was typed, so the person
setting the site up can make an account and look around without seeding data first. The
sign-up page says which mode it is in, so nobody has to guess.

Importing a register with `npm run import:register` closes it automatically: from then on
details must match a row. Demo rows loaded by `npm run db:demo` are marked as demo and do
**not** close it, so sample data and open sign-up work together.

Override with an environment variable when you need to:

| `PORTAL_OPEN_SIGNUP` | Behaviour |
| --- | --- |
| unset | Open until a register is imported. The default |
| `true` | Always open. Evaluation only: anyone on the internet can create an account |
| `false` | Always require a register match, even on an empty database |

`npm run db:status` prints which mode is currently in force.

Everything else still applies in open mode: password rules, the duplicate checks, and rate
limiting, so it cannot be used to create accounts in bulk.

**Before real pupils use the site, import the register.** That is what turns the check on.

### Loading the real register from the spreadsheet

Export the office spreadsheet to CSV, then:

```bash
node scripts/import-register.mjs students register.csv
node scripts/import-register.mjs staff staff.csv
```

Students CSV columns (header row required, order does not matter):
`admission_no, surname, other_names, class_level, guardian_email, guardian_phone, status`
Staff: `staff_no, surname, other_names, email, status`

`db/sample-register.csv` shows the shape. Re-running is safe: rows are matched on
admission or staff number and updated, so the spreadsheet stays the source of truth. Bad
rows are reported with their line number and skipped rather than half-imported, and the
command exits non-zero if anything was skipped.

**A pupil who leaves should be set to `status=left`, not deleted.** That keeps any existing
account linked while blocking a fresh sign-up.

Real exports are git-ignored: `*.csv` is excluded so a file of children's data cannot be
committed by accident.

### Deploying

**Serverless function count.** Vercel's Hobby plan allows 12 Serverless Functions per
deployment, and every routable file under `api/` counts as one. A file per endpoint took
this past the limit and the build failed with *"No more than 12 Serverless Functions can be
added to a Deployment on the Hobby plan"*.

The endpoints are therefore collapsed behind two dynamic routes,
`api/auth/[action].js` and `api/portal/[section].js`, which dispatch to the handlers in
`_routes/`. Directories beginning with an underscore are not turned into functions. Every
URL is unchanged, and the whole group now shares one database pool instead of opening one
per endpoint, which matters on a small Postgres plan.

`npm run check` fails if the count creeps back over the limit, if a dispatcher imports a
handler that does not exist, or if a handler exists that nothing routes to. It runs first
as part of `npm test` and needs no database.

**To add an endpoint:** put it in the relevant `_routes/` folder and add it to that
dispatcher's import list. Do not add a new top-level file under `api/`.

On Vercel the `api/` directory is picked up automatically. Set `DATABASE_URL` as an
environment variable (Neon, Supabase and Vercel Postgres all work; use their pooled
connection string), then run `npm run db:setup` once against it and import the register.

Without `DATABASE_URL` the marketing site still serves normally and the auth endpoints
return 503 with a "contact the school office" message, rather than pretending to work.

### API

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/auth/signup` | POST | Create an account, checked against the register. 201 on success |
| `/api/auth/login` | POST | Email and password, sets the session cookie |
| `/api/auth/logout` | POST | Revokes the session server-side and clears the cookie |
| `/api/auth/me` | GET | The signed-in user, or 401 |
| `/api/portal/dashboard` | GET | Everything the dashboard shows, for the signed-in pupil |
| `/api/portal/parent` | GET | The linked child's day, results, attendance and homework |
| `/api/portal/teacher` | GET | The teacher's own periods, classes and pupil numbers |
| `/api/portal/admin` | GET | School-wide totals, roll by class, newest accounts |
| `/api/portal/classes` | GET | The week's timetable for their class |
| `/api/portal/assignments` | GET | Assignments with this pupil's submitted state |
| `/api/portal/results` | GET | Subject scores and the overall average |
| `/api/portal/attendance` | GET | Attendance totals and recent days |
| `/api/portal/messages` | GET, POST | The inbox; POST `{id}` marks one read |
| `/api/portal/profile` | GET | Their record, guardian contacts and subjects |
| `/api/portal/password` | POST | Change password; ends every other session |
| `/api/portal/demo` | GET | Sample student for the preview; no database, no sign-in |
| `/api/auth/mode` | GET | Whether a database is attached and whether sign-up is open |
| `/api/auth/migrate` | POST | Create the tables. Refuses once they exist |
| `/api/auth/seed` | POST | Load the sample data. Refuses once the register has rows |

### The portal pages

Thirteen pages share one shell (`assets/js/portal.js` reads `body[data-portal-page]`,
fetches that section once and renders it), so the sidebar, top bar and identity block are
defined in a single place.

Everything is keyed on the `register_id` (or `staff_id`) attached to the session, never on
anything in the request, so a pupil can only ever load their own record and a parent only
the child the school linked them to. Marking a message read carries the same condition, so
passing another pupil's message id simply matches no row. Signing out revokes the session
server-side, and changing your password ends every other session.

### One dashboard per role

| Role | Lands on | Sees |
| --- | --- | --- |
| Student | `portal.html` | Their own timetable, assignments, results, attendance, messages |
| Parent | `parent.html` | One child: today's lessons, homework, results, attendance |
| Teacher | `teacher.html` | Their own periods, the classes they take, pupil numbers |
| Administrator | their role's page, plus `admin.html` | The roll by class, staff and account totals, newest accounts, sign-up state |

Opening someone else's dashboard returns 403 with the address of your own, and the page
offers a button straight to it rather than a dead end.

Each role's sidebar lists only what works for that role; anything not built yet is shown
greyed out and labelled "Soon" rather than being a link that goes nowhere.

**Administrators.** `users.is_admin` is separate from the role, because being an
administrator is an extra power rather than a different identity: an admin still lands on
their own dashboard and reaches the admin view from a sidebar link that is hidden for
everyone else. The first **staff** account created on a site that has no administrator yet
becomes one, so whoever sets the school up can get in without editing the database. It has
to be staff: the admin view reads across every pupil's record, so a pupil who happens to
sign up first must not be handed it. `PORTAL_ADMIN_EMAILS` (comma separated) names further
administrators. The admin endpoint returns names, roles and emails only; never a password
hash and never a session token.

Grades on the results page follow the WAEC scale (A1 75+, B2 70-74, B3 65-69, C4 60-64,
C5 55-59, C6 50-54, D7 45-49, E8 40-44, F9 below 40).

### Signing up before a database exists

If no `DATABASE_URL` is attached, the sign-up form still works, but as a preview: the
details are kept in `localStorage` on that device and the portal shows them instead of the
sample pupil. The page says so before submitting, the confirmation repeats it, and a banner
on every portal page states that no account exists at the school and nothing was sent to it,
with a link to clear it.

No password is stored, because nothing checks one. This is a way to look around before
committing to a database, not an account system: real accounts need `DATABASE_URL`.

### Demo preview

Add `?demo=1` to any portal page to see it with fixed sample data, with no account and no
database. That works for every role:

```
https://your-site.vercel.app/portal.html?demo=1     # pupil
https://your-site.vercel.app/parent.html?demo=1     # parent
https://your-site.vercel.app/teacher.html?demo=1    # teacher
https://your-site.vercel.app/admin.html?demo=1      # administrator
```

It reads `/api/portal/demo`, which never touches the database, so it works on a deployment
that has no `DATABASE_URL` yet. Every page carries a banner saying it is a preview, the flag
follows you as you move around the sidebar, and changing a password is refused. It exists so
the school can see the portal before their register is loaded.

### Still to do

- **The parent, teacher and admin views are one page each.** They read live data, but the
  deeper sections behind them (take a register, enter results, edit the roll, post an
  announcement) are not built; those sidebar items are labelled "Soon" rather than linking
  nowhere. Messages and settings are pupil-only for now.
- **Nothing writes back yet.** A teacher cannot mark a register or enter a score from the
  portal, and an administrator cannot edit an account. Every dashboard is read-only.
- **Portal search does nothing**, and there is no way to hand work in or reply to a message
  from the portal. Each page says so where it applies.
- **No password reset.** The login page tells students to ask their form teacher and
  everyone else to email ICT. A self-service reset needs email or SMS sending.
- **No "Continue with Google".** It was left off deliberately rather than shipped as a
  dead button: it needs a Google Cloud OAuth client and consent screen first.
- **Photographs are not collected at sign-up**, by choice. A photo an admin eyeballs does
  not verify anything the register does not already answer, and it would mean holding
  facial images of minors uploaded by unidentified people. The register check is both
  stronger and less risky. Where a photo does belong is as a school-taken ID photo shown
  to staff inside the portal.
