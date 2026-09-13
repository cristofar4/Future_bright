/* Turns /api/auth/mode into a checklist with the next action spelled out.
   Nothing here is sensitive: it reports booleans, never a connection string. */
(function () {
  "use strict";

  var STEPS = [
    { key: "api",      label: "Site and API deployed",
      ok: "The serverless functions are live.",
      no: "The API did not respond. The deployment probably failed to build." },
    { key: "database", label: "Database connected",
      ok: "DATABASE_URL is set and the database answered.",
      no: "No database is attached yet, so accounts have nowhere to live." },
    { key: "schema",   label: "Tables created",
      ok: "The portal tables exist.",
      no: "The database is reachable but empty." },
  ];

  function icon(state) {
    var paths = {
      ok:   '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
      bad:  '<path d="M6 6l12 12M18 6L6 18"/>',
      wait: '<circle cx="12" cy="12" r="8"/>',
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[state] + "</svg>";
  }

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) { n.className = className; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }

  /** Run a one-off setup action, then re-read the status. */
  async function runStep(button, url, working) {
    var idle = button.textContent;
    button.disabled = true;
    button.textContent = working;
    var result = document.querySelector("[data-result]");
    result.textContent = "";
    result.className = "setup-result";
    try {
      var res = await fetch(url, { method: "POST", credentials: "same-origin" });
      var body = await res.json().catch(function () { return {}; });
      result.textContent = body.message || (res.ok ? "Done." : "That did not work.");
      result.className = "setup-result " + (res.ok ? "setup-result--ok" : "setup-result--bad");
    } catch (err) {
      result.textContent = "Could not reach the server. Try again.";
      result.className = "setup-result setup-result--bad";
    } finally {
      button.disabled = false;
      button.textContent = idle;
      await run();
    }
  }

  var ADVICE = {
    build: {
      title: "The deployment is not serving the API",
      body: "Open your project on vercel.com, click the most recent deployment and read the build log. " +
            "Copy the error and it can be dealt with directly.",
    },
    database: {
      title: "Attach a database",
      body: "In Vercel, open your project, go to Storage and create a Postgres database, then connect it " +
            "to this project: that sets the connection string for you. Or create one at neon.tech or " +
            "supabase.com and add it yourself under Settings, then Environment Variables, as DATABASE_URL " +
            "for all environments. Either way, redeploy afterwards.",
    },
    connection: {
      title: "The database refused the connection",
      body: "The connection string is set but the database did not answer. Check it was pasted whole, that " +
            "the password is right, and that it ends with ?sslmode=require for a hosted provider. " +
            "Redeploy after changing it.",
    },
    schema: {
      title: "Create the tables",
      body: "The database is connected but empty. Press the button below to create the tables. " +
            "It only adds tables that are missing and refuses once they exist, so it is safe to press.",
    },
    ready: {
      title: "Everything is ready",
      body: "You can create an account now.",
    },
  };

  async function run() {
    var list = document.querySelector("[data-steps]");
    var adviceBox = document.querySelector("[data-advice]");
    var actions = document.querySelector("[data-actions]");

    var state;
    try {
      var res = await fetch("/api/auth/mode", { credentials: "same-origin", cache: "no-store" });
      state = await res.json();
      if (!res.ok) { throw new Error("bad status"); }
    } catch (err) {
      // Could not even reach the endpoint: the build is the thing to look at.
      state = { api: false, database: false, schema: false, stage: "build" };
    }

    list.textContent = "";
    STEPS.forEach(function (step) {
      var good = Boolean(state[step.key]);
      var row = el("li", "check " + (good ? "check--ok" : "check--bad"));
      var mark = el("span", "check__mark");
      mark.innerHTML = icon(good ? "ok" : "bad");
      row.appendChild(mark);
      var text = el("span", "check__text");
      text.appendChild(el("strong", null, step.label));
      text.appendChild(el("span", null, good ? step.ok : step.no));
      row.appendChild(text);
      list.appendChild(row);
    });

    if (state.stage === "ready") {
      var row = el("li", "check check--ok");
      var mark = el("span", "check__mark");
      mark.innerHTML = icon("ok");
      row.appendChild(mark);
      var text = el("span", "check__text");
      text.appendChild(el("strong", null, "Sign-up"));
      text.appendChild(el("span", null, state.openSignup
        ? "Open. Any admission or staff number is accepted, and an entry is created for it."
        : "Closed, because a register has been imported. Details must match a row in it."));
      row.appendChild(text);
      list.appendChild(row);
    }

    var advice = ADVICE[state.stage] || ADVICE.build;
    adviceBox.textContent = "";
    adviceBox.className = "setup-advice " + (state.stage === "ready" ? "setup-advice--ok" : "setup-advice--todo");
    adviceBox.appendChild(el("h2", null, advice.title));
    adviceBox.appendChild(el("p", null, advice.body));

    // Confirm which variable is being read, so a connection string set under
    // one of Vercel's own names does not look like it was ignored.
    if (state.databaseUrlVar) {
      var note = el("p", "setup-note",
        "Reading the connection string from " + state.databaseUrlVar + ".");
      adviceBox.appendChild(note);
    }

    actions.textContent = "";

    // The one action that moves setup forward, if it can be done from here.
    if (state.stage === "schema") {
      var make = el("button", "btn", "Create the tables");
      make.type = "button";
      make.addEventListener("click", function () {
        runStep(make, "/api/auth/migrate", "Creating\u2026");
      });
      actions.appendChild(make);
    }

    if (state.stage === "ready") {
      var go = el("a", "btn", "Create an account");
      go.href = "signup.html";
      actions.appendChild(go);

      if (!state.registerImported && !state.hasSampleData) {
        var seed = el("button", "btn btn--outline", "Load sample data");
        seed.type = "button";
        seed.style.marginLeft = ".6rem";
        seed.addEventListener("click", function () {
          runStep(seed, "/api/auth/seed", "Loading\u2026");
        });
        actions.appendChild(seed);
      }
    }

    var demo = el("a", "btn btn--outline", "Open the demo preview");
    demo.href = "portal.html?demo=1";
    demo.style.marginLeft = actions.children.length ? ".6rem" : "0";
    actions.appendChild(demo);
  }

  if (document.readyState !== "loading") { run(); }
  else { document.addEventListener("DOMContentLoaded", run); }
})();
