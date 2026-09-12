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
7. **There is no sign-in or account creation.** The header Login menu and both portal
   sign-in forms were removed deliberately, so no visitor can create an account for
   themselves. The Students and Parents pages now explain that portal accounts are issued
   by the school office. Adding real accounts means adding a backend: see
   "Portal accounts" below.

## Portal accounts

**Decision: the site ships with no sign-in and no sign-up.** Accounts are issued by the
school office, and the Students and Parents pages say so. Everything below is the design
to build against when a backend exists; nothing here is implemented yet.

### Why there is no public sign-up

Self-registration on a school site has no way to tell an enrolled student from anyone else
on the internet. The school already holds the authoritative answer in the admission
register, so verification should start from that register rather than from a stranger's
submission.

A "sign up and upload a photo of yourself for an admin to approve" flow was considered and
rejected:

- It does not verify anything. Whoever reviews signups will not recognise most of 500+
  students by face; and where they do recognise someone, checking the name against the
  register would have been enough on its own.
- It is trivially defeated. Any photo of any student in uniform passes, including ones
  taken from this site's own gallery page.
- It collects facial photographs of minors from unidentified submitters. Nigeria's Data
  Protection Act 2023 treats children's data with heightened care and parental consent,
  so that is a standing obligation taken on in exchange for a control that does not work.
  An open upload pointed at a staff review queue also invites content nobody wants there.
- Someone has to review every request, forever, for a weak signal.

Note that sign-in and sign-up are separate things. Removing self-registration is the point;
sign-in was removed only because there is no backend behind it yet, and a login form that
authenticates nothing is worse than none.

### Recommended: school-issued accounts

Simplest and strongest for a single school, and what the site currently describes:

1. ICT bulk-creates accounts from the admission register at the start of each term.
2. Form teachers hand each student a slip with a username and a one-time password.
3. Parents receive theirs by SMS or email to the number already held on file.

No review queue, no upload handling, no self-service fraud surface.

### If self-service is wanted later: claim, do not create

Reduces office workload without letting anyone register from outside:

1. Student or parent enters admission number plus date of birth.
2. Server checks both against the register, and that the account is not already claimed.
3. A one-time code is sent to the phone or email **already on file** for that family. It is
   never sent to an address supplied in the form.
4. They enter the code and set their own password.

An outsider fails at step 2 (needs a real admission number) or step 3 (needs access to that
family's phone or email). No admin review, no photographs.

Build notes: rate-limit step 1 per IP and per admission number so the register cannot be
enumerated; expire codes in ~10 minutes and allow a small number of attempts; return the
same response whether or not the admission number exists, so the form cannot be used to
confirm who attends the school; store passwords with a slow hash such as argon2 or bcrypt.

### Where a photograph does belong

As a student ID photo taken by the school at enrolment and shown to staff inside the
portal: the school's own photograph of its own student, not an unverified upload.

### What this needs

The site is static today. Either flow requires a backend, roughly: Vercel plus a managed
Postgres (Neon or Supabase), an auth library for sessions and password hashing, and the
admission register loaded as data. The claim flow itself is a few hundred lines; getting
clean register data in is usually the larger job.
