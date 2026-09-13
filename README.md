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

## Structure

```
.
├── index.html … contact.html     # 9 pages, each with the shared header/footer inlined
├── assets/
│   ├── css/style.css             # design tokens + all component styles
│   ├── css/auth.css              # sign-in / sign-up layout
│   ├── js/main.js                # nav, search, carousels, counters, forms
│   ├── js/auth.js                # role tabs, validation, calls the auth API
│   └── img/                      # photography + favicon
├── api/
│   ├── _lib/                     # db, crypto, http, validation, rate limiting, sessions
│   └── auth/                     # signup, login, logout, me
├── db/
│   ├── schema.sql                # tables and indexes
│   ├── demo-register.sql         # demo rows for trying the portal
│   └── sample-register.csv       # the CSV shape the importer expects
├── scripts/
│   ├── dev-server.mjs            # static files + /api routes, for local work
│   ├── import-register.mjs       # spreadsheet CSV -> register table
│   └── test-auth.mjs             # 65 end-to-end auth tests
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

Anyone can open the sign-up page, but an account is only created when the details match
a row in the school register. That register is imported from the office spreadsheet, so
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

### Running it locally

```bash
npm install

# any PostgreSQL will do
export DATABASE_URL="postgres://user:pass@localhost:5432/bfss"

npm run db:setup     # create the tables
npm run db:demo      # optional: demo register rows to try it with
npm run dev          # http://localhost:3000
npm test             # 65 auth tests, needs DATABASE_URL
```

With `db:demo` loaded you can sign up as student `BFS/2025/0142`, surname Okafor, class
SS2; or as a teacher with `BFS/STF/014`, surname Ogun, using the staff email on file.

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

### Still to do

- **There is no portal behind the login yet.** Signing in sets a valid session and returns
  the user, then lands back on the homepage. The pages that show results, attendance and
  timetables are the next piece of work.
- **No password reset.** The login page tells students to ask their form teacher and
  everyone else to email ICT. A self-service reset needs email or SMS sending.
- **No "Continue with Google".** It was left off deliberately rather than shipped as a
  dead button: it needs a Google Cloud OAuth client and consent screen first.
- **Photographs are not collected at sign-up**, by choice. A photo an admin eyeballs does
  not verify anything the register does not already answer, and it would mean holding
  facial images of minors uploaded by unidentified people. The register check is both
  stronger and less risky. Where a photo does belong is as a school-taken ID photo shown
  to staff inside the portal.
