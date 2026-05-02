(function () {
  function setupMaisonSlider(section) {
    if (!section || section.dataset.pmsReady === "true") return;

    var viewport = section.querySelector("[data-pms-viewport]");
    var track = section.querySelector("[data-pms-track]");
    var slides = Array.from(section.querySelectorAll("[data-pms-slide]"));
    var dots = Array.from(section.querySelectorAll("[data-pms-dot]"));
    var prev = section.querySelector("[data-pms-prev]");
    var next = section.querySelector("[data-pms-next]");

    if (!viewport || !track || slides.length < 2) {
      section.dataset.pmsReady = "true";
      return;
    }

    var current = 0;
    var autoplayId = null;
    var startX = 0;
    var deltaX = 0;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var autoplayEnabled = section.dataset.pmsAutoplay === "true";
    var autoplayDelay = parseInt(section.dataset.pmsDelay, 10) || 5500;

    function render() {
      track.style.transform = "translate3d(-" + current * 100 + "%, 0, 0)";

      slides.forEach(function (slide, index) {
        slide.setAttribute("aria-hidden", index === current ? "false" : "true");
      });

      dots.forEach(function (dot, index) {
        var isActive = index === current;
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function goTo(index) {
      current = (index + slides.length) % slides.length;
      render();
    }

    function stopAutoplay() {
      if (autoplayId) {
        window.clearInterval(autoplayId);
        autoplayId = null;
      }
    }

    function startAutoplay() {
      if (reduceMotion || !autoplayEnabled) return;
      stopAutoplay();
      autoplayId = window.setInterval(function () {
        goTo(current + 1);
      }, autoplayDelay);
    }

    if (prev) {
      prev.addEventListener("click", function () {
        goTo(current - 1);
        startAutoplay();
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        goTo(current + 1);
        startAutoplay();
      });
    }

    dots.forEach(function (dot, index) {
      dot.addEventListener("click", function () {
        goTo(index);
        startAutoplay();
      });
    });

    viewport.addEventListener(
      "touchstart",
      function (event) {
        startX = event.changedTouches[0].clientX;
        deltaX = 0;
        stopAutoplay();
      },
      { passive: true }
    );

    viewport.addEventListener(
      "touchmove",
      function (event) {
        deltaX = event.changedTouches[0].clientX - startX;
      },
      { passive: true }
    );

    viewport.addEventListener("touchend", function () {
      if (Math.abs(deltaX) > 40) {
        goTo(deltaX < 0 ? current + 1 : current - 1);
      }
      startAutoplay();
    });

    section.addEventListener("mouseenter", stopAutoplay);
    section.addEventListener("mouseleave", startAutoplay);
    section.addEventListener("focusin", stopAutoplay);
    section.addEventListener("focusout", startAutoplay);

    render();
    startAutoplay();
    section.dataset.pmsReady = "true";
  }

  function bootMaisonSliders() {
    document.querySelectorAll(".paradise-maison-slider").forEach(setupMaisonSlider);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootMaisonSliders, { once: true });
  } else {
    bootMaisonSliders();
  }

  document.addEventListener("shopify:section:load", bootMaisonSliders);
  document.addEventListener("shopify:section:select", bootMaisonSliders);
})();
