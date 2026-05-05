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

  document.addEventListener("DOMContentLoaded", function () {
    initQuickAdd(document);
    initGridToolbar(document);
  });

  document.addEventListener("shopify:section:load", function (event) {
    initQuickAdd(event.target);
    initGridToolbar(event.target);
  });
})();
