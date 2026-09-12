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

## Structure

```
.
├── index.html … contact.html     # 9 pages, each with the shared header/footer inlined
├── assets/
│   ├── css/style.css             # design tokens + all component styles
│   ├── js/main.js                # nav, search, dropdown, carousels, counters, forms
│   └── img/                      # photography + favicon
└── design/homepage-mockup.png    # the original design this build follows
```

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

1. **Forms are front-end only.** The application, contact and newsletter forms validate and
   show a confirmation, but submit nowhere. Each one says so on the page. Point them at a
   real endpoint (or a form service) when one exists.
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
   | Hero slide 1 | `hero-campus.png` 548x230 | 2.34x | 2.06x |
   | Hero slide 2 | `about-campus.png` 328x220 | 3.90x | 2.04x |
   | Hero slide 3 | `gallery-graduation.png` 170x60 | **7.53x** | **7.05x** |
   | News cards | ~205x80 | 1.78x | 1.44x |
   | Gallery tiles | ~170x60 | 2.88x | 1.72x |

   Hero slide 3 is by far the worst: a gallery thumbnail is being stretched across the full
   width of the page. A real photograph at roughly 2400x1000 fixes it outright. News cards
   use a 112px side thumbnail on phones rather than a full-width banner, which is why they
   stay reasonably crisp.
3. **Placeholder content.** Contact details, fees, results, term dates, staff names and news
   items are realistic drafts, not the school's real data, so replace them before publishing. The
   homepage news and events reproduce the dates shown in the mockup (Aug/Sep 2025), while the
   footer copyright year is generated from the visitor's clock, so the two will disagree until
   the content is refreshed.
4. **Contact page map** is a styled placeholder pending the school's exact coordinates.
5. **Search** is a UI shell; it reports that lookup isn't connected yet.
6. **Social and legal links** (`href="#"`) need real destinations.
7. **There is no sign-in or account creation.** The header Login menu and both portal
   sign-in forms were removed deliberately, so no visitor can create an account for
   themselves. The Students and Parents pages now explain that portal accounts are issued
   by the school office. Adding real accounts means adding a backend: see
   "Portal accounts" below.

## Portal accounts

The site is static, so it has no user accounts, no database and no way to verify who a
visitor is. Any real portal (including a "sign up and upload a photo for the admin to
approve" flow) needs server-side pieces this repo does not have yet:

- a database of students, parents and staff;
- authentication with hashed passwords and session or token handling;
- file upload and private storage for identity photos, which are personal data about
  children and must not sit in a public folder;
- an admin review screen to approve or reject each request;
- email or SMS to tell the applicant the outcome.

Until that exists, issuing accounts through the school office is the safer arrangement:
the school already knows who its students are, so there is nothing for an outsider to
slip through.
