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

  document.addEventListener("DOMContentLoaded", function () {
    initQuickAdd(document);
  });

  document.addEventListener("shopify:section:load", function (event) {
    initQuickAdd(event.target);
  });
})();
