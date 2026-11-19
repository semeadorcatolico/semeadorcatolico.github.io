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
    root.classList.toggle("has-motion", !reduced);
    plate.classList.toggle("layers-ready", !reduced && islandLayers.length > 0);
    if (!reduced) scheduleScenes();
  }

  const plate = document.querySelector(".plate-link");
  const original = plate.querySelector(".hero-art");
  const layers = plate.querySelector(".plate-layers");
  const cosmic = document.querySelector(".cosmic-passage");
  const cosmicStage = cosmic.firstElementChild;
  const paper = document.querySelector(".paper-passage");
  const crossed = document.querySelector(".crossed");
  const motionScenes = [plate, cosmic, paper, crossed];
  const visibleScenes = new Set(motionScenes);
  const lastProgress = new Map();
  const plateAssets = new URL(".", original.src);
  const regions = [
    [697, 48, 282, 153],
    [758, 180, 518, 236],
    [807, 369, 729, 354],
  ];
  let islandLayers = [];
  let framePending = false;

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
      lastProgress.delete(plate);
      scheduleScenes();
    }).catch(() => {
      // The original stays visible if a layer is unavailable.
    });
  }

  function ease(progress, start, end) {
    const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
    return t * t * (3 - 2 * t);
  }

  function setStyles(element, values) {
    Object.entries(values).forEach(([property, value]) => {
      element.style.setProperty("--" + property, value);
    });
  }

  function paintPlate(progress) {
    const paths = [[-12, -30, .09], [9, -17, .13], [14, -5, .24]];
    islandLayers.forEach((image, index) => {
      const [dx, dy, scale] = paths[index];
      setStyles(image, {x: dx * progress + "px", y: dy * progress + "px", s: 1 + scale * progress});
    });
    setStyles(plate, {dash: 200 * (1 - progress)});
  }

  function paintCosmos(progress) {
    const camera = ease(progress, .04, .91);
    const light = ease(progress, .20, .79);
    setStyles(cosmicStage, {
      "paper-opacity": 1 - light,
      "field-opacity": ease(progress, .32, .82),
      "field-y": -22 * camera + "px",
      "chart-opacity": .57 * ease(progress, .39, .78),
      "chart-y": 25 * (1 - camera) + "px",
      "chart-angle": -13 * (1 - camera) + "deg",
      "far-x": -111 - 135 * camera + "%",
      "far-y": -150 - 92 * camera + "%",
      "mid-x": 147 * camera + "%",
      "mid-y": -75 - 42 * camera + "%",
      "outer-opacity": 1 - .82 * ease(progress, .50, 1),
      "near-scale": .75 + 2.8 * camera,
      "near-opacity": 1 - .88 * ease(progress, .58, 1),
    });
  }

  function paintPaper(progress) {
    const fold = ease(progress, .04, .94);
    setStyles(paper, {
      "leaf-angle": 70 * (1 - fold) + "deg",
      "impression-opacity": .55 * (1 - ease(progress, .17, .86)),
      "impression-y": 85 * fold + "px",
      "impression-scale": .8 + .8 * fold,
      "rules-opacity": .8 * ease(progress, .28, .72),
    });
  }

  function updateScenes() {
    framePending = false;
    if (!root.classList.contains("has-motion")) return;
    const viewport = document.documentElement.clientHeight;
    const updates = [];
    for (const scene of visibleScenes) {
      const box = scene.getBoundingClientRect();
      let progress = ease(viewport * .88 - box.top, 0, viewport * .53);
      if (scene === cosmic) {
        progress = ease(viewport * .53 - box.top, 0, viewport * .53 + box.height - cosmicStage.offsetHeight);
      } else if (scene === plate) {
        progress = ease(window.scrollY, 0, Math.max(220, box.height));
      }
      if (lastProgress.get(scene) === progress) continue;
      lastProgress.set(scene, progress);
      updates.push([scene, progress]);
    }
    for (const [scene, progress] of updates) {
      if (scene === plate) paintPlate(progress);
      else if (scene === cosmic) paintCosmos(progress);
      else if (scene === paper) paintPaper(progress);
      else setStyles(crossed, {strike: ease(progress, .05, .85)});
    }
  }

  function scheduleScenes() {
    if (framePending || !root.classList.contains("has-motion")) return;
    framePending = true;
    requestAnimationFrame(updateScenes);
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleScenes.add(entry.target);
        else visibleScenes.delete(entry.target);
      }
      scheduleScenes();
    }, {rootMargin: "100px 0px"});
    motionScenes.forEach((scene) => observer.observe(scene));
  }

  motionToggle.addEventListener("click", () => {
    const scene = motionScenes.find((element) => {
      const {top, bottom} = element.getBoundingClientRect();
      return top < innerHeight / 2 && bottom > innerHeight / 2;
    });
    quiet = !quiet;
    updateMotion();
    if (scene === cosmic || scene === paper) {
      document.getElementById(scene === cosmic ? "expansao" : "manuscrito").scrollIntoView();
    }
  });
  motion.addEventListener("change", updateMotion);
  window.addEventListener("scroll", scheduleScenes, {passive: true});
  window.addEventListener("resize", scheduleScenes, {passive: true});

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

  const documentButtons = [...document.querySelectorAll("[data-document]")];
  let sheetMotion;
  function showDocument(name, animate = false) {
    const incoming = document.getElementById(name);
    if (animate && !incoming.hidden) return;
    const outgoing = documentButtons.map((button) => document.getElementById(button.dataset.document))
      .find((sheet) => !sheet.hidden);
    const startHeight = animate ? outgoing.offsetHeight : 0;
    sheetMotion?.cancel();
    documentButtons.forEach((button) => {
      const selected = button.dataset.document === name;
      button.setAttribute("aria-pressed", String(selected));
      document.getElementById(button.dataset.document).hidden = !selected;
    });
    if (!animate || !root.classList.contains("has-motion") || !incoming.animate) return;
    const endHeight = incoming.offsetHeight;
    const offset = Math.min(11, Math.abs(startHeight - endHeight) * .07 + 4);
    sheetMotion = incoming.animate([
      {opacity: .58, transform: "translateY(" + offset + "px) scale(.988)"},
      {opacity: 1, transform: "none"},
    ], {duration: 285, easing: "cubic-bezier(.2,.7,.25,1)"});
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
  if (document.readyState === "complete") loadLayers();
  else window.addEventListener("load", loadLayers, {once: true});
})();
