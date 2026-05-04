(function () {
  function countProductChildren(container) {
    if (!container || !container.children) return 0;

    return Array.prototype.slice.call(container.children).filter(function (child) {
      return child.querySelector && child.querySelector('a[href*="/products/"]');
    }).length;
  }

  function findProductGrid(host) {
    var selectors = [
      "#product-grid",
      ".product-grid",
      ".products-grid",
      ".collection-products",
      ".collection-product-list",
      ".collection__products",
      "ul.grid",
      ".collection .grid",
      "product-grid ul",
      "[data-product-grid]",
      "[data-products-grid]",
      "[data-section-type='collection-template'] .grid",
    ];
    var candidates = [];

    for (var index = 0; index < selectors.length; index += 1) {
      document.querySelectorAll(selectors[index]).forEach(function (grid) {
        if (grid && grid !== host && !grid.contains(host)) candidates.push(grid);
      });
    }

    document.querySelectorAll('a[href*="/products/"]').forEach(function (link) {
      var node = link.parentElement;
      var depth = 0;

      while (node && node !== document.body && depth < 6) {
        if (countProductChildren(node) >= 2 && !node.contains(host)) candidates.push(node);
        node = node.parentElement;
        depth += 1;
      }
    });

    return candidates
      .map(function (grid) {
        return { grid: grid, score: countProductChildren(grid) };
      })
      .filter(function (candidate) {
        return candidate.score >= 2;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })[0]?.grid || null;
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
    var reference = children[insertAfter - 1];

    host.hidden = false;
    host.classList.add("paradise-adv-grid-tile-host--placed");

    if (insertAfter <= 0 && children[0]) {
      grid.insertBefore(host, children[0]);
      return;
    }

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
