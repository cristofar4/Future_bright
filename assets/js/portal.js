/* ==========================================================================
   Student portal. One script for every page: it reads body[data-portal-page],
   fetches that section once, and renders it.

   ?demo=1 reads a fixed sample student from /api/portal/demo instead, so the
   portal can be shown before a database is connected. The page is labelled as
   a preview whenever that is what you are looking at.
   ========================================================================== */
(function () {
  "use strict";

  var PAGE = document.body.getAttribute("data-portal-page") || "dashboard";
  var DEMO = new URLSearchParams(window.location.search).get("demo") === "1";

  // Details someone entered on the sign-up form while no database was attached.
  var PREVIEW_KEY = "bfss_preview_account";

  // Whether this person has hidden the sidebar on a wide screen.
  var COLLAPSE_KEY = "bfss_side_collapsed";

  function previewAccount() {
    try {
      var raw = window.localStorage.getItem(PREVIEW_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;                              // private browsing, or corrupt
    }
  }

  function clearPreview() {
    try { window.localStorage.removeItem(PREVIEW_KEY); } catch (err) { /* nothing to do */ }
  }

  var ACCENTS = { blue:"bg-blue", green:"bg-green", purple:"bg-purple",
                  orange:"bg-orange", teal:"bg-teal", pink:"bg-pink", navy:"bg-navy" };

  var SUBJECT_ICON = {
    calc:   '<path d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/><rect x="4" y="2.5" width="16" height="19" rx="2.4"/>',
    book:   '<path d="M3 4.8h5.2A3.8 3.8 0 0112 8.6v11a3 3 0 00-3-3H3z"/><path d="M21 4.8h-5.2A3.8 3.8 0 0012 8.6v11a3 3 0 013-3h6z"/>',
    leaf:   '<path d="M20 4s-1.5 12-9 12a5 5 0 01-5-5c0-5 7-7 14-7z"/><path d="M4.5 20c2-5 5.5-8 10-10"/>',
    laptop: '<rect x="4" y="4.5" width="16" height="11" rx="2"/><path d="M2 19h20"/>',
    atom:   '<circle cx="12" cy="12" r="2.4"/><path d="M12 3c4.5 0 8 4 8 9s-3.5 9-8 9-8-4-8-9 3.5-9 8-9z"/><path d="M4.2 8.2c2.2-2.6 12.4-2.6 15.6 0M4.2 15.8c2.2 2.6 12.4 2.6 15.6 0"/>',
    flask:  '<path d="M10 2.8v6L4.7 18a2.4 2.4 0 002.1 3.5h10.4A2.4 2.4 0 0019.3 18L14 8.8v-6"/><path d="M8.6 2.8h6.8M7.4 14.5h9.2"/>',
  };

  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  /* Names here are very often written with a title, and "Good afternoon, Dr.!"
     is not a greeting. The API strips honorifics the same way. */
  var HONORIFICS = ["mr","mrs","ms","miss","mx","dr","prof","professor","engr","engineer",
                    "arc","barr","chief","alhaji","alhaja","hajia","rev","revd","reverend",
                    "pastor","fr","bishop","elder","deacon","deaconess","capt","col","gen",
                    "sir","lady","madam","mallam","oba"];

  function nameParts(fullName) {
    var words = String(fullName || "").split(/\s+/).filter(Boolean);
    var rest = words.filter(function (w, i) {
      return !(i === 0 && HONORIFICS.indexOf(w.replace(/\.$/, "").toLowerCase()) !== -1);
    });
    return rest.length ? rest : words;              // a title and nothing else
  }

  function svg(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + "</svg>";
  }

  /** Everything from the API becomes text, never markup. */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  function setAll(selector, value) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (n) {
      n.textContent = value;
    });
  }

  function clear(node) { while (node && node.firstChild) { node.removeChild(node.firstChild); } }
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  function shortDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : MONTHS[d.getMonth()] + " " + String(d.getDate()).padStart(2, "0") + ", " + d.getFullYear();
  }
  function longDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : DAY_NAMES[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }
  function whenSent(iso) {
    var d = new Date(iso);
    if (isNaN(d)) { return ""; }
    var mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 60) { return plural(Math.max(mins, 1), "minute") + " ago"; }
    if (mins < 60 * 24) { return plural(Math.round(mins / 60), "hour") + " ago"; }
    if (mins < 60 * 24 * 7) { return plural(Math.round(mins / (60 * 24)), "day") + " ago"; }
    return shortDate(iso);
  }

  /* The server runs in UTC, so for pages it does not greet, read the clock of
     whoever is looking at the page. */
  function localGreeting() {
    var h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }

  /** JSS2 / A, written out the way a timetable or a letter home would. */
  function className(level, arm) {
    var m = /^(JSS|SS)(\d)$/i.exec(String(level || ""));
    var name = m
      ? (m[1].toUpperCase() === "JSS" ? "Junior" : "Senior") + " Secondary " + m[2]
      : String(level || "");
    return arm ? name + ", Arm " + String(arm).toUpperCase() : name;
  }

  /** WAEC grading, which is what a Nigerian secondary school report uses. */
  function grade(score) {
    if (score >= 75) { return { code: "A1", remark: "Excellent", tone: "done" }; }
    if (score >= 70) { return { code: "B2", remark: "Very good", tone: "done" }; }
    if (score >= 65) { return { code: "B3", remark: "Good", tone: "done" }; }
    if (score >= 60) { return { code: "C4", remark: "Credit", tone: "todo" }; }
    if (score >= 55) { return { code: "C5", remark: "Credit", tone: "todo" }; }
    if (score >= 50) { return { code: "C6", remark: "Credit", tone: "todo" }; }
    if (score >= 45) { return { code: "D7", remark: "Pass", tone: "late" }; }
    if (score >= 40) { return { code: "E8", remark: "Pass", tone: "late" }; }
    return { code: "F9", remark: "Needs work", tone: "late" };
  }

  /* --- shared pieces ---------------------------------------------------- */

  /* Which object in the payload describes the person signed in. A parent page
     is headed by the parent, not by the child it is about. */
  var IDENTITY = { parent: "parent", teacher: "teacher", admin: "admin",
                   pupils: "admin", staff: "admin", notices: "admin" };

  function applyIdentity(data) {
    var key = IDENTITY[PAGE] || "student";
    var s = data[key] || data.student || {};

    // In preview, show the person who filled the form rather than the sample
    // pupil, but only on the dashboard their chosen role belongs to.
    var mine = DEMO ? previewAccount() : null;
    if (mine && mine.fullName && (mine.role || "student") === key) {
      var words = nameParts(mine.fullName);
      var over = {
        fullName: mine.fullName,
        firstName: words[0] || s.firstName,
        initials: words.slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(""),
        email: mine.email || s.email,
        phone: mine.phone || s.phone,
      };
      if (key === "student") {
        over.admissionNo = mine.reference || s.admissionNo;
        over.className = (mine.classLevel || "") ? mine.classLevel + "A" : s.className;
      }
      if (key === "teacher") { over.staffNo = mine.reference || s.staffNo; }
      s = Object.assign({}, s, over);
      var patch = {};
      patch[key] = s;
      data = Object.assign({}, data, patch);
    }
    setAll("[data-name]", s.fullName || "");
    setAll("[data-initials]", s.initials || "");
    setAll("[data-first-name]", s.firstName || "");
    if (key === "student") {
      setAll("[data-class]", s.className || "-");
      setAll("[data-admission]", s.admissionNo || "-");
    }
    // The admin view is reachable from any dashboard, but only by an admin.
    Array.prototype.forEach.call(document.querySelectorAll("[data-admin-only]"), function (n) {
      n.hidden = !s.isAdmin;
    });

    if (s.staffNo) { setAll("[data-staff-no]", s.staffNo); }
    if (s.email) { setAll("[data-email]", s.email); }
    setAll("[data-greeting]", data.greeting || localGreeting());

    if (data.term) {
      setAll("[data-session]", data.term.session);
      setAll("[data-term]", data.term.label);
      setAll("[data-days]", data.term.daysLeft);
    } else {
      setAll("[data-session]", "-");
      setAll("[data-term]", "Between terms");
      setAll("[data-days]", "-");
    }

    var unread = data.unreadMessages !== undefined ? data.unreadMessages : data.unread;
    if (unread !== undefined) {
      Array.prototype.forEach.call(document.querySelectorAll("[data-unread]"), function (b) {
        b.textContent = unread;
        b.hidden = !unread;
      });
    }
    return data;
  }

  function lessonRow(row, showClass) {
    var item = el("div", "lesson");
    var icon = el("span", "tile-icon " + (ACCENTS[row.accent] || "bg-blue"));
    icon.innerHTML = svg(SUBJECT_ICON[row.icon] || SUBJECT_ICON.book);
    item.appendChild(icon);
    item.appendChild(el("span", "lesson__time", row.starts_at + " - " + row.ends_at));
    var what = el("span", "lesson__what");
    what.appendChild(el("strong", null, row.subject));
    // A teacher already knows who is teaching: tell them which class it is.
    what.appendChild(el("span", null, (showClass ? row.class_name : row.teacher) || ""));
    item.appendChild(what);
    if (row.room) {
      var room = el("span", "lesson__room");
      room.innerHTML = svg('<path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>');
      room.appendChild(el("span", null, row.room));
      item.appendChild(room);
    }
    return item;
  }

  function renderLessons(host, list, showClass) {
    clear(host);
    if (!list.length) { host.appendChild(el("p", "empty-line", "No lessons scheduled.")); return; }
    list.forEach(function (row) { host.appendChild(lessonRow(row, showClass)); });
  }

  function taskRow(row) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var item = el("div", "task");
    var icon = el("span", "tile-icon tile-icon--soft");
    icon.innerHTML = svg('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>');
    item.appendChild(icon);

    var what = el("span", "task__what");
    what.appendChild(el("strong", null, row.title));
    if (row.brief) { what.appendChild(el("p", null, row.brief)); }
    var meta = "Due: " + shortDate(row.due_on);
    if (row.subject) { meta = row.subject + "  ·  " + meta; }
    what.appendChild(el("span", "task__due", meta));
    item.appendChild(what);

    var overdue = !row.submitted && new Date(row.due_on) < today;
    item.appendChild(el("span",
      "status " + (row.submitted ? "status--done" : overdue ? "status--late" : "status--todo"),
      row.submitted ? "Submitted" : overdue ? "Overdue" : "Pending"));
    return item;
  }

  function renderTasks(host, list) {
    clear(host);
    if (!list.length) { host.appendChild(el("p", "empty-line", "Nothing to show.")); return; }
    list.forEach(function (row) { host.appendChild(taskRow(row)); });
  }

  function renderBars(host, results) {
    clear(host);
    if (!results.length) { host.appendChild(el("p", "empty-line", "No results published yet.")); return; }
    results.forEach(function (row) {
      var line = el("div", "bar-row");
      line.appendChild(el("span", "bar-row__name", row.subject));
      var track = el("span", "bar-row__track");
      var fill = el("span", "bar-row__fill");
      track.appendChild(fill);
      line.appendChild(track);
      line.appendChild(el("span", "bar-row__pct", Math.round(row.score) + "%"));
      host.appendChild(line);
      requestAnimationFrame(function () {
        fill.style.width = Math.max(0, Math.min(100, row.score)) + "%";
      });
    });
  }

  /* renderBars fixes the scale at 0-100 because a score is a percentage. These
     bars compare counts, so the longest row is what the rest are drawn against. */
  function renderCountBars(host, rows, emptyText) {
    clear(host);
    if (!rows.length) { host.appendChild(el("p", "empty-line", emptyText)); return; }
    var top = rows.reduce(function (m, r) { return Math.max(m, r.value); }, 0) || 1;
    rows.forEach(function (row) {
      var line = el("div", "bar-row");
      line.appendChild(el("span", "bar-row__name", row.label));
      var track = el("span", "bar-row__track");
      var fill = el("span", "bar-row__fill");
      track.appendChild(fill);
      line.appendChild(track);
      line.appendChild(el("span", "bar-row__pct", String(row.value)));
      host.appendChild(line);
      requestAnimationFrame(function () {
        fill.style.width = Math.max(4, (row.value / top) * 100) + "%";
      });
    });
  }

  /* --- the roll and the staff list ------------------------------------- */

  /** A row someone can open. Everything from the API becomes text, never markup. */
  function personRow(row, opts) {
    var item = el("button", "person");
    item.type = "button";

    var avatar = el("span", "avatar avatar--sm", row.initials || "");
    avatar.setAttribute("aria-hidden", "true");
    item.appendChild(avatar);

    var who = el("span", "person__who");
    who.appendChild(el("strong", null, row.fullName || "(no name)"));
    who.appendChild(el("span", null, opts.subtitle(row)));
    item.appendChild(who);

    if (opts.tag) { item.appendChild(el("span", "person__tag", opts.tag(row))); }
    item.appendChild(el("span", "person__meta", opts.meta(row)));
    var chev = el("span");
    chev.innerHTML = svg('<path d="M9 6l6 6-6 6"/>');   // fixed markup, no data in it
    item.appendChild(chev.firstChild);

    item.addEventListener("click", function () {
      var url = new URL(window.location.href);
      url.searchParams.set("id", row.id);
      window.location.href = url.toString();
    });
    return item;
  }

  function renderPeople(host, list, opts) {
    clear(host);
    if (!list.length) {
      host.appendChild(el("p", "empty-line", opts.empty));
      return;
    }
    var wrap = el("div", "people");
    list.forEach(function (row) { wrap.appendChild(personRow(row, opts)); });
    host.appendChild(wrap);
  }

  function statePill(status) {
    var known = status === "active" || status === "left";
    var pill = el("span", "state-pill state-pill--" + (known ? status : "none"),
      status === "active" ? "On the register" : status === "left" ? "Has left" : "Unknown");
    return pill;
  }

  /** Search box, class filters and paging, shared by both list pages. */
  function initList(data, opts) {
    var form = document.querySelector("[data-list-form]");
    var input = document.querySelector("[data-q]");
    var chips = document.querySelector("[data-filters]");
    var pager = document.querySelector("[data-pager]");

    function go(params) {
      var url = new URL(window.location.href);
      url.searchParams.delete("id");
      Object.keys(params).forEach(function (k) {
        if (params[k]) { url.searchParams.set(k, params[k]); }
        else { url.searchParams.delete(k); }
      });
      window.location.href = url.toString();
    }

    if (input) { input.value = data.filters.q || ""; }
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        go({ q: input.value.trim(), page: "" });
      });
    }

    clear(chips);
    opts.chips(data).forEach(function (c) {
      var b = el("button", "chip" + (c.on ? " is-on" : ""), c.label);
      b.type = "button";
      if (c.count !== undefined) { b.appendChild(el("span", null, c.count)); }
      b.addEventListener("click", function () { go(c.params); });
      chips.appendChild(b);
    });

    setAll("[data-count]", data.total === 1 ? "1 person" : data.total + " people");

    if (data.pages > 1) {
      pager.hidden = false;
      setAll("[data-page-note]", "Page " + data.page + " of " + data.pages);
      var prev = pager.querySelector("[data-prev]");
      var next = pager.querySelector("[data-next]");
      prev.disabled = data.page <= 1;
      next.disabled = data.page >= data.pages;
      prev.addEventListener("click", function () { go({ page: String(data.page - 1) }); });
      next.addEventListener("click", function () { go({ page: String(data.page + 1) }); });
    }
  }

  /** Switch the page between the list and one person's record. */
  function showView(name) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (n) {
      n.hidden = n.getAttribute("data-view") !== name;
    });
  }

  function renderAccounts(host, list) {
    clear(host);
    if (!list.length) {
      host.appendChild(el("p", "empty-line", "Nobody has created an account for this record yet."));
      return;
    }
    list.forEach(function (row) {
      var line = el("div", "acct-row");
      var who = el("span", "acct-row__who");
      who.appendChild(el("strong", null, row.full_name));
      who.appendChild(el("span", null, row.email));
      line.appendChild(who);
      var role = row.is_admin ? "admin" : row.role;
      line.appendChild(el("span", "role-pill role-pill--" + role,
        role.charAt(0).toUpperCase() + role.slice(1)));
      line.appendChild(el("span", "acct-row__when",
        row.last_login_at ? "Seen " + whenSent(row.last_login_at) : "Never signed in"));
      host.appendChild(line);
    });
  }

  /* --- the notice board -------------------------------------------------- */

  var AUDIENCE_LABEL = { all: "Everyone", students: "Pupils", parents: "Parents", staff: "Staff" };

  /* Redrawn from the payload every write returns, so the board on screen is
     always the board in the database rather than a guess at it. */
  function renderNoticeBoard(d) {
    var host = document.querySelector("[data-notices]");
    var list = d.announcements || [];
    clear(host);

    if (!list.length) {
      host.appendChild(el("p", "empty-line",
        "Nothing is on the board. Write the first notice above."));
      return;
    }

    list.forEach(function (row) {
      var item = el("div", "notice-admin");
      item.setAttribute("data-notice", row.id);

      var when = new Date(row.published_on);
      var date = el("span", "note__date");
      date.appendChild(el("span", "note__mon", isNaN(when) ? "" : MONTHS[when.getMonth()]));
      date.appendChild(el("span", "note__day", isNaN(when) ? "" : when.getDate()));
      item.appendChild(date);

      var what = el("span", "notice-admin__what");
      what.appendChild(el("strong", null, row.title));
      what.appendChild(el("p", null, row.body));

      var meta = el("span", "notice-admin__meta");
      meta.appendChild(el("span", "aud-pill aud-pill--" + row.audience,
        AUDIENCE_LABEL[row.audience] || row.audience));
      if (row.scheduled) {
        var sched = el("span", "sched-pill");
        sched.innerHTML = svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.3 2"/>');
        sched.appendChild(document.createTextNode("Goes up " + shortDate(row.published_on)));
        meta.appendChild(sched);
      }
      meta.appendChild(el("span", null, row.author ? "by " + row.author : "by the school office"));
      if (row.updated_at) { meta.appendChild(el("span", null, "edited " + whenSent(row.updated_at))); }
      what.appendChild(meta);
      item.appendChild(what);

      var acts = el("span", "notice-admin__acts");
      var edit = el("button", "btn btn--sm btn--outline", "Edit");
      edit.type = "button";
      edit.addEventListener("click", function () { fillNoticeForm(row); });
      acts.appendChild(edit);

      var del = el("button", "btn btn--sm btn--outline", "Delete");
      del.type = "button";
      del.addEventListener("click", function () { askToDelete(item, row); });
      acts.appendChild(del);
      item.appendChild(acts);

      host.appendChild(item);
    });
  }

  /* Taking a notice down is the one thing here that cannot be undone, so it
     asks first, in place, rather than trusting a stray click. */
  function askToDelete(item, row) {
    if (item.querySelector(".confirm-line")) { return; }
    var line = el("div", "confirm-line");
    line.appendChild(el("span", null, "Take \u201c" + row.title + "\u201d down for good?"));
    var yes = el("button", "btn btn--sm", "Yes, delete it");
    yes.type = "button";
    var no = el("button", "btn btn--sm btn--outline", "Keep it");
    no.type = "button";
    no.addEventListener("click", function () { line.remove(); });
    yes.addEventListener("click", function () {
      yes.setAttribute("aria-busy", "true");
      sendNotice("DELETE", "/api/portal/announcements?id=" + encodeURIComponent(row.id));
    });
    line.appendChild(yes);
    line.appendChild(no);
    item.querySelector(".notice-admin__what").appendChild(line);
  }

  function noticeForm() { return document.querySelector("[data-notice-form]"); }

  function fillNoticeForm(row) {
    var form = noticeForm();
    form.elements.id.value = row.id;
    form.elements.title.value = row.title;
    form.elements.body.value = row.body;
    form.elements.audience.value = row.audience;
    form.elements.publishedOn.value = String(row.published_on).slice(0, 10);
    setAll("[data-compose-title]", "Edit a Notice");
    setAll("[data-submit-text]", "Save changes");
    document.querySelector("[data-cancel]").hidden = false;
    Array.prototype.forEach.call(document.querySelectorAll("[data-notice]"), function (n) {
      n.classList.toggle("is-editing", n.getAttribute("data-notice") === String(row.id));
    });
    countNoticeBody();
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    form.elements.title.focus({ preventScroll: true });
  }

  function resetNoticeForm() {
    var form = noticeForm();
    form.reset();
    form.elements.id.value = "";
    setAll("[data-compose-title]", "Write a Notice");
    setAll("[data-submit-text]", "Post it");
    document.querySelector("[data-cancel]").hidden = true;
    Array.prototype.forEach.call(document.querySelectorAll("[data-notice]"), function (n) {
      n.classList.remove("is-editing");
    });
    clearNoticeErrors();
    countNoticeBody();
  }

  function clearNoticeErrors() {
    var form = noticeForm();
    Array.prototype.forEach.call(form.querySelectorAll("[data-error-for]"), function (n) {
      n.textContent = "";
    });
    Array.prototype.forEach.call(form.querySelectorAll(".field"), function (n) {
      n.classList.remove("has-error");
    });
  }

  function noticeAlert(message, tone) {
    var box = document.querySelector("[data-alert]");
    box.className = "auth-alert auth-alert--" + (tone || "error") + " is-shown";
    // The box is coloured for the outcome, so the icon in it has to agree.
    var mark = box.querySelector("svg");
    if (mark) {
      mark.innerHTML = tone === "ok"
        ? '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
        : '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.4h.01"/>';
    }
    box.querySelector("[data-alert-text]").textContent = message;
  }

  function countNoticeBody() {
    var body = noticeForm().elements.body;
    var left = 4000 - body.value.length;
    var note = document.querySelector("[data-body-count]");
    note.textContent = left < 400 ? left + " characters left" : "";
    note.classList.toggle("is-over", left < 0);
  }

  async function sendNotice(method, url, payload) {
    var form = noticeForm();
    var button = form.querySelector("[data-submit]");
    button.setAttribute("aria-busy", "true");
    clearNoticeErrors();
    document.querySelector("[data-alert]").classList.remove("is-shown");
    try {
      var res = await fetch(url, {
        method: method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      var data = await res.json().catch(function () { return {}; });

      if (res.status === 401) { window.location.replace("login.html"); return; }
      if (!res.ok) {
        if (data.field) {
          var slot = form.querySelector('[data-error-for="' + data.field + '"]');
          if (slot) {
            slot.textContent = data.message;
            slot.closest(".field").classList.add("has-error");
          }
        }
        noticeAlert(data.message || "That did not work. Please try again.", "error");
        return;
      }

      applyIdentity(data);
      RENDER.notices(data);
      resetNoticeForm();
      noticeAlert(data.message || "Saved.", "ok");
    } catch (err) {
      noticeAlert("We could not reach the server. Please try again.", "error");
    } finally {
      button.setAttribute("aria-busy", "false");
    }
  }

  function initNoticeForm() {
    var form = noticeForm();
    if (!form) { return; }

    form.elements.body.addEventListener("input", countNoticeBody);
    document.querySelector("[data-cancel]").addEventListener("click", resetNoticeForm);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (DEMO) {
        noticeAlert("This is a preview, so nothing is written. Sign in as an administrator to post.", "error");
        return;
      }
      var id = form.elements.id.value;
      var payload = {
        title: form.elements.title.value,
        body: form.elements.body.value,
        audience: form.elements.audience.value,
        publishedOn: form.elements.publishedOn.value,
      };
      if (id) { payload.id = Number(id); }
      sendNotice(id ? "PATCH" : "POST", "/api/portal/announcements", payload);
    });
  }

  function setKpi(key, value) {
    setAll('[data-kpi="' + key + '"]', value);
  }

  function renderFacts(host, rows) {
    clear(host);
    rows.forEach(function (row) {
      var li = el("li");
      li.appendChild(el("span", null, row[0]));
      li.appendChild(el("b", null, row[1]));
      host.appendChild(li);
    });
  }

  function setDonut(name, percent) {
    var donut = document.querySelector('[data-donut="' + name + '"]');
    if (!donut) { return; }
    var ring = donut.querySelector(".donut__value");
    var circumference = 2 * Math.PI * 50;
    var value = Math.max(0, Math.min(100, percent || 0));
    requestAnimationFrame(function () {
      ring.style.strokeDashoffset = String(circumference * (1 - value / 100));
    });
  }

  function renderNotes(host, list) {
    clear(host);
    if (!list.length) { host.appendChild(el("p", "empty-line", "No announcements.")); return; }
    list.forEach(function (row) {
      var note = el("div", "note");
      var when = new Date(row.published_on);
      var date = el("span", "note__date");
      date.appendChild(el("span", "note__mon", isNaN(when) ? "" : MONTHS[when.getMonth()]));
      date.appendChild(el("span", "note__day", isNaN(when) ? "" : when.getDate()));
      note.appendChild(date);
      var what = el("span", "note__what");
      what.appendChild(el("strong", null, row.title));
      what.appendChild(el("p", null, row.body));
      note.appendChild(what);
      host.appendChild(note);
    });
  }

  function attendanceBlock(summary) {
    setAll("[data-attendance-pct]", summary.percent === null || summary.percent === undefined ? "-" : summary.percent + "%");
    setAll("[data-attendance-pct-2]", summary.percent === null || summary.percent === undefined ? "-" : summary.percent + "%");
    setDonut("attendance", summary.percent || 0);
    setAll("[data-present]", plural(summary.present || 0, "day"));
    setAll("[data-absent]", plural(summary.absent || 0, "day"));
    setAll("[data-late]", plural(summary.late || 0, "day"));
    setAll("[data-att-total]", summary.total || 0);
    setAll("[data-attendance-note]",
      !summary.total ? "No attendance recorded yet."
        : summary.percent >= 90 ? "Keep up the good attendance!"
        : "Try not to miss any more days.");
  }

  /* --- per-page renderers ----------------------------------------------- */
  var RENDER = {

    dashboard: function (d) {
      renderLessons(document.querySelector("[data-lessons]"), d.today || []);
      renderTasks(document.querySelector("[data-tasks]"), d.assignments || []);
      renderBars(document.querySelector("[data-bars]"), d.results || []);
      renderNotes(document.querySelector("[data-notes]"), d.announcements || []);
      setAll("[data-average]", d.average === null ? "-" : d.average + "%");
      setDonut("average", d.average || 0);
      attendanceBlock(d.attendance || {});
      document.title = (d.student.firstName || "Student") + "'s Dashboard | Bright Future Secondary School";
    },

    classes: function (d) {
      var tabs = document.querySelector("[data-day-tabs]");
      var host = document.querySelector("[data-lessons]");
      clear(tabs);

      function show(index) {
        var day = d.week[index];
        Array.prototype.forEach.call(tabs.children, function (b, i) {
          b.classList.toggle("is-on", i === index);
          b.setAttribute("aria-selected", String(i === index));
        });
        setAll("[data-day-name]", day.name);
        setAll("[data-day-count]", day.lessons.length ? plural(day.lessons.length, "lesson") : "No lessons");
        renderLessons(host, day.lessons);
      }

      d.week.forEach(function (day, i) {
        var b = el("button", "chip", day.name);
        b.type = "button";
        b.setAttribute("role", "tab");
        b.addEventListener("click", function () { show(i); });
        tabs.appendChild(b);
      });
      var start = d.week.findIndex(function (x) { return x.weekday === d.today; });
      show(start < 0 ? 0 : start);
    },

    assignments: function (d) {
      var host = document.querySelector("[data-tasks]");
      var all = d.assignments || [];
      var counts = {
        all: all.length,
        pending: all.filter(function (a) { return !a.submitted; }).length,
        submitted: all.filter(function (a) { return a.submitted; }).length,
      };
      setAll("[data-count-all]", counts.all);
      setAll("[data-count-pending]", counts.pending);
      setAll("[data-count-submitted]", counts.submitted);

      function apply(which) {
        renderTasks(host, which === "all" ? all
          : all.filter(function (a) { return which === "submitted" ? a.submitted : !a.submitted; }));
      }
      Array.prototype.forEach.call(document.querySelectorAll("[data-filter]"), function (chip) {
        chip.addEventListener("click", function () {
          Array.prototype.forEach.call(document.querySelectorAll("[data-filter]"), function (c) {
            c.classList.toggle("is-on", c === chip);
          });
          apply(chip.getAttribute("data-filter"));
        });
      });
      apply("all");
    },

    results: function (d) {
      var results = d.results || [];
      renderBars(document.querySelector("[data-bars]"), results);
      setAll("[data-average]", d.average === null ? "-" : d.average + "%");
      setAll("[data-average-2]", d.average === null ? "-" : d.average + "%");
      setDonut("average", d.average || 0);
      setAll("[data-best]", d.best || "-");
      setAll("[data-subject-count]", results.length);
      setAll("[data-results-note]", d.average === null ? "No results published yet."
        : d.average >= 70 ? "A strong set of results. Keep it going."
        : d.average >= 50 ? "A solid pass. Pick one subject to push next term."
        : "Speak to your teachers about extra help.");

      var body = document.querySelector("[data-results-table]");
      clear(body);
      if (!results.length) {
        var tr = el("tr");
        var td = el("td", null, "No results published yet.");
        td.colSpan = 4;
        tr.appendChild(td); body.appendChild(tr);
        return;
      }
      results.forEach(function (row) {
        var g = grade(row.score);
        var tr = el("tr");
        tr.appendChild(el("td", null, row.subject));
        tr.appendChild(el("td", null, Math.round(row.score)));
        var gcell = el("td");
        gcell.appendChild(el("span", "status status--" + g.tone, g.code));
        tr.appendChild(gcell);
        tr.appendChild(el("td", null, g.remark));
        body.appendChild(tr);
      });
    },

    attendance: function (d) {
      attendanceBlock(d.summary || {});
      var host = document.querySelector("[data-records]");
      clear(host);
      var records = d.records || [];
      if (!records.length) { host.appendChild(el("p", "empty-line", "No attendance recorded yet.")); return; }
      records.forEach(function (row) {
        var item = el("div", "record");
        item.appendChild(el("span", "dot dot--" + row.state));
        item.appendChild(el("span", "record__date", longDate(row.on_date)));
        item.appendChild(el("span", "status status--" +
          (row.state === "present" ? "done" : row.state === "late" ? "todo" : "late"),
          row.state.charAt(0).toUpperCase() + row.state.slice(1)));
        host.appendChild(item);
      });
    },

    messages: function (d) {
      var host = document.querySelector("[data-messages]");
      clear(host);
      var list = d.messages || [];
      setAll("[data-unread-count]", d.unread || 0);
      if (!list.length) { host.appendChild(el("p", "empty-line", "No messages.")); return; }

      list.forEach(function (row) {
        var item = el("article", "message" + (row.read ? "" : " is-unread"));

        var head = el("button", "message__head");
        head.type = "button";
        head.setAttribute("aria-expanded", "false");
        var who = el("span", "message__who");
        who.appendChild(el("strong", null, row.sender));
        who.appendChild(el("span", "message__subject", row.subject));
        head.appendChild(who);
        head.appendChild(el("span", "message__when", whenSent(row.sent_at)));
        if (!row.read) { head.appendChild(el("span", "message__dot")); }

        var body = el("div", "message__body");
        body.hidden = true;
        body.appendChild(el("p", null, row.body || "No further detail."));

        head.addEventListener("click", async function () {
          var open = body.hidden;
          body.hidden = !open;
          head.setAttribute("aria-expanded", String(open));
          if (open && !row.read && !DEMO) {
            row.read = true;
            item.classList.remove("is-unread");
            var dot = head.querySelector(".message__dot");
            if (dot) { dot.remove(); }
            try {
              var res = await fetch("/api/portal/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ id: row.id }),
              });
              var out = await res.json();
              if (typeof out.unread === "number") {
                setAll("[data-unread-count]", out.unread);
                Array.prototype.forEach.call(document.querySelectorAll("[data-unread]"), function (b) {
                  b.textContent = out.unread; b.hidden = !out.unread;
                });
              }
            } catch (err) { /* reading it locally is enough */ }
          }
        });

        item.appendChild(head);
        item.appendChild(body);
        host.appendChild(item);
      });
    },

    profile: function (d) {
      var s = d.student || {};
      setAll("[data-surname]", s.surname || "-");
      setAll("[data-othernames]", s.otherNames || "-");
      setAll("[data-email]", s.email || "-");
      setAll("[data-phone]", s.phone || "Not on file");
      setAll("[data-guardian-email]", s.guardianEmail || "Not on file");
      setAll("[data-guardian-phone]", s.guardianPhone || "Not on file");
      setAll("[data-last-login]", s.lastLogin ? whenSent(s.lastLogin) : "This is your first visit");
      setAll("[data-joined]", s.joinedOn ? shortDate(s.joinedOn) : "-");

      var host = document.querySelector("[data-subjects]");
      clear(host);
      var subjects = d.subjects || [];
      if (!subjects.length) { host.appendChild(el("p", "empty-line", "No subjects on your timetable yet.")); return; }
      var wrap = el("div", "pill-row");
      subjects.forEach(function (name) { wrap.appendChild(el("span", "pill", name)); });
      host.appendChild(wrap);
    },

    calendar: function (d) {
      renderNotes(document.querySelector("[data-notes]"), d.announcements || []);
      setAll("[data-term-note]", d.term
        ? plural(d.term.daysLeft, "day") + " of " + d.term.label + " remaining."
        : "No term is running at the moment.");
    },

    resources: function () { /* static content; identity is filled in for us */ },

    settings: function (d) {
      setAll("[data-email]", (d.student && d.student.email) || "-");
    },

    /* --- parent: one child, seen from home ------------------------------ */
    parent: function (d) {
      var child = d.child || {};
      setAll("[data-child-name]", child.className ? child.fullName + " (" + child.className + ")" : (child.fullName || "-"));
      setAll("[data-child-name-full]", child.fullName || "-");
      setAll("[data-child-first]", child.firstName || "Your child");
      setAll("[data-lessons-title]", (child.firstName ? child.firstName + "\u2019s" : "Today\u2019s") + " Lessons");
      setAll("[data-child-class]", child.className || "-");
      setAll("[data-child-admission]", child.admissionNo || "-");
      setAll("[data-child-initials]", child.initials || "");

      renderLessons(document.querySelector("[data-lessons]"), d.today || []);
      renderTasks(document.querySelector("[data-tasks]"), d.assignments || []);
      renderBars(document.querySelector("[data-bars]"), d.results || []);
      renderNotes(document.querySelector("[data-notes]"), d.announcements || []);

      setAll("[data-average]", d.average === null || d.average === undefined ? "-" : d.average + "%");
      setDonut("average", d.average || 0);
      attendanceBlock(d.attendance || {});

      setKpi("average", d.average === null || d.average === undefined ? "-" : d.average + "%");
      setKpi("attendance", d.attendance && d.attendance.percent !== null && d.attendance.percent !== undefined
        ? d.attendance.percent + "%" : "-");
      setKpi("outstanding", d.outstanding || 0);
      setKpi("subjects", (d.results || []).length);

      document.title = (child.firstName || "My child") + "'s Progress | Bright Future Secondary School";
    },

    /* --- teacher: today, and the classes behind it ---------------------- */
    teacher: function (d) {
      var totals = d.totals || {};
      setKpi("lessons", totals.lessonsPerWeek || 0);
      setKpi("classes", totals.classes || 0);
      setKpi("pupils", totals.pupils || 0);
      setKpi("subjects", totals.subjects || 0);

      renderLessons(document.querySelector("[data-lessons]"), d.today || [], true);
      renderNotes(document.querySelector("[data-notes]"), d.announcements || []);

      var host = document.querySelector("[data-classes]");
      var classes = d.classes || [];
      clear(host);
      if (!classes.length) {
        host.appendChild(el("p", "empty-line", "No classes are on your timetable yet."));
      } else {
        classes.forEach(function (row) {
          var line = el("div", "class-row");
          line.appendChild(el("span", "class-row__name", row.class_name));
          var what = el("span", "class-row__what");
          what.appendChild(el("strong", null, row.subjects || "No subject recorded"));
          what.appendChild(el("span", null, className(row.class_level, row.class_arm)));
          line.appendChild(what);
          line.appendChild(el("span", "class-row__count", plural(row.pupils || 0, "pupil")));
          host.appendChild(line);
        });
      }

      renderCountBars(document.querySelector("[data-bars]"),
        classes.map(function (c) { return { label: c.class_name, value: c.pupils || 0 }; }),
        "Nothing to chart yet.");

      document.title = "Teacher Dashboard | Bright Future Secondary School";
    },

    /* --- the roll ------------------------------------------------------- */
    pupils: function (d) {
      if (d.pupil) {                                   // one pupil's record
        showView("one");
        var p = d.pupil;
        setAll("[data-one-name]", p.fullName);
        setAll("[data-one-initials]", p.initials);
        setAll("[data-one-class]", p.className);
        setAll("[data-one-admission]", p.admissionNo);
        var state = document.querySelector("[data-one-state]");
        clear(state); state.appendChild(statePill(p.status));

        renderBars(document.querySelector("[data-one-results]"), d.results || []);
        renderTasks(document.querySelector("[data-one-tasks]"), d.assignments || []);
        renderAccounts(document.querySelector("[data-one-accounts]"), d.accounts || []);

        var a = d.attendance || {};
        renderFacts(document.querySelector("[data-one-facts]"), [
          ["Admission number", p.admissionNo],
          ["Class", p.className],
          ["Average score", d.average === null || d.average === undefined ? "-" : d.average + "%"],
          ["Attendance", a.percent === null || a.percent === undefined ? "-" : a.percent + "%"],
          ["Present", plural(a.present || 0, "day")],
          ["Absent", plural(a.absent || 0, "day")],
          ["Late", plural(a.late || 0, "day")],
          ["Guardian email", p.guardianEmail || "Not on file"],
          ["Guardian phone", p.guardianPhone || "Not on file"],
          ["On the register since", p.joinedOn ? shortDate(p.joinedOn) : "-"],
          ["How they got here", p.source === "import" ? "Imported from the school register"
            : p.source === "signup" ? "Created when they signed up" : "Sample data"],
        ]);
        document.title = p.fullName + " | Bright Future Secondary School";
        return;
      }

      showView("list");                                // the roll
      var t = d.totals || {};
      setKpi("active", t.active || 0);
      setKpi("left", t.left_school || 0);
      setKpi("accounts", t.accounts || 0);
      setKpi("classes", (d.classes || []).length);

      renderPeople(document.querySelector("[data-people]"), d.pupils || [], {
        empty: d.filters.q || d.filters.class
          ? "Nobody on the register matches that."
          : "The register is empty. Import it, or load the sample data from the setup page.",
        subtitle: function (r) { return r.admissionNo; },
        tag: function (r) { return r.className; },
        meta: function (r) {
          return r.accounts ? plural(r.accounts, "account") : "No account";
        },
      });

      initList(d, {
        chips: function (data) {
          var out = [{ label: "All classes", on: !data.filters.class, params: { class: "", page: "" } }];
          (data.classes || []).forEach(function (c) {
            out.push({
              label: c.class_name, count: c.pupils,
              on: data.filters.class === c.class_name,
              params: { class: c.class_name, page: "" },
            });
          });
          return out;
        },
      });
      document.title = "Pupils | Bright Future Secondary School";
    },

    /* --- the staff register --------------------------------------------- */
    staff: function (d) {
      var one = d.staff && !Array.isArray(d.staff) ? d.staff : null;
      if (one) {                                       // one member of staff
        showView("one");
        setAll("[data-one-name]", one.fullName);
        setAll("[data-one-initials]", one.initials);
        setAll("[data-one-staffno]", one.staffNo);
        setAll("[data-one-email]", one.email || "No email on file");
        var state = document.querySelector("[data-one-state]");
        clear(state); state.appendChild(statePill(one.status));

        var host = document.querySelector("[data-one-classes]");
        var classes = d.classes || [];
        clear(host);
        if (!classes.length) {
          host.appendChild(el("p", "empty-line", "No periods are on the timetable against this name."));
        } else {
          classes.forEach(function (row) {
            var line = el("div", "class-row");
            line.appendChild(el("span", "class-row__name", row.class_name));
            var what = el("span", "class-row__what");
            what.appendChild(el("strong", null, row.subjects || "No subject recorded"));
            what.appendChild(el("span", null, plural(row.pupils || 0, "pupil") + " on the register"));
            line.appendChild(what);
            line.appendChild(el("span", "class-row__count", plural(row.pupils || 0, "pupil")));
            host.appendChild(line);
          });
        }

        renderAccounts(document.querySelector("[data-one-accounts]"), d.accounts || []);
        renderFacts(document.querySelector("[data-one-facts]"), [
          ["Staff number", one.staffNo],
          ["Email on file", one.email || "Not on file"],
          ["Subjects taught", one.subjects || "None on the timetable"],
          ["Periods a week", one.periods || 0],
          ["Classes", classes.length],
          ["On the register since", one.joinedOn ? shortDate(one.joinedOn) : "-"],
          ["How they got here", one.source === "import" ? "Imported from the staff register"
            : one.source === "signup" ? "Created when they signed up" : "Sample data"],
        ]);
        document.title = one.fullName + " | Bright Future Secondary School";
        return;
      }

      showView("list");                                // the staff list
      var t = d.totals || {};
      setKpi("active", t.active || 0);
      setKpi("left", t.left_school || 0);
      setKpi("accounts", t.accounts || 0);
      setKpi("admins", t.admins || 0);

      renderPeople(document.querySelector("[data-people]"), d.staff || [], {
        empty: d.filters.q
          ? "Nobody on the staff register matches that."
          : "The staff register is empty. Import it, or load the sample data from the setup page.",
        subtitle: function (r) { return r.staffNo + (r.email ? "  \u00b7  " + r.email : ""); },
        tag: function (r) { return r.subjects ? r.subjects.split(", ")[0] : "No subject"; },
        meta: function (r) {
          return r.periods ? plural(r.periods, "period") + " a week" : "No periods";
        },
      });

      initList(d, {
        chips: function (data) {
          return [
            { label: "On the register", on: data.filters.status === "active", params: { status: "", page: "" } },
            { label: "Have left", on: data.filters.status === "left", params: { status: "left", page: "" } },
            { label: "Everyone", on: data.filters.status === "all", params: { status: "all", page: "" } },
          ];
        },
      });
      document.title = "Staff | Bright Future Secondary School";
    },

    /* --- the notice board ------------------------------------------------ */
    notices: function (d) {
      var t = d.totals || {};
      setKpi("total", t.total || 0);
      setKpi("scheduled", t.scheduled || 0);
      setKpi("everyone", t.everyone || 0);
      setKpi("mine", (d.announcements || []).filter(function (a) {
        return a.author && a.author === (d.admin && d.admin.fullName);
      }).length);

      renderNoticeBoard(d);
      document.title = "Announcements | Bright Future Secondary School";
    },

    /* --- administrator: the school, by its numbers ---------------------- */
    admin: function (d) {
      var t = d.totals || {};
      setKpi("pupils", t.pupils || 0);
      setKpi("staff", t.staff || 0);
      setKpi("accounts", t.accounts || 0);
      setKpi("online", t.active_sessions || 0);

      renderCountBars(document.querySelector("[data-bars]"),
        (d.byClass || []).map(function (c) { return { label: c.class_name, value: c.pupils || 0 }; }),
        "No pupils are on the register yet.");

      renderFacts(document.querySelector("[data-facts]"), [
        ["Pupils on the register", t.pupils || 0],
        ["Pupils who have left", t.left_pupils || 0],
        ["Staff on the register", t.staff || 0],
        ["Pupil accounts", t.student_accounts || 0],
        ["Parent accounts", t.parent_accounts || 0],
        ["Teacher accounts", t.teacher_accounts || 0],
        ["Periods on the timetable", t.lessons || 0],
        ["Assignments set", t.assignments || 0],
        ["Announcements posted", t.announcements || 0],
      ]);

      var host = document.querySelector("[data-accounts]");
      var accounts = d.recentAccounts || [];
      clear(host);
      if (!accounts.length) {
        host.appendChild(el("p", "empty-line", "No one has created an account yet."));
      } else {
        accounts.forEach(function (row) {
          var line = el("div", "acct-row");
          var who = el("span", "acct-row__who");
          who.appendChild(el("strong", null, row.full_name));
          who.appendChild(el("span", null, row.email));
          line.appendChild(who);
          var role = row.is_admin ? "admin" : row.role;
          line.appendChild(el("span", "role-pill role-pill--" + role,
            role.charAt(0).toUpperCase() + role.slice(1)));
          line.appendChild(el("span", "acct-row__when", whenSent(row.created_at)));
          host.appendChild(line);
        });
      }

      var reg = d.register || {};
      var state = document.querySelector("[data-register-state]");
      clear(state);
      var line = el("div", "state-line " + (reg.openSignup ? "state-line--open" : "state-line--closed"));
      line.innerHTML = svg(reg.openSignup
        ? '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.4h.01"/>'
        : '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.2"/><path d="M8 10.5V7.6a4 4 0 018 0v2.9"/>');
      var text = el("span");
      var head = el("b", null, reg.openSignup ? "Sign-up is open. " : "Sign-up is closed to the register. ");
      text.appendChild(head);
      text.appendChild(document.createTextNode(reg.openSignup
        ? "Anyone can create an account, because no school register has been imported yet. Import one to close it."
        : "Only people already on the school register can create an account."));
      line.appendChild(text);
      state.appendChild(line);

      var bySource = {};
      (reg.sources || []).forEach(function (s) { bySource[s.source] = s.n; });
      renderFacts(document.querySelector("[data-register-facts]"), [
        ["Rows imported from the school register", bySource.import || 0],
        ["Rows created by someone signing up", bySource.signup || 0],
        ["Sample rows from the demo data", bySource.demo || 0],
        ["Signed in right now", t.active_sessions || 0],
        ["PORTAL_OPEN_SIGNUP override", reg.override || "not set"],
      ]);

      renderNotes(document.querySelector("[data-notes]"), d.announcements || []);
      document.title = "Admin Dashboard | Bright Future Secondary School";
    },
  };

  /* --- which endpoint feeds this page ----------------------------------- */
  var ENDPOINT = {
    dashboard: "dashboard", classes: "classes", assignments: "assignments",
    results: "results", attendance: "attendance", messages: "messages",
    profile: "profile", calendar: "dashboard", resources: "profile", settings: "profile",
    parent: "parent", teacher: "teacher", admin: "admin",
    pupils: "pupils", staff: "staff", notices: "announcements",
  };

  // Search, class, status and page live in the page's own address, so a result
  // can be linked to and the back button does what it looks like it does.
  var FORWARD = ["id", "q", "class", "status", "page"];

  function apiUrl(section) {
    if (DEMO) {
      return "/api/portal/demo?section=" + encodeURIComponent(section === "dashboard" ? "dashboard" : section);
    }
    var here = new URLSearchParams(window.location.search);
    var pass = new URLSearchParams();
    FORWARD.forEach(function (k) { if (here.has(k)) { pass.set(k, here.get(k)); } });
    var qs = pass.toString();
    return "/api/portal/" + section + (qs ? "?" + qs : "");
  }

  /* --- chrome ------------------------------------------------------------ */
  function initChrome() {
    var side = document.getElementById("portal-side");
    var scrim = document.querySelector("[data-side-scrim]");
    var toggle = document.querySelector("[data-side-toggle]");

    /* The same button does two jobs. Narrow: the sidebar slides in over the
       page and a scrim closes it. Wide: it is always there, and this hides it
       so the dashboard can have the full width. The choice is remembered, so
       someone who prefers the room keeps it. */
    var narrow = window.matchMedia("(max-width: 900px)");

    function setOpen(open) {                       // narrow screens
      side.classList.toggle("is-open", open);
      scrim.classList.toggle("is-open", open);
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      }
    }

    function setCollapsed(collapsed, remember) {   // wide screens
      document.body.classList.toggle("side-collapsed", collapsed);
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.setAttribute("aria-label", collapsed ? "Show menu" : "Hide menu");
      }
      if (remember === false) { return; }
      try { window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); }
      catch (err) { /* private browsing; the button still works for this visit */ }
    }

    function collapsedByChoice() {
      try { return window.localStorage.getItem(COLLAPSE_KEY) === "1"; }
      catch (err) { return false; }
    }

    function applyWidth() {
      if (narrow.matches) {
        document.body.classList.remove("side-collapsed");
        setOpen(false);
      } else {
        setOpen(false);                            // never leave the scrim up
        setCollapsed(collapsedByChoice(), false);
      }
    }
    applyWidth();
    if (narrow.addEventListener) { narrow.addEventListener("change", applyWidth); }

    if (toggle) {
      toggle.addEventListener("click", function () {
        if (narrow.matches) { setOpen(!side.classList.contains("is-open")); }
        else { setCollapsed(!document.body.classList.contains("side-collapsed")); }
      });
    }
    if (scrim) { scrim.addEventListener("click", function () { setOpen(false); }); }
    side.addEventListener("click", function (e) { if (e.target.closest("a")) { setOpen(false); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { setOpen(false); } });

    // Keep the preview flag on as you move around.
    if (DEMO) {
      var inPortal = 'a[href^="portal"], a[href^="parent.html"], a[href^="teacher.html"], a[href^="admin.html"]';
      Array.prototype.forEach.call(document.querySelectorAll(inPortal), function (a) {
        if (a.getAttribute("href").indexOf("demo=") === -1) {
          a.setAttribute("href", a.getAttribute("href") + "?demo=1");
        }
      });
      var banner = document.querySelector("[data-demo-banner]");
      if (banner) {
        banner.classList.remove("is-hidden");
        var mine = previewAccount();
        if (mine) {
          var text = banner.querySelector("span");
          if (text) {
            text.innerHTML =
              "<strong>Preview on this device.</strong> These are the details you typed, kept in this " +
              "browser only. No account exists at the school and nothing was sent to it. " +
              '<a href="setup.html">Attach a database</a> for real accounts, or ' +
              '<a href="#" data-clear-preview>clear this preview</a>.';
            var clear = text.querySelector("[data-clear-preview]");
            if (clear) {
              clear.addEventListener("click", function (e) {
                e.preventDefault();
                clearPreview();
                window.location.href = "signup.html";
              });
            }
          }
        }
      }
    }

    var search = document.querySelector("[data-portal-search]");
    if (search) {
      search.addEventListener("submit", function (e) {
        e.preventDefault();
        var status = document.querySelector("[data-error-text]");
        if (status) { /* nothing to search yet */ }
        window.alert("Portal search is not connected yet.");
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-logout]"), function (button) {
      button.addEventListener("click", async function () {
        button.disabled = true;
        try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); }
        catch (err) { /* sign out locally regardless */ }
        window.location.href = "login.html";
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-peek]"), function (button) {
      button.addEventListener("click", function () {
        var input = document.getElementById(button.getAttribute("data-peek"));
        if (!input) { return; }
        var reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
        input.focus({ preventScroll: true });
      });
    });
  }

  /* --- change password (settings) ---------------------------------------- */
  function initPasswordForm() {
    var form = document.querySelector("[data-password-form]");
    if (!form) { return; }

    var box = document.querySelector("[data-pw-alert]");
    function alertMsg(text, kind) {
      box.className = "auth-alert auth-alert--" + kind + " is-shown";
      box.querySelector("[data-pw-alert-text]").textContent = text;
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      Array.prototype.forEach.call(form.querySelectorAll("[data-error-for]"), function (s) { s.textContent = ""; });
      box.classList.remove("is-shown");

      if (DEMO) { alertMsg("Not available in the demo preview. Sign in to change your password.", "error"); return; }

      var payload = {
        currentPassword: form.elements.currentPassword.value,
        newPassword: form.elements.newPassword.value,
        confirmPassword: form.elements.confirmPassword.value,
      };
      if (payload.newPassword !== payload.confirmPassword) {
        form.querySelector('[data-error-for="confirmPassword"]').textContent = "The two passwords do not match.";
        return;
      }

      var button = form.querySelector("[data-submit]");
      button.setAttribute("aria-busy", "true");
      try {
        var res = await fetch("/api/portal/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });
        var out = await res.json().catch(function () { return {}; });
        if (res.ok) { alertMsg(out.message || "Your password has been changed.", "ok"); form.reset(); }
        else {
          if (out.field) {
            var slot = form.querySelector('[data-error-for="' + out.field + '"]');
            if (slot) { slot.textContent = out.message; }
          }
          alertMsg(out.message || "We could not change your password.", "error");
        }
      } catch (err) {
        alertMsg("We could not reach the server. Please try again.", "error");
      } finally {
        button.setAttribute("aria-busy", "false");
      }
    });
  }

  /* --- boot -------------------------------------------------------------- */
  function showError(message, offerSignIn, home) {
    document.querySelector("[data-loading]").classList.add("is-hidden");
    var box = document.querySelector("[data-error]");
    box.querySelector("[data-error-text]").textContent = message;
    var action = box.querySelector("[data-error-action]");
    if (action && home) {
      // Signed in, wrong dashboard: send them to the one that is theirs.
      action.textContent = "Go to your dashboard";
      action.href = home;
    } else if (action && !offerSignIn) {
      action.textContent = "Back to the website";
      action.href = "index.html";
    }
    box.classList.remove("is-hidden");
  }

  async function boot() {
    initChrome();
    initPasswordForm();
    initNoticeForm();

    try {
      var res = await fetch(apiUrl(ENDPOINT[PAGE] || "dashboard"), { credentials: "same-origin" });
      if (res.status === 401) {
        window.location.replace("login.html?next=/" + encodeURIComponent(
          window.location.pathname.replace(/^\//, "") || "portal.html"));
        return;
      }
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        showError(data.message || "We could not load this page.", res.status !== 403, data.home);
        return;
      }

      var render = RENDER[PAGE];
      if (render) { render(applyIdentity(data)); }
      else { applyIdentity(data); }

      document.querySelector("[data-loading]").classList.add("is-hidden");
      document.querySelector("[data-dash]").classList.remove("is-hidden");
    } catch (err) {
      showError("We could not reach the server. Please check your connection and try again.", false);
    }
  }

  if (document.readyState !== "loading") { boot(); }
  else { document.addEventListener("DOMContentLoaded", boot); }
})();
