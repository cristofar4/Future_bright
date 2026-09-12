# Bright Future Secondary School — Website

A static, dependency-free website for Bright Future Secondary School, Lagos, built to match
the supplied homepage design (kept for reference at [`design/homepage-mockup.png`](design/homepage-mockup.png)).

Plain HTML, CSS and vanilla JavaScript — no build step, no framework, no package manager.
Open `index.html` in a browser and it works.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Homepage — hero carousel, quick links, about, academics, admissions, news & events, gallery, portals, testimonials |
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

Opening `index.html` directly from the filesystem also works — nothing depends on a server.

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
| `data-hero` | Hero carousel — arrows, auto-advance every 7s, pauses on hover/focus |
| `data-rail` | Horizontal scrolling rail (homepage gallery) |
| `data-testimonials` | Testimonial rotator with generated dot navigation |
| `data-count-to` | Counts a statistic up when it scrolls into view |
| `data-nav-toggle` | Mobile navigation drawer |
| `data-search-toggle` | Header search panel |
| `data-dropdown` | Header login menu |
| `data-to-top` | Back-to-top button |
| `data-demo-form` | Client-side form validation and confirmation message |
| `.reveal` | Fade/slide element in on scroll |

`prefers-reduced-motion` is respected throughout — auto-advancing carousels, counters and
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

1. **Forms are front-end only.** The application, contact, newsletter and both portal
   sign-in forms validate and show a confirmation, but submit nowhere. Each one says so
   on the page. Point them at a real endpoint (or a form service) when one exists.
2. **Images are low-resolution.** The photography was extracted from the design mockup at
   thumbnail size, so it is soft when scaled up. Drop higher-resolution files into
   `assets/img/` using the same filenames and every page picks them up.
3. **Placeholder content.** Contact details, fees, results, term dates, staff names and news
   items are realistic drafts, not the school's real data — replace before publishing. The
   homepage news and events reproduce the dates shown in the mockup (Aug/Sep 2025), while the
   footer copyright year is generated from the visitor's clock, so the two will disagree until
   the content is refreshed.
4. **Contact page map** is a styled placeholder pending the school's exact coordinates.
5. **Search** is a UI shell; it reports that lookup isn't connected yet.
6. **Social and legal links** (`href="#"`) need real destinations.
