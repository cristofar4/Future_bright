/* ==========================================================================
   Student dashboard. Fetches everything in one call and renders it.
   Anything not signed in goes back to the login page.
   ========================================================================== */
(function () {
  "use strict";

  var ACCENTS = {
    blue: "bg-blue", green: "bg-green", purple: "bg-purple",
    orange: "bg-orange", teal: "bg-teal", pink: "bg-pink", navy: "bg-navy",
  };

  var SUBJECT_ICON = {
    calc:   '<path d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/><rect x="4" y="2.5" width="16" height="19" rx="2.4"/>',
    book:   '<path d="M3 4.8h5.2A3.8 3.8 0 0112 8.6v11a3 3 0 00-3-3H3z"/><path d="M21 4.8h-5.2A3.8 3.8 0 0012 8.6v11a3 3 0 013-3h6z"/>',
    leaf:   '<path d="M20 4s-1.5 12-9 12a5 5 0 01-5-5c0-5 7-7 14-7z"/><path d="M4.5 20c2-5 5.5-8 10-10"/>',
    laptop: '<rect x="4" y="4.5" width="16" height="11" rx="2"/><path d="M2 19h20"/>',
    atom:   '<circle cx="12" cy="12" r="2.4"/><path d="M12 3c4.5 0 8 4 8 9s-3.5 9-8 9-8-4-8-9 3.5-9 8-9z"/><path d="M4.2 8.2c2.2-2.6 12.4-2.6 15.6 0M4.2 15.8c2.2 2.6 12.4 2.6 15.6 0"/>',
    flask:  '<path d="M10 2.8v6L4.7 18a2.4 2.4 0 002.1 3.5h10.4A2.4 2.4 0 0019.3 18L14 8.8v-6"/><path d="M8.6 2.8h6.8M7.4 14.5h9.2"/>',
  };

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function svg(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + "</svg>";
  }

  /** Everything from the API is rendered as text, never as markup. */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  function setAll(selector, value) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (node) {
      node.textContent = value;
    });
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  function shortDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : MONTHS[d.getMonth()] + " " + String(d.getDate()).padStart(2, "0") + ", " + d.getFullYear();
  }

  /* --- rendering -------------------------------------------------------- */
  function renderLessons(list) {
    var host = document.querySelector("[data-lessons]");
    host.textContent = "";
    if (!list.length) {
      host.appendChild(el("p", "empty-line", "No lessons scheduled."));
      return;
    }
    list.forEach(function (row) {
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
      host.appendChild(item);
    });
  }

  function renderTasks(list) {
    var host = document.querySelector("[data-tasks]");
    host.textContent = "";
    if (!list.length) {
      host.appendChild(el("p", "empty-line", "Nothing due right now."));
      return;
    }
    var today = new Date(); today.setHours(0, 0, 0, 0);

    list.forEach(function (row) {
      var item = el("div", "task");

      var icon = el("span", "tile-icon tile-icon--soft");
      icon.innerHTML = svg('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>');
      item.appendChild(icon);

      var what = el("span", "task__what");
      what.appendChild(el("strong", null, row.title));
      if (row.brief) { what.appendChild(el("p", null, row.brief)); }
      what.appendChild(el("span", "task__due", "Due: " + shortDate(row.due_on)));
      item.appendChild(what);

      var overdue = !row.submitted && new Date(row.due_on) < today;
      var status = el("span",
        "status " + (row.submitted ? "status--done" : overdue ? "status--late" : "status--todo"),
        row.submitted ? "Submitted" : overdue ? "Overdue" : "Pending");
      item.appendChild(status);

      host.appendChild(item);
    });
  }

  function renderBars(results) {
    var host = document.querySelector("[data-bars]");
    host.textContent = "";
    if (!results.length) {
      host.appendChild(el("p", "empty-line", "No results published yet."));
      return;
    }
    results.forEach(function (row) {
      var line = el("div", "bar-row");
      line.appendChild(el("span", "bar-row__name", row.subject));

      var track = el("span", "bar-row__track");
      var fill = el("span", "bar-row__fill");
      track.appendChild(fill);
      line.appendChild(track);

      line.appendChild(el("span", "bar-row__pct", Math.round(row.score) + "%"));
      host.appendChild(line);

      // Next frame, so the width transition actually runs.
      requestAnimationFrame(function () { fill.style.width = Math.max(0, Math.min(100, row.score)) + "%"; });
    });
  }

  function setDonut(name, percent) {
    var donut = document.querySelector('[data-donut="' + name + '"]');
    if (!donut) { return; }
    var ring = donut.querySelector(".donut__value");
    var circumference = 2 * Math.PI * 50;         // r=50 in the SVG
    var value = Math.max(0, Math.min(100, percent || 0));
    requestAnimationFrame(function () {
      ring.style.strokeDashoffset = String(circumference * (1 - value / 100));
    });
  }

  function renderNotes(list) {
    var host = document.querySelector("[data-notes]");
    host.textContent = "";
    if (!list.length) {
      host.appendChild(el("p", "empty-line", "No announcements."));
      return;
    }
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

  function render(data) {
    var student = data.student;

    setAll("[data-name]", student.fullName);
    setAll("[data-initials]", student.initials);
    setAll("[data-class]", student.className);
    setAll("[data-admission]", student.admissionNo);
    setAll("[data-first-name]", student.firstName);
    setAll("[data-greeting]", data.greeting);
    document.title = student.firstName + "'s Dashboard | Bright Future Secondary School";

    if (data.term) {
      setAll("[data-session]", data.term.session);
      setAll("[data-term]", data.term.label);
      setAll("[data-days]", data.term.daysLeft);
    } else {
      setAll("[data-session]", "-");
      setAll("[data-term]", "Between terms");
      setAll("[data-days]", "-");
    }

    renderLessons(data.today || []);
    renderTasks(data.assignments || []);
    renderBars(data.results || []);
    renderNotes(data.announcements || []);

    setAll("[data-average]", data.average === null ? "-" : data.average + "%");
    setDonut("average", data.average || 0);

    var att = data.attendance || {};
    setAll("[data-attendance-pct]", att.percent === null ? "-" : att.percent + "%");
    setDonut("attendance", att.percent || 0);
    setAll("[data-present]", plural(att.present || 0, "day"));
    setAll("[data-absent]", plural(att.absent || 0, "day"));
    setAll("[data-late]", plural(att.late || 0, "day"));
    setAll("[data-attendance-note]",
      (att.percent || 0) >= 90 ? "Keep up the good attendance!" : "Try not to miss any more days.");

    Array.prototype.forEach.call(document.querySelectorAll("[data-unread]"), function (badge) {
      badge.textContent = data.unreadMessages;
      badge.hidden = !data.unreadMessages;
    });

    document.querySelector("[data-loading]").classList.add("is-hidden");
    document.querySelector("[data-dash]").classList.remove("is-hidden");
  }

  function showError(message, signedOut) {
    document.querySelector("[data-loading]").classList.add("is-hidden");
    var box = document.querySelector("[data-error]");
    box.querySelector("[data-error-text]").textContent = message;
    if (!signedOut) { box.querySelector(".btn").textContent = "Back to the website"; box.querySelector(".btn").href = "index.html"; }
    box.classList.remove("is-hidden");
  }

  /* --- chrome ------------------------------------------------------------ */
  function initChrome() {
    var side = document.getElementById("portal-side");
    var scrim = document.querySelector("[data-side-scrim]");
    var toggle = document.querySelector("[data-side-toggle]");

    function setOpen(open) {
      side.classList.toggle("is-open", open);
      scrim.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    }
    if (toggle) { toggle.addEventListener("click", function () { setOpen(!side.classList.contains("is-open")); }); }
    if (scrim) { scrim.addEventListener("click", function () { setOpen(false); }); }
    side.addEventListener("click", function (e) { if (e.target.closest("a")) { setOpen(false); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { setOpen(false); } });

    var search = document.querySelector("[data-portal-search]");
    if (search) {
      search.addEventListener("submit", function (e) {
        e.preventDefault();
        window.alert("Portal search is not connected yet.");
      });
    }

    var logout = document.querySelector("[data-logout]");
    if (logout) {
      logout.addEventListener("click", async function () {
        logout.disabled = true;
        try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); }
        catch (err) { /* sign out locally regardless */ }
        window.location.href = "login.html";
      });
    }
  }

  /* --- boot -------------------------------------------------------------- */
  async function boot() {
    initChrome();
    try {
      var response = await fetch("/api/portal/dashboard", { credentials: "same-origin" });
      if (response.status === 401) {
        window.location.replace("login.html?next=/portal.html");
        return;
      }
      var body = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        showError(body.message || "We could not load your dashboard.", response.status === 403);
        return;
      }
      render(body);
    } catch (err) {
      showError("We could not reach the server. Please check your connection and try again.");
    }
  }

  if (document.readyState !== "loading") { boot(); }
  else { document.addEventListener("DOMContentLoaded", boot); }
})();
