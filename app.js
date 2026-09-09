(() => {
  const COLORS = [
    "#E08A45", "#7BA56F", "#C9A8CC", "#E4C85A",
    "#D39A58", "#B7D0DC", "#6A9AA8", "#D3C2E8",
    "#E7C9B0", "#E6B7B3", "#C7A24E", "#D3E4B6"
  ];
  const GROUP_COLORS = ["#F0D36A", "#E89270", "#B48AD6", "#C6E07A", "#F3C27A", "#C9DDE8"];

  const board = document.getElementById("board");
  const overlay = document.getElementById("overlay");
  const overlayImg = document.getElementById("overlayImg");
  const overlayFields = document.getElementById("overlayFields");
  const overlayCode = document.getElementById("overlayCode");
  const toastEl = document.getElementById("toast");

  const CARD_W = 210;
  const CARD_H = 248;
  const GAP_X = 28;
  const GAP_Y = 36;
  const COLS = 5;

  const state = {
    cards: [],
    groups: [],
    filter: "ALL",
    drag: null,
    lastClick: { id: null, t: 0 }
  };

  function seriesColor(id, i) {
    const map = { A: 0, B: 2, C: 5, D: 1 };
    const base = map[id[0]] ?? 0;
    return COLORS[(base + i) % COLORS.length];
  }

  function layoutInitial() {
    const startX = 16;
    const startY = 12;
    CARD_DATA.forEach((raw, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      state.cards.push({
        ...raw,
        color: seriesColor(raw.id, i),
        x: startX + col * (CARD_W + GAP_X),
        y: startY + row * (CARD_H + GAP_Y),
        flipped: false,
        groupId: null
      });
    });
  }

  function visibleCards() {
    if (state.filter === "ALL") return state.cards;
    return state.cards.filter((c) => c.series === state.filter);
  }

  function shortTitle(title) {
    return title.replace(/^《|》$/g, "").slice(0, 22);
  }

  function cardHTML(card, compact) {
    const year = card.year && card.year !== "—" ? card.year : "";
    return `
      <article class="folder-card ${card.flipped ? "flipped" : ""}" data-id="${card.id}" style="left:${card.x}px;top:${card.y}px;">
        <div class="folder-shell">
          <div class="folder-tab" style="background:${card.color}">
            <span class="tab-sq"></span>
            <span class="tab-code">${card.id}</span>
          </div>
          <div class="folder-body">
            <div class="flip-scene">
              <div class="flip-inner">
                <div class="face face-front" style="background:${card.color}">
                  <img class="cover" src="${card.thumb}" alt="${escapeHtml(card.title)}" draggable="false">
                  <div class="caption">
                    <div class="ttl">${escapeHtml(shortTitle(card.title))}</div>
                    <div class="meta">${escapeHtml(card.author !== "—" ? card.author : "")}${year ? " · " + year : ""}</div>
                  </div>
                </div>
                <div class="face face-back">
                  <div class="corner-code">${card.id}</div>
                  <div class="text-row"><div class="k">标题</div><div class="v">${escapeHtml(card.title)}</div></div>
                  <div class="text-row"><div class="k">作者</div><div class="v">${escapeHtml(card.author)}</div></div>
                  <div class="text-row"><div class="k">年代</div><div class="v">${escapeHtml(card.year)}</div></div>
                  <div class="text-row desc"><div class="k">描述</div><div class="v">${escapeHtml(card.desc)}</div></div>
                  <div class="text-row meaning"><div class="k">意义</div><div class="v">${escapeHtml(card.meaning)}</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    const ungrouped = visibleCards().filter((c) => !c.groupId);
    const groups = state.groups.filter((g) => {
      const members = state.cards.filter((c) => c.groupId === g.id);
      return members.some((c) => state.filter === "ALL" || c.series === state.filter);
    });

    board.innerHTML =
      groups.map((g) => {
        const members = state.cards.filter((c) => c.groupId === g.id && (state.filter === "ALL" || c.series === state.filter));
        return `
          <section class="group-folder" data-gid="${g.id}" style="left:${g.x}px;top:${g.y}px;background:${g.color}">
            <div class="group-head">
              <input class="group-title" data-gid="${g.id}" value="${escapeHtml(g.title)}" />
              <div class="group-actions">
                <button class="icon-btn light" data-ungroup="${g.id}" title="解散">×</button>
              </div>
            </div>
            <div class="group-body">
              ${members.map((c) => cardHTML(c, true)).join("")}
            </div>
          </section>
        `;
      }).join("") +
      ungrouped.map((c) => cardHTML(c, false)).join("");

    bindEvents();
    fitBoard();
  }

  function fitBoard() {
    let maxY = 800;
    state.cards.forEach((c) => {
      if (!c.groupId) maxY = Math.max(maxY, c.y + CARD_H + 80);
    });
    state.groups.forEach((g) => {
      maxY = Math.max(maxY, g.y + 360);
    });
    board.style.minHeight = maxY + "px";
  }

  function getCard(id) {
    return state.cards.find((c) => c.id === id);
  }

  function bindEvents() {
    board.querySelectorAll(".folder-card").forEach((el) => {
      el.addEventListener("pointerdown", onCardPointerDown);
    });
    board.querySelectorAll(".group-folder").forEach((el) => {
      el.addEventListener("pointerdown", onGroupPointerDown);
    });
    board.querySelectorAll(".group-title").forEach((el) => {
      el.addEventListener("change", (e) => {
        const g = state.groups.find((x) => x.id === e.target.dataset.gid);
        if (g) g.title = e.target.value.trim() || "未命名组";
      });
      el.addEventListener("pointerdown", (e) => e.stopPropagation());
    });
    board.querySelectorAll("[data-ungroup]").forEach((btn) => {
      btn.addEventListener("pointerdown", (e) => e.stopPropagation());
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        dissolveGroup(btn.dataset.ungroup);
      });
    });
  }

  function liftCardOntoBoard(el, card, ev) {
    const group = state.groups.find((g) => g.id === card.groupId);
    const boardRect = board.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    card.groupId = null;
    card.x = r.left - boardRect.left + board.scrollLeft;
    card.y = r.top - boardRect.top + board.scrollTop;
    el.style.position = "absolute";
    el.style.left = card.x + "px";
    el.style.top = card.y + "px";
    el.style.width = CARD_W + "px";
    el.style.height = CARD_H + "px";
    board.appendChild(el);
    if (group) {
      const remain = state.cards.filter((c) => c.groupId === group.id);
      if (remain.length < 2) {
        remain.forEach((c, i) => {
          c.groupId = null;
          c.x = group.x + i * (CARD_W + 16);
          c.y = group.y;
        });
        state.groups = state.groups.filter((g) => g.id !== group.id);
        const groupEl = board.querySelector(`.group-folder[data-gid="${group.id}"]`);
        if (groupEl) groupEl.remove();
        remain.forEach((c) => {
          if (c.id === card.id) return;
          const html = cardHTML(c, false);
          board.insertAdjacentHTML("beforeend", html);
          const node = board.querySelector(`.folder-card[data-id="${c.id}"]`);
          if (node) node.addEventListener("pointerdown", onCardPointerDown);
        });
      }
    }
    return { x: card.x, y: card.y };
  }

  function onCardPointerDown(e) {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const id = el.dataset.id;
    const card = getCard(id);
    const startX = e.clientX;
    const startY = e.clientY;
    let originX = card.x;
    let originY = card.y;
    let moved = false;
    let pointerId = e.pointerId;

    el.setPointerCapture(pointerId);
    state.drag = { type: "card", id };

    const move = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      if (!moved) {
        moved = true;
        el.classList.add("dragging");
        if (card.groupId) {
          const pos = liftCardOntoBoard(el, card, ev);
          originX = pos.x - (ev.clientX - startX);
          originY = pos.y - (ev.clientY - startY);
        } else {
          originX = card.x;
          originY = card.y;
        }
      }
      card.x = originX + (ev.clientX - startX);
      card.y = originY + (ev.clientY - startY);
      el.style.left = card.x + "px";
      el.style.top = card.y + "px";
      highlightMergeTarget(card.id);
    };

    const up = (ev) => {
      try { el.releasePointerCapture(pointerId); } catch (_) {}
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.classList.remove("dragging");
      clearHighlights();
      if (!moved) {
        handleCardClick(card);
      } else {
        tryMerge(card);
        render();
      }
      state.drag = null;
    };

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  function onGroupPointerDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest(".folder-card")) return;
    const el = e.currentTarget;
    const gid = el.dataset.gid;
    const group = state.groups.find((g) => g.id === gid);
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = group.x;
    const origY = group.y;
    let moved = false;
    el.setPointerCapture(e.pointerId);

    const move = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true;
      el.classList.add("dragging");
      group.x = origX + dx;
      group.y = origY + dy;
      el.style.left = group.x + "px";
      el.style.top = group.y + "px";
    };
    const up = (ev) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.classList.remove("dragging");
      if (moved) {
        tryMergeGroup(group);
        render();
      }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  function handleCardClick(card) {
    const now = Date.now();
    if (state.lastClick.id === card.id && now - state.lastClick.t < 320) {
      openOverlay(card);
      state.lastClick = { id: null, t: 0 };
      return;
    }
    state.lastClick = { id: card.id, t: now };
    card.flipped = !card.flipped;
    const el = board.querySelector(`.folder-card[data-id="${card.id}"]`);
    if (el) el.classList.toggle("flipped", card.flipped);
  }

  function rectOfCard(card) {
    if (card.groupId) {
      const el = board.querySelector(`.folder-card[data-id="${card.id}"]`);
      if (!el) return { x: card.x, y: card.y, w: 168, h: 200 };
      const br = board.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { x: r.left - br.left, y: r.top - br.top, w: r.width, h: r.height };
    }
    return { x: card.x, y: card.y, w: CARD_W, h: CARD_H };
  }

  function overlap(a, b) {
    const ax2 = a.x + a.w, ay2 = a.y + a.h;
    const bx2 = b.x + b.w, by2 = b.y + b.h;
    const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
    const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
    return ix * iy;
  }

  function highlightMergeTarget(sourceId) {
    clearHighlights();
    const source = getCard(sourceId);
    const hit = findMergeTarget(source);
    if (!hit) return;
    if (hit.type === "card") {
      const el = board.querySelector(`.folder-card[data-id="${hit.card.id}"]`);
      if (el) el.classList.add("merge-target");
    } else {
      const el = board.querySelector(`.group-folder[data-gid="${hit.group.id}"]`);
      if (el) el.style.outline = "2px dashed #1c1b19";
    }
  }

  function clearHighlights() {
    board.querySelectorAll(".merge-target").forEach((n) => n.classList.remove("merge-target"));
    board.querySelectorAll(".group-folder").forEach((n) => { n.style.outline = ""; });
  }

  function findMergeTarget(source) {
    const sr = rectOfCard(source);
    let best = null;
    let bestArea = 1800;
    visibleCards().forEach((c) => {
      if (c.id === source.id) return;
      const area = overlap(sr, rectOfCard(c));
      if (area > bestArea) {
        bestArea = area;
        best = c.groupId
          ? { type: "group", group: state.groups.find((g) => g.id === c.groupId) }
          : { type: "card", card: c };
      }
    });
    state.groups.forEach((g) => {
      const el = board.querySelector(`.group-folder[data-gid="${g.id}"]`);
      if (!el) return;
      const br = board.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const gr = { x: r.left - br.left, y: r.top - br.top, w: r.width, h: r.height };
      const area = overlap(sr, gr);
      if (area > bestArea) {
        bestArea = area;
        best = { type: "group", group: g };
      }
    });
    return best;
  }

  function tryMerge(source) {
    const hit = findMergeTarget(source);
    if (!hit) return;
    if (hit.type === "card") {
      createGroup([source, hit.card], hit.card.x, hit.card.y);
      toast("已成组。点击组标题即可重命名。");
    } else if (hit.group) {
      source.groupId = hit.group.id;
      toast("已加入「" + hit.group.title + "」");
    }
  }

  function tryMergeGroup(group) {
    const el = board.querySelector(`.group-folder[data-gid="${group.id}"]`);
    if (!el) return;
    const br = board.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const gr = { x: r.left - br.left, y: r.top - br.top, w: r.width, h: r.height };
    const other = state.groups.find((g) => {
      if (g.id === group.id) return false;
      const n = board.querySelector(`.group-folder[data-gid="${g.id}"]`);
      if (!n) return false;
      const rr = n.getBoundingClientRect();
      return overlap(gr, { x: rr.left - br.left, y: rr.top - br.top, w: rr.width, h: rr.height }) > 2400;
    });
    if (!other) return;
    state.cards.forEach((c) => {
      if (c.groupId === group.id) c.groupId = other.id;
    });
    state.groups = state.groups.filter((g) => g.id !== group.id);
    toast("两组已合并为「" + other.title + "」");
  }

  function createGroup(cards, x, y) {
    const id = "g-" + Date.now();
    const color = GROUP_COLORS[state.groups.length % GROUP_COLORS.length];
    state.groups.push({
      id,
      title: "未命名组",
      color,
      x: Math.max(8, x - 16),
      y: Math.max(8, y - 18)
    });
    cards.forEach((c) => { c.groupId = id; });
    setTimeout(() => {
      const input = board.querySelector(`.group-title[data-gid="${id}"]`);
      if (input) {
        input.focus();
        input.select();
      }
    }, 30);
  }

  function dissolveGroup(gid, silent) {
    const group = state.groups.find((g) => g.id === gid);
    const members = state.cards.filter((c) => c.groupId === gid);
    members.forEach((c, i) => {
      c.groupId = null;
      if (group) {
        c.x = group.x + (i % 3) * (CARD_W + 16);
        c.y = group.y + Math.floor(i / 3) * (CARD_H + 16);
      }
    });
    state.groups = state.groups.filter((g) => g.id !== gid);
    if (!silent) toast("已解散分组");
    render();
  }

  function openOverlay(card) {
    overlayCode.textContent = card.id;
    overlayImg.src = card.img;
    overlayImg.alt = card.title;
    overlayFields.innerHTML = [
      ["标题", card.title],
      ["作者", card.author],
      ["年代", card.year],
      ["描述", card.desc],
      ["意义", card.meaning]
    ].map(([k, v]) => `<div class="field"><div class="k">${k}</div><div class="v">${escapeHtml(v)}</div></div>`).join("");
    overlay.classList.add("show");
    document.body.classList.add("modal-open");
  }

  function closeOverlay() {
    overlay.classList.remove("show");
    document.body.classList.remove("modal-open");
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  document.getElementById("closeOverlay").addEventListener("click", closeOverlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlay();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOverlay();
  });

  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-filter]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.filter = btn.dataset.filter;
      render();
    });
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    state.groups = [];
    state.cards.forEach((c) => { c.groupId = null; c.flipped = false; });
    const startX = 16, startY = 12;
    state.cards.forEach((c, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      c.x = startX + col * (CARD_W + GAP_X);
      c.y = startY + row * (CARD_H + GAP_Y);
    });
    state.filter = "ALL";
    document.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("active", b.dataset.filter === "ALL"));
    render();
  });

  layoutInitial();
  render();
})();
