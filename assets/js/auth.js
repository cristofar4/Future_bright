/* ==========================================================================
   Sign-in and sign-up behaviour.
   The server is the authority: everything here is convenience only, and every
   rule enforced below is enforced again in api/auth/*.
   ========================================================================== */
(function () {
  "use strict";

  var MIN_PASSWORD = 10;

  // Each role asks for a different reference, and teachers have no class.
  var ROLE_FIELDS = {
    student: {
      refLabel: "Student ID / Admission Number",
      refPlaceholder: "e.g. BFS/2025/0142",
      classLabel: "Class / Grade",
      showClass: true,
    },
    parent: {
      refLabel: "Child's Admission Number",
      refPlaceholder: "e.g. BFS/2025/0142",
      classLabel: "Child's Class",
      showClass: true,
    },
    teacher: {
      refLabel: "Staff Number",
      refPlaceholder: "e.g. BFS/STF/014",
      classLabel: "Class / Grade",
      showClass: false,
    },
  };

  function ready(fn) {
    if (document.readyState !== "loading") { fn(); }
    else { document.addEventListener("DOMContentLoaded", fn); }
  }

  /* --- messages --------------------------------------------------------- */
  function showAlert(form, message, kind) {
    var box = document.querySelector("[data-alert]");
    if (!box) { return; }
    box.className = "auth-alert auth-alert--" + (kind || "error") + " is-shown";
    var text = box.querySelector("[data-alert-text]");
    if (text) { text.textContent = message; }
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function clearAlert() {
    var box = document.querySelector("[data-alert]");
    if (box) { box.classList.remove("is-shown"); }
  }

  function setFieldError(form, name, message) {
    var slot = form.querySelector('[data-error-for="' + name + '"]');
    if (slot) { slot.textContent = message || ""; }
    var input = form.elements[name];
    if (input && input.closest) {
      var field = input.closest(".field");
      if (field) { field.classList.toggle("has-error", Boolean(message)); }
    }
  }

  function clearErrors(form) {
    Array.prototype.forEach.call(form.querySelectorAll("[data-error-for]"), function (s) {
      s.textContent = "";
    });
    Array.prototype.forEach.call(form.querySelectorAll(".field.has-error"), function (f) {
      f.classList.remove("has-error");
    });
    clearAlert();
  }

  function setBusy(form, busy, busyText) {
    var button = form.querySelector("[data-submit]");
    if (!button) { return; }
    button.setAttribute("aria-busy", busy ? "true" : "false");
    var label = button.querySelector("[data-submit-text]");
    if (!label) { return; }
    if (busy) {
      label.dataset.idle = label.textContent;
      label.textContent = busyText;
    } else if (label.dataset.idle) {
      label.textContent = label.dataset.idle;
    }
  }

  /* --- password visibility ---------------------------------------------- */
  function initPeek() {
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

  /* --- role tabs --------------------------------------------------------- */
  function initRoleTabs(form) {
    var tabs = form.querySelector("[data-role-tabs]");
    if (!tabs) { return; }

    var refLabel = form.querySelector("[data-ref-label]");
    var refInput = form.elements.reference;
    var classLabel = form.querySelector("[data-class-label]");
    var classField = form.querySelector("[data-class-field]");
    var classInput = form.elements.classLevel;

    function apply() {
      var checked = tabs.querySelector("input:checked");
      var config = ROLE_FIELDS[checked ? checked.value : "student"] || ROLE_FIELDS.student;

      if (refLabel) { refLabel.textContent = config.refLabel; }
      if (refInput) { refInput.placeholder = config.refPlaceholder; }
      if (classLabel) { classLabel.textContent = config.classLabel; }

      if (classField) { classField.hidden = !config.showClass; }
      if (classInput) {
        // A hidden control must not be required, or the browser blocks submit
        // on a field nobody can see.
        classInput.required = config.showClass;
        classInput.disabled = !config.showClass;
        if (!config.showClass) { classInput.value = ""; }
      }
      clearErrors(form);
    }

    tabs.addEventListener("change", apply);
    apply();
  }

  /* --- client-side checks ------------------------------------------------ */
  function validateSignup(form, data) {
    var problems = {};

    if (!data.fullName || data.fullName.split(/\s+/).filter(Boolean).length < 2) {
      problems.fullName = "Please enter your first name and surname.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
      problems.email = "Please enter a valid email address.";
    }
    if (!data.reference) {
      problems.reference = data.role === "teacher"
        ? "Please enter your staff number."
        : "Please enter the admission number.";
    }
    if (data.role !== "teacher" && !data.classLevel) {
      problems.classLevel = "Please select a class.";
    }
    if (!data.password || data.password.length < MIN_PASSWORD) {
      problems.password = "Password must be at least " + MIN_PASSWORD + " characters.";
    }
    if (data.password !== data.confirmPassword) {
      problems.confirmPassword = "The two passwords do not match.";
    }
    return problems;
  }

  /* --- submitting -------------------------------------------------------- */
  async function send(url, payload) {
    var response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });

    var body = null;
    try { body = await response.json(); } catch (err) { /* non-JSON error page */ }
    return { status: response.status, body: body || {} };
  }

  function afterAuth(form, user, verb) {
    showAlert(form, verb + ", " + (user.fullName || "") + ". Taking you to the portal…", "ok");
    // Only same-site paths are followed, so ?next= cannot bounce anyone off-site.
    var next = new URLSearchParams(location.search).get("next");
    var safe = next && /^\/[^/\\]/.test(next) ? next : null;
    // The dashboard is the student view; everyone else lands on the site for now.
    var fallback = user.role === "student" ? "portal.html" : "index.html";
    window.setTimeout(function () {
      window.location.href = safe || fallback;
    }, 1200);
  }

  /**
   * Say plainly what sign-up will do right now: whether a database is attached,
   * and whether details have to match the school register. Without this the
   * only feedback is a refusal after filling the whole form in.
   */
  async function showMode() {
    var note = document.querySelector("[data-mode-note]");
    var registerNote = document.querySelector("[data-register-note]");
    if (!note) { return; }

    var mode;
    try {
      var res = await fetch("/api/auth/mode", { credentials: "same-origin" });
      mode = await res.json();
    } catch (err) {
      return;                                   // leave the default wording
    }

    if (!mode.configured) {
      note.innerHTML = "<strong>The portal is not connected to a database yet.</strong> " +
        "Sign-up will not work until one is attached. " +
        '<a href="portal.html?demo=1">Open the demo preview</a> to see the portal in the meantime.';
      note.hidden = false;
      if (registerNote) { registerNote.hidden = true; }
      return;
    }

    if (mode.openSignup) {
      note.innerHTML = "<strong>Open sign-up is on.</strong> " +
        "There is no register loaded yet, so any admission or staff number you enter is " +
        "accepted and an entry is created for it. Once the school register is imported, " +
        "sign-up closes automatically and details must match it.";
      note.hidden = false;
      if (registerNote) { registerNote.hidden = true; }
    }
  }

  function initSignup() {
    var form = document.querySelector("[data-signup-form]");
    if (!form) { return; }
    initRoleTabs(form);
    showMode();

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      clearErrors(form);

      var checked = form.querySelector('[data-role-tabs] input:checked');
      var data = {
        role: checked ? checked.value : "student",
        fullName: (form.elements.fullName.value || "").trim(),
        email: (form.elements.email.value || "").trim(),
        phone: (form.elements.phone.value || "").trim(),
        reference: (form.elements.reference.value || "").trim(),
        classLevel: form.elements.classLevel ? form.elements.classLevel.value : "",
        password: form.elements.password.value,
        confirmPassword: form.elements.confirmPassword.value,
      };

      var problems = validateSignup(form, data);
      var names = Object.keys(problems);
      if (names.length) {
        names.forEach(function (n) { setFieldError(form, n, problems[n]); });
        var first = form.elements[names[0]];
        if (first && first.focus) { first.focus(); }
        return;
      }

      setBusy(form, true, "Creating your account…");
      try {
        var result = await send("/api/auth/signup", data);
        if (result.status === 201 && result.body.user) {
          afterAuth(form, result.body.user, "Welcome");
          return;
        }
        if (result.body.field) { setFieldError(form, result.body.field, result.body.message); }
        showAlert(form, result.body.message || "We could not create your account. Please try again.");
      } catch (err) {
        showAlert(form, "We could not reach the server. Please check your connection and try again.");
      } finally {
        setBusy(form, false);
      }
    });
  }

  function initLogin() {
    var form = document.querySelector("[data-login-form]");
    if (!form) { return; }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      clearErrors(form);

      var email = (form.elements.email.value || "").trim();
      var password = form.elements.password.value;

      if (!email || !password) {
        if (!email) { setFieldError(form, "email", "Please enter your email address."); }
        if (!password) { setFieldError(form, "password", "Please enter your password."); }
        return;
      }

      setBusy(form, true, "Signing you in…");
      try {
        var result = await send("/api/auth/login", { email: email, password: password });
        if (result.status === 200 && result.body.user) {
          afterAuth(form, result.body.user, "Welcome back");
          return;
        }
        showAlert(form, result.body.message || "Email or password is incorrect.");
        form.elements.password.value = "";
        form.elements.password.focus();
      } catch (err) {
        showAlert(form, "We could not reach the server. Please check your connection and try again.");
      } finally {
        setBusy(form, false);
      }
    });
  }

  ready(function () {
    initPeek();
    initSignup();
    initLogin();
  });
})();
