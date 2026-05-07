(function () {
  var ticking = false;
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

  function boot() {
    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  document.addEventListener("shopify:section:load", requestUpdate);
  document.addEventListener("shopify:section:select", requestUpdate);
})();
