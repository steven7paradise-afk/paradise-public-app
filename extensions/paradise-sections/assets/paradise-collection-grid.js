(function () {
  function formatMoney(cents, currency) {
    var amount = Number(cents || 0) / 100;
    try {
      return new Intl.NumberFormat(document.documentElement.lang || "it-IT", {
        style: "currency",
        currency: currency || "EUR",
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      return amount.toFixed(2).replace(".", ",") + " " + (currency || "EUR");
    }
  }

  function updateTotal(form) {
    var input = form.querySelector("[data-qty-input]");
    var total = form.querySelector("[data-total-price]");
    var price = Number(form.getAttribute("data-price") || 0);
    var currency = form.getAttribute("data-currency") || "EUR";
    var quantity = Math.max(1, Math.min(99, Number(input.value || 1)));

    input.value = quantity;
    if (total) {
      total.textContent = formatMoney(price * quantity, currency);
    }
  }

  function initQuickAdd(root) {
    var forms = (root || document).querySelectorAll("[data-quick-add]");

    forms.forEach(function (form) {
      if (form.dataset.paradiseReady === "true") return;
      form.dataset.paradiseReady = "true";

      var minus = form.querySelector("[data-qty-minus]");
      var plus = form.querySelector("[data-qty-plus]");
      var input = form.querySelector("[data-qty-input]");

      if (minus) {
        minus.addEventListener("click", function () {
          input.value = Math.max(1, Number(input.value || 1) - 1);
          updateTotal(form);
        });
      }

      if (plus) {
        plus.addEventListener("click", function () {
          input.value = Math.min(99, Number(input.value || 1) + 1);
          updateTotal(form);
        });
      }

      if (input) {
        input.addEventListener("input", function () {
          updateTotal(form);
        });
      }

      updateTotal(form);
    });
  }

  function initQuickReveal(root) {
    var cards = (root || document).querySelectorAll("[data-product-card]");

    cards.forEach(function (card) {
      if (card.dataset.paradiseRevealReady === "true") return;
      card.dataset.paradiseRevealReady = "true";
      if (!card.querySelector("[data-quick-add]")) return;

      card.addEventListener("click", function (event) {
        if (event.target.closest("[data-quick-add], button, input, select, textarea")) return;
        if (card.classList.contains("is-quick-open")) return;

        event.preventDefault();
        var section = card.closest(".paradise-collection-grid") || document;
        section.querySelectorAll(".pcg-product-card.is-quick-open").forEach(function (openCard) {
          if (openCard !== card) openCard.classList.remove("is-quick-open");
        });
        card.classList.add("is-quick-open");
      });
    });
  }

  function initGridToolbar(root) {
    var sections = (root || document).querySelectorAll(".paradise-collection-grid");

    sections.forEach(function (section) {
      if (section.dataset.paradiseToolbarReady === "true") return;
      section.dataset.paradiseToolbarReady = "true";

      var buttons = section.querySelectorAll("[data-grid-columns]");
      var isMobile = window.matchMedia("(max-width: 749px)");

      function setActive(columns, mobileMode) {
        buttons.forEach(function (button) {
          var isButtonMobile = button.classList.contains("pcg-view-btn--mobile");
          var sameMode = mobileMode ? isButtonMobile : !isButtonMobile;
          button.classList.toggle("is-active", sameMode && button.getAttribute("data-grid-columns") === String(columns));
        });
      }

      buttons.forEach(function (button) {
        button.addEventListener("click", function () {
          var columns = button.getAttribute("data-grid-columns");
          var mobileButton = button.classList.contains("pcg-view-btn--mobile");

          if (mobileButton) {
            section.style.setProperty("--pcg-mobile-columns", columns);
          } else {
            section.style.setProperty("--pcg-columns", columns);
          }

          setActive(columns, mobileButton);
        });
      });

      function syncActive() {
        var mobileMode = isMobile.matches;
        var property = mobileMode ? "--pcg-mobile-columns" : "--pcg-columns";
        var columns = section.style.getPropertyValue(property).trim() || (mobileMode ? "2" : "3");
        setActive(columns, mobileMode);
      }

      syncActive();
      if (isMobile.addEventListener) {
        isMobile.addEventListener("change", syncActive);
      }
    });
  }

  function initLoadMore(root) {
    var sections = (root || document).querySelectorAll(".paradise-collection-grid");

    sections.forEach(function (section) {
      if (section.dataset.paradiseLoadMoreReady === "true") return;
      section.dataset.paradiseLoadMoreReady = "true";

      section.querySelectorAll("[data-product-card]").forEach(function (card) {
        card.dataset.pcgVisible = card.classList.contains("pcg-product-card--hidden") ? "false" : "true";
      });

      var button = section.querySelector("[data-load-more]");
      if (!button) return;

      button.addEventListener("click", function () {
        var step = Math.max(1, Number(button.getAttribute("data-step") || 8));
        var hidden = Array.prototype.slice.call(section.querySelectorAll(".pcg-product-card--hidden"));

        hidden.slice(0, step).forEach(function (card) {
          card.classList.remove("pcg-product-card--hidden");
          card.dataset.pcgVisible = "true";
        });

        if (!section.querySelector(".pcg-product-card--hidden")) {
          button.parentElement.style.display = "none";
        }
      });
    });
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function initProductSearch(root) {
    var sections = (root || document).querySelectorAll(".paradise-collection-grid");

    sections.forEach(function (section) {
      if (section.dataset.paradiseSearchReady === "true") return;
      section.dataset.paradiseSearchReady = "true";

      var input = section.querySelector("[data-product-search]");
      var clear = section.querySelector("[data-product-search-clear]");
      var toggle = section.querySelector("[data-product-search-toggle]");
      var wrap = section.querySelector("[data-product-search-wrap]");
      var loadMore = section.querySelector("[data-load-more]");
      var empty = section.querySelector("[data-product-search-empty]");
      if (!input) return;

      function applySearch() {
        var query = normalize(input.value);
        var open = wrap && wrap.classList.contains("is-open");
        var searching = query.length > 0;
        var matches = 0;

        section.classList.toggle("is-search-open", open);
        section.classList.toggle("is-searching", searching);

        section.querySelectorAll("[data-product-card]").forEach(function (card) {
          if (!card.dataset.pcgVisible) {
            card.dataset.pcgVisible = card.classList.contains("pcg-product-card--hidden") ? "false" : "true";
          }

          var text = normalize(card.getAttribute("data-product-search-text"));
          var words = query.split(/\s+/).filter(Boolean);
          var matched = searching && words.every(function (word) {
            return text.indexOf(word) !== -1;
          });

          card.classList.toggle("pcg-product-card--search-hidden", open && !matched);

          if (searching && matched) {
            card.classList.remove("pcg-product-card--hidden");
            matches += 1;
          } else if (!open && card.dataset.pcgVisible !== "true") {
            card.classList.add("pcg-product-card--hidden");
          }
        });

        section.querySelectorAll(".pcg-adv-card").forEach(function (card) {
          card.classList.toggle("pcg-adv-card--search-hidden", open);
        });

        if (loadMore && loadMore.parentElement) {
          loadMore.parentElement.style.display = open ? "none" : "";
        }

        section.classList.toggle("is-search-empty", open && (!searching || matches === 0));
        if (empty) {
          empty.textContent = searching ? empty.getAttribute("data-empty-text") : empty.getAttribute("data-hint-text");
          empty.hidden = !(open && (!searching || matches === 0));
        }
      }

      input.addEventListener("input", applySearch);

      if (toggle && wrap) {
        toggle.addEventListener("click", function () {
          wrap.classList.add("is-open");
          toggle.setAttribute("aria-expanded", "true");
          window.requestAnimationFrame(function () {
            input.focus();
          });
          applySearch();
        });
      }

      if (clear) {
        clear.addEventListener("click", function () {
          input.value = "";
          if (wrap) wrap.classList.remove("is-open");
          if (toggle) toggle.setAttribute("aria-expanded", "false");
          applySearch();
          if (toggle) toggle.focus();
        });
      }

      applySearch();
    });
  }

  function initProductCarousel(root) {
    var sections = (root || document).querySelectorAll("[data-product-carousel]");

    sections.forEach(function (section) {
      if (section.dataset.paradiseCarouselReady === "true") return;
      section.dataset.paradiseCarouselReady = "true";

      var track = section.querySelector("[data-carousel-track]");
      var prev = section.querySelector("[data-carousel-prev]");
      var next = section.querySelector("[data-carousel-next]");
      var dotsWrap = section.querySelector("[data-carousel-dots]");
      if (!track) return;

      function getStep() {
        var slide = track.querySelector(".ppc-slide");
        if (!slide) return track.clientWidth;
        var gap = parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap || 0);
        return slide.getBoundingClientRect().width + gap;
      }

      function pages() {
        return Math.max(1, Math.ceil(track.scrollWidth / Math.max(1, track.clientWidth)));
      }

      function activePage() {
        return Math.min(pages() - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
      }

      function renderDots() {
        if (!dotsWrap) return;
        dotsWrap.innerHTML = "";
        for (var i = 0; i < pages(); i += 1) {
          var dot = document.createElement("button");
          dot.type = "button";
          dot.className = "ppc-dot";
          dot.setAttribute("aria-label", "Vai al gruppo prodotti " + (i + 1));
          dot.dataset.page = String(i);
          dotsWrap.appendChild(dot);
        }
        syncDots();
      }

      function syncDots() {
        if (!dotsWrap) return;
        var current = activePage();
        dotsWrap.querySelectorAll(".ppc-dot").forEach(function (dot) {
          dot.classList.toggle("is-active", Number(dot.dataset.page) === current);
        });
      }

      function go(direction) {
        var nextLeft = track.scrollLeft + getStep() * direction;
        if (nextLeft >= track.scrollWidth - track.clientWidth - 4) nextLeft = 0;
        if (nextLeft < 0) nextLeft = track.scrollWidth;
        track.scrollTo({ left: nextLeft, behavior: "smooth" });
      }

      if (prev) prev.addEventListener("click", function () { go(-1); });
      if (next) next.addEventListener("click", function () { go(1); });
      if (dotsWrap) {
        dotsWrap.addEventListener("click", function (event) {
          var dot = event.target.closest(".ppc-dot");
          if (!dot) return;
          track.scrollTo({ left: Number(dot.dataset.page) * track.clientWidth, behavior: "smooth" });
        });
      }

      track.addEventListener("scroll", function () {
        window.requestAnimationFrame(syncDots);
      });

      renderDots();
      window.addEventListener("resize", renderDots);

      if (section.dataset.autoplay === "true") {
        var interval = Math.max(2, Number(section.dataset.interval || 4)) * 1000;
        var timer = window.setInterval(function () { go(1); }, interval);
        section.addEventListener("mouseenter", function () { window.clearInterval(timer); });
        section.addEventListener("mouseleave", function () {
          timer = window.setInterval(function () { go(1); }, interval);
        });
      }
    });
  }

  function initAdvCarousel(root) {
    var carousels = (root || document).querySelectorAll("[data-adv-carousel]");

    carousels.forEach(function (carousel) {
      if (carousel.dataset.paradiseAdvReady === "true") return;
      carousel.dataset.paradiseAdvReady = "true";

      var slides = Array.prototype.slice.call(carousel.querySelectorAll(".pcg-adv-slide"));
      if (!slides.length) return;
      var index = slides.findIndex(function (slide) { return slide.classList.contains("is-active"); });
      if (index < 0) index = 0;
      slides.forEach(function (slide, slideIndex) {
        slide.classList.toggle("is-active", slideIndex === index);
      });
      if (slides.length < 2) return;

      var interval = Math.max(2, Number(carousel.dataset.interval || 4)) * 1000;
      window.setInterval(function () {
        slides[index].classList.remove("is-active");
        index = (index + 1) % slides.length;
        slides[index].classList.add("is-active");
      }, interval);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initQuickAdd(document);
    initQuickReveal(document);
    initGridToolbar(document);
    initLoadMore(document);
    initProductSearch(document);
    initProductCarousel(document);
    initAdvCarousel(document);
  });

  document.addEventListener("shopify:section:load", function (event) {
    initQuickAdd(event.target);
    initQuickReveal(event.target);
    initGridToolbar(event.target);
    initLoadMore(event.target);
    initProductSearch(event.target);
    initProductCarousel(event.target);
    initAdvCarousel(event.target);
  });
})();
