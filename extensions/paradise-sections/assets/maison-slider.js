(function () {
  var ticking = false;
  var lucideLoading = false;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var states = new WeakMap();

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function smooth(current, target) {
    return current + (target - current) * 0.16;
  }

  function updateBannerScroll() {
    ticking = false;
    if (reduceMotion) return;
    var needsFollowup = false;

    document.querySelectorAll(".slider-maison").forEach(function (section) {
      var effect = section.dataset.scrollEffect || "none";
      if (effect === "none") return;

      var rect = section.getBoundingClientRect();
      var viewport = window.innerHeight || 1;
      if (rect.bottom < 0 || rect.top > viewport) return;

      var progress = clamp(((rect.top + rect.height / 2) - viewport / 2) / viewport, -0.85, 0.85);
      var scrollOut = clamp((0 - rect.top) / Math.max(rect.height * 0.58, 1), 0, 1);
      var strength = Number(section.style.getPropertyValue("--sm-scroll-strength") || 20);
      if (window.innerWidth < 750) {
        strength = strength * 0.45;
      }

      var model = -progress * strength;
      var copy = scrollOut * strength * 1.1;
      var bg = progress * strength * 0.28;
      var copyOpacity = 1 - scrollOut * 0.92;

      if (effect === "parallax") {
        model = -progress * strength * 1.45;
        copy = scrollOut * strength * 1.35;
        bg = progress * strength * 0.5;
        copyOpacity = 1 - scrollOut * 0.96;
      }

      if (effect === "depth") {
        model = -progress * strength * 1.1;
        copy = scrollOut * strength * 0.78;
        bg = progress * strength * 0.34;
        copyOpacity = 1 - scrollOut * 0.86;
      }

      var state = states.get(section) || { model: 0, copy: 0, bg: 0, opacity: 1 };
      state.model = smooth(state.model, model);
      state.copy = smooth(state.copy, copy);
      state.bg = smooth(state.bg, bg);
      state.opacity = smooth(state.opacity, copyOpacity);
      states.set(section, state);
      if (
        Math.abs(state.model - model) > 0.2 ||
        Math.abs(state.copy - copy) > 0.2 ||
        Math.abs(state.bg - bg) > 0.2 ||
        Math.abs(state.opacity - copyOpacity) > 0.01
      ) {
        needsFollowup = true;
      }

      section.style.setProperty("--sm-scroll-model", state.model.toFixed(2) + "px");
      section.style.setProperty("--sm-scroll-copy", state.copy.toFixed(2) + "px");
      section.style.setProperty("--sm-scroll-bg", state.bg.toFixed(2) + "px");
      section.style.setProperty("--sm-scroll-copy-opacity", state.opacity.toFixed(3));
    });

    if (needsFollowup) {
      requestUpdate();
    }
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateBannerScroll);
  }

  function renderLucideIcons(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (!scope.querySelector("[data-lucide]")) return;

    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons({
        attrs: {
          "stroke-width": 1.8
        }
      });
      return;
    }

    if (lucideLoading) return;
    lucideLoading = true;

    var script = document.createElement("script");
    script.src = "https://unpkg.com/lucide@latest";
    script.async = true;
    script.onload = function () {
      lucideLoading = false;
      if (window.lucide && typeof window.lucide.createIcons === "function") {
        window.lucide.createIcons({
          attrs: {
            "stroke-width": 1.8
          }
        });
      }
    };
    script.onerror = function () {
      lucideLoading = false;
    };
    document.head.appendChild(script);
  }

  function initPopups(root) {
    var scope = root && root.querySelectorAll ? root : document;

    scope.querySelectorAll("[data-sm-popup-open]").forEach(function (button) {
      if (button.dataset.smPopupReady === "true") return;
      button.dataset.smPopupReady = "true";

      button.addEventListener("click", function () {
        var id = button.getAttribute("data-sm-popup-open");
        var popup = document.querySelector('[data-sm-popup="' + id + '"]');
        var html = button.getAttribute("data-sm-popup-html") || "";

        if (!popup && html) {
          popup = document.createElement("div");
          popup.className = "sm-popup";
          popup.setAttribute("data-sm-popup", id);
          popup.hidden = true;
          popup.innerHTML =
            '<div class="sm-popup-backdrop" data-sm-popup-close></div>' +
            '<div class="sm-popup-dialog" role="dialog" aria-modal="true">' +
            '<button class="sm-popup-close" type="button" data-sm-popup-close aria-label="Chiudi">×</button>' +
            '<div class="sm-popup-content"></div>' +
            "</div>";
          popup.querySelector(".sm-popup-content").innerHTML = html;
          document.body.appendChild(popup);
        }

        if (!popup) return;

        if (popup.parentElement !== document.body) {
          document.body.appendChild(popup);
        }

        popup.hidden = false;
        document.body.classList.add("sm-popup-lock");

        var close = popup.querySelector("[data-sm-popup-close]");
        if (close) {
          window.requestAnimationFrame(function () {
            close.focus();
          });
        }
      });
    });
  }

  function closePopup(popup) {
    if (!popup) return;
    popup.hidden = true;
    if (!document.querySelector(".sm-popup:not([hidden])")) {
      document.body.classList.remove("sm-popup-lock");
    }
  }

  function refresh(event) {
    renderLucideIcons(event && event.target ? event.target : document);
    initPopups(event && event.target ? event.target : document);
    requestUpdate();
  }

  function boot() {
    refresh();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  document.addEventListener("shopify:section:load", refresh);
  document.addEventListener("shopify:section:select", refresh);
  document.addEventListener("shopify:block:select", refresh);

  document.addEventListener("click", function (event) {
    var close = event.target.closest("[data-sm-popup-close]");
    if (!close) return;
    closePopup(close.closest("[data-sm-popup]"));
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    closePopup(document.querySelector(".sm-popup:not([hidden])"));
  });
})();
