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
  function applyIdentity(data) {
    var s = data.student || {};
    setAll("[data-name]", s.fullName || "");
    setAll("[data-initials]", s.initials || "");
    setAll("[data-class]", s.className || "-");
    setAll("[data-admission]", s.admissionNo || "-");
    setAll("[data-first-name]", s.firstName || "");
    if (data.greeting) { setAll("[data-greeting]", data.greeting); }

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
  }

  function lessonRow(row) {
    var item = el("div", "lesson");
    var icon = el("span", "tile-icon " + (ACCENTS[row.accent] || "bg-blue"));
    icon.innerHTML = svg(SUBJECT_ICON[row.icon] || SUBJECT_ICON.book);
    item.appendChild(icon);
    item.appendChild(el("span", "lesson__time", row.starts_at + " - " + row.ends_at));
    var what = el("span", "lesson__what");
    what.appendChild(el("strong", null, row.subject));
    what.appendChild(el("span", null, row.teacher));
    item.appendChild(what);
    if (row.room) {
      var room = el("span", "lesson__room");
      room.innerHTML = svg('<path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>');
      room.appendChild(el("span", null, row.room));
      item.appendChild(room);
    }
    return item;
  }

  function renderLessons(host, list) {
    clear(host);
    if (!list.length) { host.appendChild(el("p", "empty-line", "No lessons scheduled.")); return; }
    list.forEach(function (row) { host.appendChild(lessonRow(row)); });
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
      (summary.percent || 0) >= 90 ? "Keep up the good attendance!" : "Try not to miss any more days.");
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
  };

  /* --- which endpoint feeds this page ----------------------------------- */
  var ENDPOINT = {
    dashboard: "dashboard", classes: "classes", assignments: "assignments",
    results: "results", attendance: "attendance", messages: "messages",
    profile: "profile", calendar: "dashboard", resources: "profile", settings: "profile",
  };

  function apiUrl(section) {
    return DEMO ? "/api/portal/demo?section=" + encodeURIComponent(section === "dashboard" ? "dashboard" : section)
                : "/api/portal/" + section;
  }

  /* --- chrome ------------------------------------------------------------ */
  function initChrome() {
    var side = document.getElementById("portal-side");
    var scrim = document.querySelector("[data-side-scrim]");
    var toggle = document.querySelector("[data-side-toggle]");

    function setOpen(open) {
      side.classList.toggle("is-open", open);
      scrim.classList.toggle("is-open", open);
      if (toggle) { toggle.setAttribute("aria-expanded", String(open)); }
    }
    if (toggle) { toggle.addEventListener("click", function () { setOpen(!side.classList.contains("is-open")); }); }
    if (scrim) { scrim.addEventListener("click", function () { setOpen(false); }); }
    side.addEventListener("click", function (e) { if (e.target.closest("a")) { setOpen(false); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { setOpen(false); } });

    // Keep the preview flag on as you move around.
    if (DEMO) {
      Array.prototype.forEach.call(document.querySelectorAll('a[href^="portal"]'), function (a) {
        if (a.getAttribute("href").indexOf("demo=") === -1) {
          a.setAttribute("href", a.getAttribute("href") + "?demo=1");
        }
      });
      var banner = document.querySelector("[data-demo-banner]");
      if (banner) { banner.classList.remove("is-hidden"); }
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
  function showError(message, offerSignIn) {
    document.querySelector("[data-loading]").classList.add("is-hidden");
    var box = document.querySelector("[data-error]");
    box.querySelector("[data-error-text]").textContent = message;
    var action = box.querySelector("[data-error-action]");
    if (action && !offerSignIn) { action.textContent = "Back to the website"; action.href = "index.html"; }
    box.classList.remove("is-hidden");
  }

  async function boot() {
    initChrome();
    initPasswordForm();

    try {
      var res = await fetch(apiUrl(ENDPOINT[PAGE] || "dashboard"), { credentials: "same-origin" });
      if (res.status === 401) {
        window.location.replace("login.html?next=/" + encodeURIComponent(
          window.location.pathname.replace(/^\//, "") || "portal.html"));
        return;
      }
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) { showError(data.message || "We could not load this page.", res.status !== 403); return; }

      applyIdentity(data);
      var render = RENDER[PAGE];
      if (render) { render(data); }

      document.querySelector("[data-loading]").classList.add("is-hidden");
      document.querySelector("[data-dash]").classList.remove("is-hidden");
    } catch (err) {
      showError("We could not reach the server. Please check your connection and try again.", false);
    }
  }

  if (document.readyState !== "loading") { boot(); }
  else { document.addEventListener("DOMContentLoaded", boot); }
})();
