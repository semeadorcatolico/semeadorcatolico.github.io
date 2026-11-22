(() => {
  "use strict";

  const root = document.documentElement;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motionToggle = document.getElementById("motion-toggle");
  let quiet = false;

  function updateMotion() {
    const reduced = quiet || motion.matches;
    root.classList.toggle("reduced-motion", reduced);
    motionToggle.setAttribute("aria-pressed", String(reduced));
    motionToggle.textContent = motion.matches ? "Movimento reduzido" :
      quiet ? "Restaurar movimento" : "Reduzir movimento";
    motionToggle.disabled = motion.matches;
    cinema?.enable(!reduced);
    if (reduced) {
      cancelAnimationFrame(cameraFrame);
      camera = coordinates[origin].slice();
      finishSheetSwitch();
      renderMap();
    }
  }

  motionToggle.addEventListener("click", () => {
    quiet = !quiet;
    updateMotion();
  });
  motion.addEventListener("change", updateMotion);

  const coordinates = {
    A: [0, 0],
    B: [43.6, -31.3],
    C: [-31.1, -42],
    D: [-52, 23],
    E: [17, 42],
    F: [59, 16],
  };
  const scaleInput = document.getElementById("expansion-scale");
  const scaleValue = document.getElementById("scale-value");
  const distanceValue = document.getElementById("distance-value");
  const announcement = document.getElementById("expansion-status");
  const traceNote = document.getElementById("trace-note");
  const originButtons = [...document.querySelectorAll("[data-origin]")];
  const nodes = [...document.querySelectorAll("[data-node]")];
  const distances = [document.getElementById("distance-one"), document.getElementById("distance-two")];
  const traceLayer = document.getElementById("traces");
  const traceDots = nodes.map(() => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("r", "3");
    traceLayer.append(circle);
    return circle;
  });
  const decimal = new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 1, maximumFractionDigits: 1});
  const scaleDecimal = new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const center = [220, 183];
  const ring = document.querySelector(".origin-ring");
  const symbol = {
    A: [0, 1], B: [-23, 1], C: [40, .83], D: [-24, .69], E: [55, .76], F: [15, .68],
  };
  let origin = "A";
  let camera = coordinates.A.slice();
  let cameraFrame;
  const cinema = typeof Path2D === "function" ? window.createPlanoSequencia?.((name) => {
    const [x, y] = position(name, Number(scaleInput.value) / 100);
    const [rotation, symbolScale] = symbol[name];
    return {x, y, rotation, symbolScale};
  }) : undefined;

  function position(name, scale) {
    const [x, y] = coordinates[name];
    return [center[0] + (x - camera[0]) * scale, center[1] + (y - camera[1]) * scale];
  }

  function comparisons() {
    return ["A", "B", "C"].filter((name) => name !== origin);
  }

  function renderMap() {
    const scale = Number(scaleInput.value) / 100;
    const [ox, oy] = position(origin, scale);
    nodes.forEach((node, index) => {
      const name = node.dataset.node;
      const [x, y] = position(name, scale);
      node.setAttribute("transform", "translate(" + x + " " + y + ")");
      const [startX, startY] = position(name, 1);
      traceDots[index].setAttribute("cx", startX);
      traceDots[index].setAttribute("cy", startY);
      traceDots[index].style.display = scale > 1.05 && name !== origin ? "" : "none";
    });
    comparisons().forEach((name, index) => {
      const [x, y] = position(name, scale);
      const line = distances[index];
      line.setAttribute("x1", ox);
      line.setAttribute("y1", oy);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
    });
    ring.setAttribute("cx", ox);
    ring.setAttribute("cy", oy);
    cinema?.schedule();
  }

  function renderExpansion(announce = false) {
    const scale = Number(scaleInput.value) / 100;
    traceNote.hidden = scale <= 1.05;
    const scaleLabel = scaleDecimal.format(scale) + "×";
    scaleValue.textContent = scaleLabel;
    scaleInput.setAttribute("aria-valuetext", scaleLabel);
    const [ox, oy] = coordinates[origin];
    const pairs = comparisons().map((name) => {
      const [x, y] = coordinates[name];
      const before = Math.hypot(x - ox, y - oy) / 14;
      return origin + "–" + name + ": " + decimal.format(before) + " → " + decimal.format(before * scale);
    });
    distanceValue.textContent = pairs.join(" · ") + " unidades";
    if (announce) announcement.textContent = "Observação da galáxia " + origin + ". " + distanceValue.textContent;
    renderMap();
  }

  function setOrigin(name) {
    cancelAnimationFrame(cameraFrame);
    const start = camera;
    const target = coordinates[name];
    origin = name;
    originButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.origin === name));
    });
    if (root.classList.contains("reduced-motion")) {
      camera = target.slice();
    } else if (start[0] !== target[0] || start[1] !== target[1]) {
      const began = performance.now();
      const follow = (now) => {
        const t = Math.max(0, Math.min(1, (now - began) / 390));
        const drift = t * t * (3 - 2 * t);
        camera = target.map((next, axis) => start[axis] + (next - start[axis]) * drift);
        renderMap();
        if (t < 1) cameraFrame = requestAnimationFrame(follow);
      };
      cameraFrame = requestAnimationFrame(follow);
    }
    renderExpansion(true);
  }

  scaleInput.addEventListener("input", () => renderExpansion());
  scaleInput.addEventListener("change", () => renderExpansion(true));
  originButtons.forEach((button) => button.addEventListener("click", () => setOrigin(button.dataset.origin)));
  document.getElementById("reset-expansion").addEventListener("click", () => {
    scaleInput.value = scaleInput.min;
    setOrigin("A");
  });

  const documentButtons = [...document.querySelectorAll("[data-document]")];
  const documents = documentButtons.map((button) => document.getElementById(button.dataset.document));
  const draft = document.getElementById("rascunho");
  const pages = draft.parentElement;
  let selectedDocument;
  let sheetMotion;
  let heightMotion;

  function finishSheetSwitch() {
    sheetMotion?.cancel();
    heightMotion?.cancel();
    sheetMotion = undefined;
    heightMotion = undefined;
    delete pages.dataset.overlap;
    documents.forEach((sheet) => { sheet.hidden = sheet !== selectedDocument; });
    cinema?.measure();
  }

  function edge(amount) {
    return "polygon(0 0, 100% 0, 100% " + amount + "%, 76% " + Math.max(0, amount - 1) +
      "%, 43% " + amount + "%, 21% " + Math.max(0, amount - .7) + "%, 0 " + amount + "%)";
  }

  function showDocument(name, animate = false) {
    const incoming = document.getElementById(name);
    if (incoming === selectedDocument) return;
    const overlap = animate && selectedDocument && !root.classList.contains("reduced-motion") && draft.animate;
    const startEdge = overlap && sheetMotion ? getComputedStyle(draft).clipPath : edge(selectedDocument === draft ? 100 : 0);
    const startHeight = overlap ? pages.getBoundingClientRect().height : 0;
    finishSheetSwitch();
    selectedDocument = incoming;
    documentButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.document === name));
    });
    documents.forEach((sheet) => {
      const selected = sheet === incoming;
      sheet.inert = !selected;
      sheet.hidden = !selected && !overlap;
    });
    if (!overlap) return;
    pages.dataset.overlap = "";
    const endHeight = incoming.getBoundingClientRect().height;
    const duration = 375;
    const timing = {duration, easing: "cubic-bezier(.28,.06,.22,1)", fill: "both"};
    sheetMotion = draft.animate([
      {clipPath: startEdge}, {clipPath: edge(incoming === draft ? 100 : 0)},
    ], timing);
    if (Math.abs(startHeight - endHeight) > 1) {
      heightMotion = pages.animate([{height: startHeight + "px"}, {height: endHeight + "px"}], timing);
    }
    sheetMotion.onfinish = finishSheetSwitch;
  }
  documentButtons.forEach((button) => button.addEventListener("click", () => showDocument(button.dataset.document, true)));

  const conclusion = document.querySelector(".last-question");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      conclusion.classList.add("in-view");
      observer.disconnect();
    }, {threshold: .22});
    observer.observe(conclusion);
  }

  updateMotion();
  showDocument("rascunho");
  renderExpansion();
  root.classList.add("enhanced");
})();
