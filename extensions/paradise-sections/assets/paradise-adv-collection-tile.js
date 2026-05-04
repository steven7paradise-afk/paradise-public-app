(function () {
  function findProductGrid(host) {
    var section = host.closest(".shopify-section") || document;
    var selectors = [
      "#product-grid",
      ".product-grid",
      "ul.grid",
      ".collection .grid",
      "product-grid ul",
      "[data-product-grid]",
    ];

    for (var index = 0; index < selectors.length; index += 1) {
      var grid = section.querySelector(selectors[index]) || document.querySelector(selectors[index]);
      if (grid && grid !== host && !grid.contains(host)) return grid;
    }

    return null;
  }

  function placeTile(host) {
    var grid = findProductGrid(host);
    if (!grid) {
      host.hidden = false;
      return;
    }

    var insertAfter = parseInt(host.getAttribute("data-insert-after") || "4", 10);
    var children = Array.prototype.slice.call(grid.children).filter(function (child) {
      return child !== host && !child.classList.contains("paradise-adv-grid-tile-host");
    });
    var reference = children[Math.max(0, insertAfter - 1)];

    host.hidden = false;
    host.classList.add("paradise-adv-grid-tile-host--placed");

    if (!reference) {
      grid.appendChild(host);
      return;
    }

    reference.insertAdjacentElement("afterend", host);
  }

  function init() {
    document.querySelectorAll(".paradise-adv-grid-tile-host").forEach(placeTile);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  document.addEventListener("shopify:section:load", init);
  document.addEventListener("shopify:section:select", init);
})();
