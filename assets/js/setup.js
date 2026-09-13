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

  var ADVICE = {
    build: {
      title: "The deployment is not serving the API",
      body: "Open your project on vercel.com, click the most recent deployment and read the build log. " +
            "Copy the error and it can be dealt with directly.",
    },
    database: {
      title: "Attach a database",
      body: "Create a free Postgres at neon.tech, supabase.com, or under Storage in Vercel. Copy the " +
            "connection string. In Vercel go to Settings, then Environment Variables, add DATABASE_URL " +
            "with that value for all environments, and redeploy.",
    },
    connection: {
      title: "The database refused the connection",
      body: "DATABASE_URL is set but the database did not answer. Check the string was pasted whole, that " +
            "the password is right, and that it ends with ?sslmode=require for a hosted provider. " +
            "Redeploy after changing it.",
    },
    schema: {
      title: "Create the tables",
      body: "From a clone of the repository, with the same connection string exported as DATABASE_URL, " +
            "run: npm install, then npm run db:setup, then npm run db:demo for sample data.",
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

    actions.textContent = "";
    if (state.stage === "ready") {
      var go = el("a", "btn", "Create an account");
      go.href = "signup.html";
      actions.appendChild(go);
    }
    var demo = el("a", "btn btn--outline", "Open the demo preview");
    demo.href = "portal.html?demo=1";
    demo.style.marginLeft = state.stage === "ready" ? ".6rem" : "0";
    actions.appendChild(demo);
  }

  if (document.readyState !== "loading") { run(); }
  else { document.addEventListener("DOMContentLoaded", run); }
})();
