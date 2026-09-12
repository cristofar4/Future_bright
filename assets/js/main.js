/* ==========================================================================
   Bright Future Secondary School - site behaviour
   Vanilla JS, no dependencies. Every widget is optional per page.
   ========================================================================== */
(function () {
  "use strict";

  var onReady = function (fn) {
    if (document.readyState !== "loading") { fn(); }
    else { document.addEventListener("DOMContentLoaded", fn); }
  };

  /* --- Mobile navigation ------------------------------------------------ */
  function initNav() {
    var toggle = document.querySelector("[data-nav-toggle]");
    var nav = document.getElementById("main-nav");
    if (!toggle || !nav) { return; }

    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }

    toggle.addEventListener("click", function () {
      setOpen(!nav.classList.contains("is-open"));
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) { setOpen(false); }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { setOpen(false); }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1180) { setOpen(false); }
    });
  }

  /* --- Search panel ----------------------------------------------------- */
  function initSearch() {
    var toggle = document.querySelector("[data-search-toggle]");
    var panel = document.getElementById("search-panel");
    if (!toggle || !panel) { return; }

    toggle.addEventListener("click", function () {
      var open = !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      if (open) {
        var input = panel.querySelector("input");
        if (input) { input.focus(); }
      }
    });

    var form = panel.querySelector("form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = form.querySelector("input");
        var term = input ? input.value.trim() : "";
        var status = panel.querySelector("[data-search-status]");
        if (status) {
          status.textContent = term
            ? 'Site search is not connected yet. "' + term + '" could not be looked up.'
            : "Type a word or phrase to search the site.";
        }
      });
    }
  }

  /* --- Dropdowns (login menu) ------------------------------------------- */
  function initDropdowns() {
    var dropdowns = Array.prototype.slice.call(document.querySelectorAll("[data-dropdown]"));
    if (!dropdowns.length) { return; }

    function closeAll(except) {
      dropdowns.forEach(function (d) {
        if (d === except) { return; }
        d.classList.remove("is-open");
        var t = d.querySelector(".dropdown__toggle");
        if (t) { t.setAttribute("aria-expanded", "false"); }
      });
    }

    dropdowns.forEach(function (drop) {
      var toggle = drop.querySelector(".dropdown__toggle");
      if (!toggle) { return; }
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = !drop.classList.contains("is-open");
        closeAll(drop);
        drop.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
      });
    });

    document.addEventListener("click", function () { closeAll(null); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeAll(null); }
    });
  }

  /* --- Sticky header shadow --------------------------------------------- */
  function initStickyHeader() {
    var header = document.querySelector(".site-header");
    if (!header) { return; }
    var update = function () {
      header.classList.toggle("is-stuck", window.scrollY > 4);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  /* --- Hero slider ------------------------------------------------------ */
  function initHero() {
    var hero = document.querySelector("[data-hero]");
    if (!hero) { return; }

    var slides = Array.prototype.slice.call(hero.querySelectorAll(".hero__slide"));
    if (slides.length < 1) { return; }

    var counter = hero.querySelector("[data-hero-count]");
    var prev = hero.querySelector("[data-hero-prev]");
    var next = hero.querySelector("[data-hero-next]");
    var index = slides.findIndex(function (s) { return s.classList.contains("is-active"); });
    if (index < 0) { index = 0; }
    var timer = null;

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (slide, n) {
        slide.classList.toggle("is-active", n === index);
        slide.setAttribute("aria-hidden", String(n !== index));
      });
      if (counter) { counter.textContent = (index + 1) + " / " + slides.length; }
    }

    function start() {
      if (slides.length < 2) { return; }
      stop();
      timer = window.setInterval(function () { show(index + 1); }, 7000);
    }
    function stop() {
      if (timer) { window.clearInterval(timer); timer = null; }
    }

    if (prev) { prev.addEventListener("click", function () { show(index - 1); start(); }); }
    if (next) { next.addEventListener("click", function () { show(index + 1); start(); }); }

    hero.addEventListener("mouseenter", stop);
    hero.addEventListener("mouseleave", start);
    hero.addEventListener("focusin", stop);

    show(index);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) { start(); }
  }

  /* --- Horizontal rails (gallery) --------------------------------------- */
  function initRails() {
    var rails = Array.prototype.slice.call(document.querySelectorAll("[data-rail]"));
    rails.forEach(function (rail) {
      var track = rail.querySelector("[data-rail-track]");
      var prev = rail.querySelector("[data-rail-prev]");
      var next = rail.querySelector("[data-rail-next]");
      if (!track) { return; }

      function step() {
        var first = track.firstElementChild;
        return first ? first.getBoundingClientRect().width + 14 : track.clientWidth * 0.8;
      }
      function sync() {
        var max = track.scrollWidth - track.clientWidth - 2;
        if (prev) { prev.disabled = track.scrollLeft <= 2; }
        if (next) { next.disabled = track.scrollLeft >= max; }
        [prev, next].forEach(function (b) {
          if (b) { b.style.opacity = b.disabled ? ".45" : "1"; }
        });
      }

      if (prev) { prev.addEventListener("click", function () { track.scrollLeft -= step(); }); }
      if (next) { next.addEventListener("click", function () { track.scrollLeft += step(); }); }
      track.addEventListener("scroll", sync, { passive: true });
      window.addEventListener("resize", sync);
      sync();
    });
  }

  /* --- Testimonial slider ----------------------------------------------- */
  function initTestimonials() {
    var box = document.querySelector("[data-testimonials]");
    if (!box) { return; }

    var items = Array.prototype.slice.call(box.querySelectorAll(".testimonial"));
    var dotWrap = box.querySelector("[data-testimonial-dots]");
    if (items.length < 1) { return; }
    var index = 0;
    var dots = [];

    if (dotWrap) {
      items.forEach(function (_, i) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.setAttribute("aria-label", "Show testimonial " + (i + 1));
        dot.addEventListener("click", function () { show(i); });
        dotWrap.appendChild(dot);
        dots.push(dot);
      });
    }

    function show(i) {
      index = (i + items.length) % items.length;
      items.forEach(function (item, n) { item.classList.toggle("is-active", n === index); });
      dots.forEach(function (dot, n) { dot.classList.toggle("is-active", n === index); });
    }

    show(0);
    if (items.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.setInterval(function () { show(index + 1); }, 9000);
    }
  }

  /* --- Animated counters ------------------------------------------------ */
  function initCounters() {
    var nums = Array.prototype.slice.call(document.querySelectorAll("[data-count-to]"));
    if (!nums.length || !("IntersectionObserver" in window)) { return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { return; }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var el = entry.target;
        observer.unobserve(el);

        var target = parseInt(el.getAttribute("data-count-to"), 10) || 0;
        var suffix = el.getAttribute("data-count-suffix") || "";
        var start = performance.now();
        var duration = 1300;

        function frame(now) {
          var progress = Math.min((now - start) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (progress < 1) { requestAnimationFrame(frame); }
        }
        requestAnimationFrame(frame);
      });
    }, { threshold: 0.4 });

    nums.forEach(function (el) { observer.observe(el); });
  }

  /* --- Reveal on scroll -------------------------------------------------- */
  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!items.length) { return; }
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px" });
    items.forEach(function (el) { observer.observe(el); });
  }

  /* --- Back to top ------------------------------------------------------- */
  function initToTop() {
    var btn = document.querySelector("[data-to-top]");
    if (!btn) { return; }
    var update = function () {
      btn.classList.toggle("is-visible", window.scrollY > 420);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* --- Forms (no backend yet) -------------------------------------------- */
  function initForms() {
    var forms = Array.prototype.slice.call(document.querySelectorAll("[data-demo-form]"));
    forms.forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!form.reportValidity()) { return; }
        var status = form.querySelector("[data-form-status]");
        if (status) {
          status.textContent = form.getAttribute("data-success-message") ||
            "Thank you. Your message has been recorded. We will be in touch shortly.";
        }
        form.reset();
      });
    });
  }

  /* --- Footer year -------------------------------------------------------- */
  function initYear() {
    var slots = Array.prototype.slice.call(document.querySelectorAll("[data-year]"));
    var year = String(new Date().getFullYear());
    slots.forEach(function (el) { el.textContent = year; });
  }

  onReady(function () {
    initNav();
    initSearch();
    initDropdowns();
    initStickyHeader();
    initHero();
    initRails();
    initTestimonials();
    initCounters();
    initReveal();
    initToTop();
    initForms();
    initYear();
  });
})();
