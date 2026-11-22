(() => {
  "use strict";

  const root = document.documentElement;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motionToggle = document.getElementById("motion-toggle");
  let quiet = true;

  function updateMotion() {
    const reduced = quiet || motion.matches;
    root.classList.toggle("reduced-motion", reduced);
    motionToggle.setAttribute("aria-pressed", String(reduced));
    motionToggle.textContent = motion.matches ? "Movimento reduzido" :
      quiet ? "Restaurar movimento" : "Reduzir movimento";
    motionToggle.disabled = motion.matches;
    if (reduced) endDive();
  }

  const plate = document.querySelector(".plate-link");
  const original = plate.querySelector(".hero-art");
  const layers = plate.querySelector(".plate-layers");
  const dive = document.querySelector(".ink-dive");
  const target = document.getElementById("lemaitre");
  const plateAssets = new URL(".", original.src);
  const regions = [
    [697, 48, 282, 153],
    [758, 180, 518, 236],
    [807, 369, 729, 354],
  ];
  let islandLayers = [];
  let framePending = false;
  let diveTimeout = 0;

  function layer(name, className) {
    const image = new Image();
    image.alt = "";
    image.className = className;
    return new Promise((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = new URL(name, plateAssets).href;
    });
  }

  function loadLayers() {
    const pieces = regions.map(([left, top, width, height], index) =>
      layer("mancha-" + (index + 1) + ".webp", "plate-part island").then((image) => {
        image.style.left = (left / 1536 * 100) + "%";
        image.style.top = (top / 1024 * 100) + "%";
        image.style.width = (width / 1536 * 100) + "%";
        image.style.height = (height / 1024 * 100) + "%";
        return image;
      })
    );
    return Promise.all([layer("mesa.webp", "plate-part plate-body"), ...pieces]).then(([body, ...islands]) => {
      islandLayers = islands;
      layers.append(body, ...islands);
      if (!root.classList.contains("reduced-motion")) plate.classList.add("layers-ready");
      updatePlate();
    }).catch(() => {
      // The original stays visible if a layer is unavailable.
    });
  }

  function updatePlate() {
    framePending = false;
    if (!islandLayers.length || root.classList.contains("reduced-motion")) return;
    const box = plate.getBoundingClientRect();
    if (box.bottom < -32 || box.top > window.innerHeight) return;
    const progress = Math.max(0, Math.min(1, (window.scrollY - 15) / Math.max(270, box.height)));
    const paths = [[-12, -36, .22], [18, -22, .3], [26, -8, .74]];
    islandLayers.forEach((image, index) => {
      const [dx, dy, scale] = paths[index];
      image.style.setProperty("--x", (dx * progress) + "px");
      image.style.setProperty("--y", (dy * progress) + "px");
      image.style.setProperty("--s", 1 + scale * progress);
    });
    plate.style.setProperty("--dash", Math.round(200 * (1 - progress)));
  }

  function schedulePlate() {
    if (!framePending && !root.classList.contains("reduced-motion")) {
      framePending = true;
      requestAnimationFrame(updatePlate);
    }
  }

  function endDive() {
    window.clearTimeout(diveTimeout);
    diveTimeout = 0;
    delete dive.dataset.stage;
    dive.replaceChildren();
  }

  function enterPlate(event) {
    if (root.classList.contains("reduced-motion") || islandLayers.length !== regions.length ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (diveTimeout) return;
    const island = islandLayers[2];
    const bounds = island.getBoundingClientRect();
    if (bounds.bottom < 0 || bounds.top > window.innerHeight) {
      target.scrollIntoView();
      target.focus({preventScroll: true});
      return;
    }
    const piece = island.cloneNode(false);
    piece.className = "dive-piece";
    piece.style.cssText = "";
    piece.style.setProperty("--left", (bounds.left + bounds.width / 2) + "px");
    piece.style.setProperty("--top", (bounds.top + bounds.height / 2) + "px");
    piece.style.setProperty("--width", bounds.width + "px");
    dive.append(piece);
    dive.dataset.stage = "enter";
    const reveal = () => {
      if (dive.dataset.stage !== "enter") return;
      window.clearTimeout(diveTimeout);
      dive.dataset.stage = "exit";
      window.history.pushState(null, "", "#lemaitre");
      target.scrollIntoView();
      target.focus({preventScroll: true});
      diveTimeout = window.setTimeout(endDive, 475);
    };
    piece.addEventListener("animationend", reveal, {once: true});
    diveTimeout = window.setTimeout(reveal, 940);
  }

  motionToggle.addEventListener("click", () => {
    quiet = !quiet;
    updateMotion();
    plate.classList.toggle("layers-ready", islandLayers.length > 0 && !root.classList.contains("reduced-motion"));
    schedulePlate();
  });
  motion.addEventListener("change", () => {
    updateMotion();
    plate.classList.toggle("layers-ready", islandLayers.length > 0 && !root.classList.contains("reduced-motion"));
    schedulePlate();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && diveTimeout) endDive();
  });
  [plate, document.querySelector(".begin")].forEach((link) => link.addEventListener("click", enterPlate));
  window.addEventListener("scroll", schedulePlate, {passive: true});
  window.addEventListener("resize", schedulePlate, {passive: true});

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
  let origin = "A";

  function position(name, scale) {
    const [x, y] = coordinates[name];
    const [ox, oy] = coordinates[origin];
    return [center[0] + (x - ox) * scale, center[1] + (y - oy) * scale];
  }

  function renderExpansion(announce = false) {
    const scale = Number(scaleInput.value) / 100;
    const showTraces = scale > 1.05;
    traceNote.hidden = !showTraces;
    const scaleLabel = scaleDecimal.format(scale) + "×";
    scaleValue.textContent = scaleLabel;
    scaleInput.setAttribute("aria-valuetext", scaleLabel);
    nodes.forEach((node, index) => {
      const name = node.dataset.node;
      const [x, y] = position(name, scale);
      node.setAttribute("transform", "translate(" + x + " " + y + ")");
      const [startX, startY] = position(name, 1);
      traceDots[index].setAttribute("cx", startX);
      traceDots[index].setAttribute("cy", startY);
      traceDots[index].style.display = showTraces && name !== origin ? "" : "none";
    });
    const comparisons = ["A", "B", "C"].filter((name) => name !== origin);
    distances.forEach((line, index) => {
      const [x, y] = position(comparisons[index], scale);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
    });

    const pairs = distances.map((_, index) => {
      const name = comparisons[index];
      const [x, y] = position(name, 1);
      const before = Math.hypot(x - center[0], y - center[1]) / 14;
      return origin + "–" + name + ": " + decimal.format(before) + " → " + decimal.format(before * scale);
    });
    distanceValue.textContent = pairs.join(" · ") + " unidades";
    if (announce) announcement.textContent = "Observação da galáxia " + origin + ". " + distanceValue.textContent;
  }

  function setOrigin(name) {
    origin = name;
    originButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.origin === name));
    });
    renderExpansion(true);
  }

  scaleInput.addEventListener("input", () => renderExpansion());
  scaleInput.addEventListener("change", () => renderExpansion(true));
  originButtons.forEach((button) => button.addEventListener("click", () => setOrigin(button.dataset.origin)));
  document.getElementById("reset-expansion").addEventListener("click", () => {
    scaleInput.value = scaleInput.min;
    setOrigin("A");
  });

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
  renderExpansion();
  root.classList.add("enhanced");
  if (document.readyState === "complete") loadLayers();
  else window.addEventListener("load", loadLayers, {once: true});
})();
