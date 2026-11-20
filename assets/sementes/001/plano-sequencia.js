(() => {
  "use strict";
  if (typeof Path2D !== "function") return;

  const script = document.currentScript.src;
  const paper = "#f5efe2";
  const night = "#201c17";
  const archive = "#ebe1d0";
  const copper = "#c19a65";
  const star = new Path2D("M0-24 4-5 21 0 4 4 0 24-4 4-21 0-4-5Z");
  const cuts = [
    {source: [0, 1382, 282, 153], x: 838, y: 124.5, name: "C", depth: .39},
    {source: [0, 1537, 518, 236], x: 1017, y: 298, name: "B", depth: .63},
    {source: [0, 1026, 729, 354], x: 1171.5, y: 546, name: "A", depth: 1},
  ];

  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function phase(value, start, end) {
    const t = clamp((value - start) / Math.max(1, end - start));
    return t * t * (3 - 2 * t);
  }

  function noise(seed) {
    let state = seed;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function engraving(seed) {
    const random = noise(seed);
    const tile = document.createElement("canvas");
    tile.width = tile.height = 464;
    const pen = tile.getContext("2d");
    pen.translate(232, 232);
    pen.rotate(-.36);
    for (let strand = 0; strand < 48; strand++) {
      const arm = strand % 3;
      const lane = Math.floor(strand / 3);
      const start = random() * .8;
      const sweep = 2.14 + random() * 2.2;
      pen.beginPath();
      pen.lineWidth = .68 + random() * 1.8;
      pen.strokeStyle = strand % 9 === 0 ? "#f3deb3" : strand % 3 === 0 ? "#99724c" : "#d2ad77";
      pen.globalAlpha = .22 + random() * .67;
      for (let i = 0; i <= 65; i++) {
        const t = start + i / 65 * sweep;
        const angle = t + arm * Math.PI * 2 / 3 + lane * .052;
        const radius = 10 + t * (22 + lane * 1.32) + Math.sin(t * 13 + strand) * 2;
        pen.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius * .56);
      }
      pen.stroke();
    }
    for (let i = 0; i < 460; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 20 + 202 * random();
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * .59;
      pen.globalAlpha = .12 + random() * .54;
      pen.fillStyle = i % 7 ? "#d6aa73" : "#f1dbb2";
      const length = .7 + random() * 3.5;
      pen.fillRect(x, y, length, .7 + random() * 1.1);
    }
    pen.globalAlpha = .84;
    pen.fillStyle = "#f1dbb2";
    pen.scale(.25, .25);
    pen.fill(star);
    return tile;
  }

  function grain() {
    const tile = document.createElement("canvas");
    tile.width = 347;
    tile.height = 271;
    const pen = tile.getContext("2d");
    const random = noise(71);
    for (let i = 0; i < 1350; i++) {
      pen.fillStyle = i % 7 ? "#ac885d" : "#e6c899";
      pen.globalAlpha = .08 + random() * .27;
      pen.fillRect(random() * tile.width, random() * tile.height, .45 + random() * 2.6, .45 + random() * .85);
    }
    return tile;
  }

  function measured(element, scroll) {
    const box = element.getBoundingClientRect();
    return {x: box.left, y: box.top + scroll, w: box.width, h: box.height};
  }

  function pointOn(box, x, y) {
    return {x: box.x + box.w * x, y: box.y + box.h * y};
  }

  function interpolateBox(a, b, t) {
    return {x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t)};
  }

  // One scroll clock. Cues are measured in document coordinates after layout.
  window.createPlanoSequencia = function createPlanoSequencia(atlas) {
    const root = document.documentElement;
    const canvas = document.getElementById("plano-sequencia");
    const ctx = canvas.getContext("2d");
    const plate = document.querySelector(".plate-link");
    const desk = document.querySelector(".writing-window");
    const ink = document.querySelector(".ink-window");
    const universe = document.getElementById("expansao");
    const map = document.querySelector(".map");
    const sky = document.querySelector(".sky");
    const print = document.querySelector(".print-window");
    const cross = document.querySelector(".crossed");
    const seed = document.querySelector(".last-seed");
    const symbols = [...map.querySelectorAll("#espiral path")].map(path => new Path2D(path.getAttribute("d")));
    const sprite = new Image();
    let ready = false;
    let enabled = false;
    let dirty = true;
    let requested = false;
    let layout, texture, fieldPattern, spirals;
    let lastScroll = -1;
    let lastSymbols = 1;
    let lastActive = false;
    if (!ctx) return {enable() {}, schedule() {}, measure() {}};

    function measure() {
      dirty = true;
      schedule();
    }

    function readLayout(scroll) {
      const width = root.clientWidth;
      const height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.35, Math.sqrt(1500000 / (width * height)));
      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
      const hero = measured(plate, scroll);
      const writing = measured(desk, scroll);
      const passage = measured(ink, scroll);
      const space = measured(universe, scroll);
      const chart = measured(map, scroll);
      const sheet = measured(print, scroll);
      const atlasScale = Math.min(chart.w / 440, chart.h / 366);
      const reach = Math.max(95, hero.y + hero.h * .18 - height * .37);
      const touch = Math.max(reach + 125, writing.y - height * .29);
      const breach = Math.max(touch + 80, passage.y - height * .37);
      const drift = Math.max(breach + 175, passage.y + passage.h * .55 - height * .30);
      const chartArrival = Math.max(drift + 190, chart.y - height * .66);
      return {
        width, height, hero, writing, passage, space, chart, sheet, atlasScale,
        chartStart: {x: chart.x + (chart.w - 440 * atlasScale) / 2, y: chart.y + (chart.h - 366 * atlasScale) / 2},
        reach, touch, breach, drift, chartArrival,
        imprint: sheet.y - height * .61,
        crossY: measured(cross, scroll).y,
        seedY: measured(seed, scroll).y,
      };
    }

    function schedule() {
      if (!ready || !enabled || requested) return;
      requested = true;
      requestAnimationFrame(render);
    }

    function enable(value) {
      if (enabled === value) return;
      enabled = value;
      root.classList.toggle("has-cinema", value && ready);
      if (!enabled) {
        map.style.removeProperty("--atlas-symbols");
        cross.style.removeProperty("--strike");
        lastSymbols = 1;
      }
      measure();
    }

    function setAtlasSymbols(value) {
      if (Math.abs(value - lastSymbols) < .001) return;
      lastSymbols = value;
      map.style.setProperty("--atlas-symbols", value.toFixed(3));
    }

    function spriteAt(source, x, y, w, h, opacity = 1, angle = 0) {
      if (opacity < .003 || w < .3 || h < .3) return;
      ctx.save();
      ctx.translate(x, y);
      if (angle) ctx.rotate(angle);
      ctx.globalAlpha = opacity;
      ctx.drawImage(sprite, ...source, -w / 2, -h / 2, w, h);
      ctx.restore();
    }

    function poseAt(scroll, l) {
      const move = phase(scroll, l.reach * .14, l.touch + 35);
      const release = phase(scroll, l.touch + 18, l.drift + 45);
      const initialScale = l.hero.w / 1536;
      const deskScale = l.writing.w / 990;
      const initial = pointOn(l.hero, 563 / 1536, 837 / 1024);
      const writing = pointOn(l.writing, .55, .64);
      const departure = pointOn(l.passage, .48, .05);
      const scale = mix(initialScale, deskScale, move) * (1 + .32 * release);
      const x = mix(mix(initial.x, writing.x, move), departure.x, release);
      const y = mix(mix(initial.y, writing.y, move), departure.y, release) - scroll;
      const portal = interpolateBox(l.hero, l.writing, move);
      return {
        x, y, scale, move, release, portal,
        tx: x - 563 * scale, ty: y - 837 * scale,
      };
    }

    function drawTable(scroll, l, pose) {
      if (pose.release >= 1 || pose.portal.y + pose.portal.h + 85 < scroll) return;
      const {tx, ty, scale, portal} = pose;
      const y = portal.y - scroll;
      const anticipation = phase(scroll, 0, l.reach + 55);
      const strokeTime = phase(scroll, l.reach, l.touch + 72);
      const wrist = Math.sin(anticipation * Math.PI) * -.013 + .019 * strokeTime * (1 - pose.release);
      ctx.save();
      ctx.beginPath();
      ctx.rect(portal.x - 4, y - 3, portal.w + 8, portal.h + 6);
      ctx.clip();
      if (pose.move > .55) {
        ctx.fillStyle = paper;
        ctx.fillRect(portal.x - 4, y - 3, portal.w + 8, portal.h + 6);
      }
      ctx.translate(tx, ty);
      ctx.scale(scale, scale);
      ctx.globalAlpha = 1 - phase(pose.release * 100, 32, 100);
      ctx.drawImage(sprite, 0, 0, 1536, 1024, 0, 0, 1536, 1024);
      ctx.translate(433, 780);
      ctx.rotate(wrist);
      ctx.drawImage(sprite, 1188, 1510, 333, 205, 318 - 433, 711 - 780, 333, 205);
      ctx.restore();
    }

    function inkOutline(scroll, l, pose) {
      const progress = phase(scroll, l.breach - 31, l.drift + 38);
      if (progress === 0) return null;
      const width = l.width;
      const cx = mix(pose.x, width * .51, progress);
      const head = mix(pose.y + 2, l.passage.y - scroll - 14, progress);
      const foot = l.space.y - scroll + 4;
      const shoulder = width * mix(.006, .65, progress);
      const warp = (1 - progress) * width * .115;
      const path = new Path2D();
      for (let i = 0; i <= 64; i++) {
        const u = 2 * i / 64 - 1;
        const x = cx + u * shoulder;
        const teeth = Math.sin(x / 12) * 3 + Math.cos(x / 26) * 6 + Math.sin(x * .61) * 1.4;
        const y = head + teeth * progress + Math.abs(u) ** 1.5 * warp;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      for (const side of [1, -1]) {
        for (let i = 0; i <= 34; i++) {
          const t = side === 1 ? i / 34 : 1 - i / 34;
          const meander = Math.sin(t * 5.7) * warp * .68;
          const widening = mix(shoulder, width * 1.12, t ** 2.7);
          path.lineTo(cx + side * widening + meander, mix(head + warp, foot, t));
        }
        if (side === 1) {
          path.lineTo(width, l.height + 1);
          path.lineTo(0, l.height + 1);
        }
      }
      path.closePath();
      return path;
    }

    function inkTrail(scroll, l, pose) {
      const draw = phase(scroll, l.reach * .7, l.drift - 45);
      if (draw === 0 || draw === 1) return;
      const endpoint = pointOn(l.passage, .62, .18);
      ctx.save();
      ctx.lineCap = "round";
      for (let i = 0; i < 5; i++) {
        const length = 60 + i * 10 + Math.abs(endpoint.y - pose.y - scroll);
        ctx.setLineDash([length * draw, length * 2]);
        ctx.strokeStyle = i === 0 ? "#331f17" : "#8c5d3a";
        ctx.globalAlpha = (i === 0 ? .84 : .36) * (1 - phase(draw * 100, 81, 100));
        ctx.lineWidth = i === 0 ? 1.65 : .66;
        ctx.beginPath();
        ctx.moveTo(pose.x, pose.y + i * .8);
        ctx.bezierCurveTo(pose.x + 32 + i * 3, pose.y + 12, endpoint.x - 54 + i * 9, endpoint.y - scroll - 22, endpoint.x + i * 5, endpoint.y - scroll);
        ctx.stroke();
      }
      ctx.restore();
    }

    function field(width, height, offset, strength) {
      ctx.fillStyle = night;
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.globalAlpha = strength;
      const horizontal = (offset * .026) % texture.width;
      const vertical = (offset * .043) % texture.height;
      ctx.translate(-horizontal, -vertical);
      ctx.fillStyle = fieldPattern;
      ctx.fillRect(0, 0, width + horizontal, height + vertical);
      ctx.restore();
    }

    function scoredInk(scroll, l, pose, progress) {
      if (progress < .012 || progress > .85) return;
      const reveal = phase(progress * 100, 2, 18) * (1 - phase(progress * 100, 53, 85));
      const tip = pose.y;
      const end = l.space.y - scroll;
      const center = mix(pose.x, l.width * .50, progress);
      ctx.save();
      ctx.strokeStyle = "#aa7e4e";
      for (let i = 0; i < 19; i++) {
        const bend = (i - 9) * l.width * .031;
        const start = tip + 14 + Math.abs(i - 9) * 5;
        const length = Math.max(15, (end - start) * (.48 + (i % 6) * .08));
        ctx.globalAlpha = reveal * (.12 + (i % 4) * .072);
        ctx.lineWidth = .5 + (i % 3) * .24;
        ctx.beginPath();
        ctx.moveTo(center + bend * .19, start);
        ctx.bezierCurveTo(center + bend * .25 - 24, start + length * .28,
          center + bend * .67 + 26, start + length * .67, center + bend, start + length);
        ctx.stroke();
      }
      ctx.restore();
    }

    function marks(x, y, radius, opacity) {
      if (opacity < .01) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = copper;
      ctx.lineWidth = .7;
      ctx.globalAlpha = opacity;
      ctx.setLineDash([1.5, 4]);
      for (const ratio of [.45, .72, 1]) {
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * ratio, radius * ratio * .84, -.12, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-radius * 1.3, 0);
      ctx.lineTo(radius * 1.3, 0);
      ctx.moveTo(0, -radius);
      ctx.lineTo(0, radius);
      ctx.stroke();
      ctx.restore();
    }

    function atlasPoint(name, l, scroll) {
      const {x, y, rotation, symbolScale} = atlas(name);
      return {
        x: l.chartStart.x + x * l.atlasScale,
        y: l.chartStart.y + y * l.atlasScale - scroll,
        angle: rotation * Math.PI / 180,
        scale: symbolScale * l.atlasScale,
      };
    }

    function atlasSymbol(point, alpha) {
      if (alpha < .003) return;
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(point.angle);
      ctx.scale(point.scale, point.scale);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#e9e1d0";
      for (const path of symbols) ctx.fill(path);
      ctx.restore();
    }

    function drawJourney(scroll, l, pose, outline, handoff) {
      const into = phase(scroll, l.breach - 70, l.drift + 10);
      const travelInto = phase(scroll, l.breach - 100, l.drift - 25);
      const resolve = phase(scroll, l.drift + 10, l.chartArrival + 95);
      const detail = phase(into * 100, 8, 67) * (1 - phase(resolve * 100, 38, 100));
      const paperPass = 1 - phase(into * 100, 10, 64);
      const measure = Math.min(l.width, 660);
      const cameraRise = phase(scroll, l.breach, l.drift + 47);
      const horizon = mix(l.passage.y + l.passage.h * .56 - scroll, l.height * .38, cameraRise);
      const target = atlasPoint("A", l, scroll);
      const cX = mix(l.width * .5, target.x, resolve);
      const cY = mix(horizon, target.y, resolve);
      const travel = Math.sin(into * Math.PI * .86) * (1 - resolve);
      const chartLines = phase(into * 100, 30, 90) * (1 - resolve * .73);
      const placed = cuts.map((cut, index) => {
        const target = atlasPoint(cut.name, l, scroll);
        const spread = Math.sin(pose.move * Math.PI) * (10 + index * 2);
        const originX = pose.tx + cut.x * pose.scale + spread;
        const originY = pose.ty + cut.y * pose.scale - spread * 1.4;
        const layoutX = l.width * [.26, .73, .51][index] + (index - 1) * 20 * travel;
        const layoutY = horizon + measure * [-.19, -.12, .12][index] - travel * index * 8;
        const curve = Math.sin(into * Math.PI) * (1 - resolve) * (index - 1) * measure * .115;
        const x = mix(mix(originX, layoutX, travelInto) + curve, target.x, resolve);
        const y = mix(mix(originY, layoutY, travelInto), target.y, resolve);
        const full = measure * [.32, .43, .96][index] * (1 + travel * cut.depth * .26);
        const size = mix(mix(cut.source[2] * pose.scale, full, into), 52 * target.scale, resolve);
        const angle = mix(travel * (index - 1) * .18, target.angle, resolve);
        return {cut, x, y, size, angle};
      });
      if (paperPass > .003) {
        const portal = pose.portal;
        ctx.save();
        ctx.beginPath();
        ctx.rect(portal.x - 1, portal.y - scroll - 1, portal.w + 2, portal.h + 2);
        ctx.clip();
        for (const {cut, x, y, size, angle} of placed) {
          spriteAt(cut.source, x, y, size, size * cut.source[3] / cut.source[2], paperPass, angle);
        }
        ctx.restore();
      }
      if (outline) {
        ctx.save();
        ctx.clip(outline);
        field(l.width, l.height, scroll, .63 * (1 - handoff));
        scoredInk(scroll, l, pose, into);
        marks(cX, cY, measure * mix(.48, .30, resolve), chartLines * .51);
        for (let i = 0; i < 6 && detail > .003; i++) {
          const z = i % 3 + 1;
          const x = cX + measure * ((i * 151 % 609) / 609 - .45) * (1 + travel * z * .12);
          const y = cY + measure * ((i * 193 % 450) / 450 - .48) * (1 + travel * z * .13);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(i * .83);
          ctx.scale(.17 + z * .046, .17 + z * .046);
          ctx.globalAlpha = detail * .57;
          ctx.fillStyle = i % 3 ? copper : "#f1d9a9";
          ctx.fill(star);
          ctx.restore();
        }
        const negative = (1 - paperPass) * (1 - phase(resolve * 100, 23, 100)) * .86;
        for (const [index, {cut, x, y, size, angle}] of placed.entries()) {
          const [, sy, sw, sh] = cut.source;
          spriteAt([730, sy, sw, sh], x, y, size, size * sh / sw, negative, angle);
          if (detail < .003) continue;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle + cut.depth * .14);
          ctx.globalAlpha = detail;
          ctx.drawImage(spirals[index], -size * .60, -size * .60, size * 1.20, size * 1.20);
          ctx.restore();
        }
        ctx.restore();
      }
      const exact = phase(resolve * 100, 56, 100) * (1 - handoff);
      for (const {x, y, size, angle} of placed) {
        atlasSymbol({x, y, angle, scale: size / 52}, exact);
      }
    }

    function drawImpression(scroll, l) {
      const y = l.sheet.y - scroll;
      if (y > l.height || y + l.sheet.h < 0) return;
      const p = phase(scroll, l.imprint, l.sheet.y - l.height * .04);
      const width = l.width;
      const outer = Math.min(width * .81, 620);
      const sw = mix(width + 8, outer, p);
      const sh = mix(l.sheet.h + 30, Math.min(l.sheet.h * .53, outer * .35), p);
      const x = width / 2 + p * width * .025;
      const centerY = y + mix(sh * .5 - 14, l.sheet.h * .43, p);
      const inkTop = centerY - sh * .5;
      const inkBottom = centerY + sh * .5;
      const left = x - sw * .5;
      const right = x + sw * .5;
      const block = new Path2D();
      block.moveTo(left, inkTop);
      for (let i = 1; i <= 34; i++) {
        const edge = Math.sin(i * 2.73) * 2.2 * p + Math.cos(i * 1.48) * 1.7 * p;
        block.lineTo(mix(left, right, i / 34), inkTop + edge);
      }
      block.lineTo(right - p * 6, inkBottom - p * 6);
      for (let i = 34; i >= 0; i--) {
        const edge = Math.sin(i * 2.1) * 2.6 + Math.cos(i * .35) * 3.5;
        block.lineTo(mix(left, right, i / 34), inkBottom + edge);
      }
      block.closePath();

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, y, width, l.sheet.h);
      ctx.clip();
      ctx.fillStyle = archive;
      ctx.fillRect(0, y, width, l.sheet.h);
      ctx.save();
      ctx.clip(block);
      field(width, l.height, scroll, .35);
      marks(x, centerY, sw * .22, .4);
      for (const [index, cut] of cuts.entries()) {
        const point = atlas(cut.name);
        atlasSymbol({
          x: x + (point.x - 220) * sw / 300,
          y: centerY + (point.y - 183) * sh / 145,
          scale: point.symbolScale * sw / 420,
          angle: point.rotation * Math.PI / 180,
        }, .8);
        const detail = .47 * phase(p * 100, 6, 64);
        if (detail < .003) continue;
        const size = sw * [.25, .26, .38][index];
        ctx.globalAlpha = detail;
        ctx.drawImage(spirals[index], x + (index - 1) * sw * .21 - size / 2, centerY - size / 2, size, size);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      const paperReveal = phase(p * 100, 18, 96);
      ctx.globalAlpha = paperReveal * .54;
      ctx.lineWidth = .65;
      ctx.strokeStyle = "#8f6f52";
      ctx.beginPath();
      ctx.moveTo(left - 7, inkBottom + 42);
      ctx.lineTo(left - 10, inkTop - 11);
      ctx.lineTo(right - 29, inkTop - 12);
      ctx.lineTo(right + 10, inkTop + 4);
      ctx.lineTo(right + 7, inkBottom + 38);
      ctx.lineTo(left - 7, inkBottom + 42);
      ctx.moveTo(right - 30, inkTop - 11);
      ctx.lineTo(right - 31, inkTop + 3);
      ctx.lineTo(right + 9, inkTop + 4);
      for (let i = 0; i < 5; i++) {
        ctx.moveTo(left + 7, inkBottom + 19 + i * 7);
        ctx.lineTo(right - 36 - i * 8, inkBottom + 18 + i * 7);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      const handWidth = sw * .43;
      spriteAt([1188, 1510, 333, 205], left + handWidth * .34, inkBottom + 34,
        handWidth, handWidth * .615, paperReveal * .53, -.17);
      ctx.restore();
    }

    function render() {
      requested = false;
      if (!ready || !enabled) return;
      const scroll = window.scrollY;
      if (dirty) {
        layout = readLayout(scroll);
        dirty = false;
      }
      const l = layout;
      cross.style.setProperty("--strike", phase(l.height + scroll - l.crossY, l.height * .08, l.height * .65));
      seed.style.setProperty("--seed-progress", phase(l.height + scroll - l.seedY, l.height * .07, l.height * .51));

      const journey = scroll < l.chartArrival + 167;
      const impression = l.sheet.y - l.height < scroll && scroll < l.sheet.y + l.sheet.h;
      const visible = journey || impression;
      if (visible || lastActive) ctx.clearRect(0, 0, l.width, l.height);
      lastActive = visible;
      const handoff = phase(scroll, l.chartArrival + 84, l.chartArrival + 160);
      setAtlasSymbols(handoff);
      if (journey) {
        const pose = poseAt(scroll, l);
        const outline = inkOutline(scroll, l, pose);
        drawTable(scroll, l, pose);
        inkTrail(scroll, l, pose);
        drawJourney(scroll, l, pose, outline, handoff);
      }
      if (impression) drawImpression(scroll, l);
      lastScroll = scroll;
    }

    const spatialChange = () => {
      if (window.scrollY !== lastScroll) schedule();
    };
    window.addEventListener("scroll", spatialChange, {passive: true});
    window.addEventListener("resize", measure, {passive: true});
    window.visualViewport?.addEventListener("resize", measure, {passive: true});
    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(measure);
      [plate, desk, ink, universe, sky, print, document.body].forEach(element => observer.observe(element));
    }
    sprite.onload = () => {
      texture = grain();
      fieldPattern = ctx.createPattern(texture, "repeat");
      spirals = [93, 312, 77].map(engraving);
      ready = true;
      if (!enabled) return;
      root.classList.add("has-cinema");
      render();
    };
    sprite.src = new URL("matriz.webp", script).href;
    return {enable, schedule, measure};
  };
})();
