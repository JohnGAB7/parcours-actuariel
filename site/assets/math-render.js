// Render explicit and common bare mathematical notation consistently across all static pages.
(function () {
  "use strict";
  if (!window.renderMathInElement) return;

  const EXCLUDED = "code, pre, script, style, kbd, .katex, .math-rendered, .math-notation-source";
  const BARE_EQUATION = /(?<![\p{L}\d_])(?:[A-Za-zδΔ][\p{L}\d_{}]*|\d+(?:[.,]\d+)?)(?:\s*(?:=|<|>|≤|≥|≈|≠|\+|−|×|÷|\/|\^|\\cdot|\\times)\s*(?:[A-Za-zδΔ][\p{L}\d_{}]*|\d+(?:[.,]\d+)?|\([^)]*\)))+/gu;
  const BARE_INDEXED = /(?<![\p{L}\d])(?:[A-Za-zδΔ][\p{L}\d]*)(?:_(?:\{[^{}]+\}|[\p{L}\d]+)|\^(?:\{[^{}]+\}|[\p{L}\d]+))+(?![\p{L}\d])/gu;
  const DELIMITED = /(\$\$[\s\S]*?\$\$|\$[^$]*\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g;

  function wrapNotation(value) {
    return String(value || "").split(DELIMITED).map((part, index) => {
      if (index % 2) return part;
      // A bare fragment becomes math only with a relation or a product: "01 / 24" or "LEARN / MODEL" stays text.
      return part.replace(BARE_EQUATION, (match) => (/[=<>≤≥≈≠×^]|\\cdot|\\times/.test(match) ? "$" + match.trim() + "$" : match))
        .replace(BARE_INDEXED, (match) => "$" + match.trim() + "$");
    }).join("");
  }

  function prepare(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      if (node.parentElement && node.parentElement.closest(EXCLUDED)) continue;
      nodes.push(node);
    }
    nodes.forEach((node) => {
      const text = wrapNotation(node.nodeValue);
      if (text === node.nodeValue) return;
      const span = document.createElement("span");
      span.className = "math-notation-source";
      span.textContent = text;
      node.replaceWith(span);
    });
  }

  function render(root) {
    prepare(root);
    window.renderMathInElement(root, {
      delimiters: [
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false }
      ],
      throwOnError: false,
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
    });
  }

  window.renderActuarialMath = render;
  render(document.body);
})();
