/* Админка оператора: #/admin (очередь) и #/admin/order/<id> (карточка).
   На клиентском сайте ссылок сюда нет. В настоящей версии нужен вход по паролю (см. README и ADMIN.md).
   Данные: data/admin_demo.js (демо-заказы), window.STORE (заказы из формы и действия оператора),
   data/admin_media.js (кадры и рамки детектора, грузится только здесь). */
(() => {
  const B = window.BRAND, O = window.ORDER, DEMO = window.ADMIN_DEMO, S = window.STORE, KITS = window.KITS, PRICES = window.PRICES, OFFER = window.OFFER;
  const tgName = (o) => o.client.tg ? "@" + o.client.tg : "без ника, ответить в чате";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
  const kitBy = (key) => KITS.find((k) => k.key === key) || KITS[0];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LOAD = Date.now();
  const REAL_ID = O.youtube;

  const TABS = [["help", "Нужна помощь"], ["ai", "ИИ работает"], ["ready", "Готово к отправке"], ["sent", "Отправлено"], ["refused", "Отказ"], ["all", "Все"]];
  const ST_NAME = { help: "Нужна помощь", ai: "ИИ работает", ready: "Готово", sent: "Отправлено", refused: "Отказ" };
  let root = null, ctx = { tab: "help", sel: 0, q: "" }, cleanup = [];

  /* ---------- реальная игра: смены и сомнения из out/shl_p2/player.json ---------- */
  const REAL_DOUBT = { 6: "виден 8 с из 65, собрана по звену", 7: "виден 31 с из 146, возможно, две смены", 10: "виден 4 с из 9, сразу после смены 9", 11: "виден 9 с из 56, собрана по звену" };
  const clockSec = (c) => { const [m, s] = c.split(":").map(Number); return m * 60 + s; };
  function realShifts() {
    return O.shifts.map((s) => ({ n: s.n, a: 1 - clockSec(s.c0) / 1200, b: 1 - clockSec(s.c1) / 1200, sec: s.sec, c0: s.c0, c1: s.c1,
      st: REAL_DOUBT[s.n] ? "doubt" : "ok", note: REAL_DOUBT[s.n] || "", conf: REAL_DOUBT[s.n] ? [0.42, 0.55, 0.31, 0.38][[6, 7, 10, 11].indexOf(s.n)] : 0.93 }));
  }
  /* синтетические смены для демо-заказов: детерминированно от номера заказа */
  function fakeShifts(o) {
    let seed = o.id * 9301 + 49297; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const per = /вся/i.test(o.period) ? 3 : 1, n = o.shiftsN || 10 * per, cut = o.cutAt ? 1 - clockSec(o.cutAt) / 1200 : 1;
    const out = []; let x = 0.02 + rnd() * 0.04;
    const span = cut, step = span / n;
    for (let i = 0; i < n; i++) {
      const len = Math.min(step * (0.45 + rnd() * 0.25), span - x);
      if (len <= 0.004) break;
      const sec = Math.round(len * 1200 * per);
      out.push({ n: i + 1, a: x, b: x + len, sec, st: "ok", conf: 0.9 + rnd() * 0.08, note: "" });
      x += step;
    }
    const dn = Math.min(o.doubtN ?? 0, out.length);
    const idx = new Set(); while (idx.size < dn) idx.add(Math.floor(rnd() * out.length));
    idx.forEach((i) => { out[i].st = "doubt"; out[i].conf = 0.3 + rnd() * 0.3; out[i].note = o.reason?.includes("Цвет") ? "форма другого цвета" : o.reason?.includes("тоже") ? "рядом двойник с тем же номером" : "номер не читается"; });
    return out;
  }

  /* ---------- сборка заказов: демо + заказы из формы + действия оператора ---------- */
  function fromStore(raw) {
    /* заказ из облака может прийти неполным: подставляем пустые значения, чтобы очередь не падала */
    const o = { url: "", number: "", kit: "blue", team: "", howto: "", period: "", tg: "", created: Date.now(), ...raw };
    const ph = S.phase(o), real = o.real === "game";
    const base = {
      id: o.id, fresh: true, client: { name: "Новый клиент", tg: o.tg }, url: String(o.url).replace(/^https?:\/\/(www\.)?/, ""),
      number: o.number, kit: o.kit, team: o.team, howto: o.howto, period: o.period, who: o.who,
      league: real ? "СХЛ" : "", home: real ? "РМАТ" : o.team, away: real ? "КГУ" : "соперник", date: real ? "27.01" : "сегодня",
      created: o.created, due: dueAt(o.created), opSec: o.opSec || 0, real: real ? "game" : "",
      status: ph === "new" ? "ai" : ph, aiStep: ph === "new" ? "Скачиваю трансляцию" : "Ищу №" + o.number, aiPct: ph === "new" ? 6 : 54,
      conf: ph === "help" ? (real ? 0.64 : 0.33) : 0,
      log: [[o.created, "client", "Заказ принят"], ...(ph !== "new" ? [[o.created + 3000, "ai", "Скачал трансляцию"]] : []), ...(ph === "help" || ph === "sent" ? [[o.created + 10000, "ai", real ? "Нашёл 11 смен, уверен в 7. Позвал оператора" : "Номер не читается уверенно. Позвал оператора"]] : [])],
    };
    if (real) Object.assign(base, { todo: DEMO.orders.find((x) => x.real === "game").todo, reason: "№19 почти не виден в сменах 6, 7 и 11", reasons: DEMO.orders.find((x) => x.real === "game").reasons, doubt: [6, 7, 10, 11] });
    else Object.assign(base, { todo: "Кадров в демо нет. В настоящем заказе: посмотри смены, подтверди (Y) или отклони (N).", reason: "Номер не читается уверенно", reasons: ["Это демо-заказ без кадров: ИИ здесь не запускался"], shiftsN: 10, doubtN: 4 });
    return base;
  }
  function dueAt(created) { const d = new Date(created); d.setDate(d.getDate() + 1); d.setHours(20, 0, 0, 0); return +d; }
  function allOrders() {
    const demo = DEMO.orders.map((o) => ({ ...o, created: LOAD - o.createdMin * 60000, due: LOAD + o.dueMin * 60000, log: o.log.map(([m, a, t]) => [LOAD - m * 60000, a, t]) }));
    const list = [...S.all().map(fromStore), ...demo];
    return list.map((o) => {
      const ov = S.over(o.id);
      const m = { ...o, ...ov, log: [...o.log, ...(ov.log || [])] };
      m.shifts = m.real ? realShifts() : fakeShifts(m);
      (ov.dec ? Object.entries(ov.dec) : []).forEach(([n, d]) => { const s = m.shifts.find((x) => x.n === +n); if (s) s.st = d; });
      (ov.added || []).forEach((p, i) => m.shifts.push({ n: 100 + i, a: p[0], b: p[1], sec: Math.round((p[1] - p[0]) * 1200), st: "added", conf: 1, note: "добавлена оператором" }));
      m.shifts.sort((a, b) => a.a - b.a);
      return m;
    });
  }
  const byId = (id) => allOrders().find((o) => String(o.id) === String(id));

  function totals(o) {
    const inc = o.shifts.filter((s) => s.st === "ok" || s.st === "yes" || s.st === "added");
    const toi = inc.reduce((a, s) => a + s.sec, 0);
    let plus = 0, minus = 0;
    if (o.real) {
      const ns = new Set(inc.map((s) => s.n));
      O.goals.filter((g) => g.onIce && (g.shift == null || ns.has(g.shift))).forEach((g) => (g.mine ? plus++ : minus++));
    }
    return { n: inc.length, toi, avg: inc.length ? Math.round(toi / inc.length) : 0, plus, minus, all: o.shifts.length };
  }

  /* ---------- общие кусочки ---------- */
  const confBar = (c) => `<span class="cf ${c >= 0.9 ? "hi" : c >= 0.6 ? "mid" : c > 0 ? "lo" : "none"}"><i style="--w:${Math.round(c * 100)}%"></i><b>${c ? Math.round(c * 100) + "%" : "…"}</b></span>`;
  const kitDot = (k) => `<i class="a-kit" style="--c:${kitBy(k).hex}" title="Форма: ${kitBy(k).title.toLowerCase()}"></i>`;
  function dueCell(o) {
    if (o.status === "sent") return `<span class="due done">отправлен</span>`;
    if (o.status === "refused") return `<span class="due done">без оплаты</span>`;
    const min = Math.round((o.due - Date.now()) / 60000);
    if (min < 0) return `<span class="due late">просрочен</span>`;
    const h = Math.floor(min / 60), m = min % 60;
    return `<span class="due${min < 120 ? " late" : ""}">${h ? `${h} ч ` : ""}${m} мин</span>`;
  }
  function ago(ts) {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return "только что"; if (m < 60) return `${m} мин назад`;
    const h = Math.round(m / 60); if (h < 24) return `${h} ч назад`; return `${Math.round(h / 24)} дн назад`;
  }
  const isDemo = (o) => o.demo || o.fresh;
  const icon = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7"/></svg>',
    yes: '<svg viewBox="0 0 24 24"><path d="M4.5 12.5 9.5 17.5 19.5 6.5"/></svg>',
    no: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    tg: '<svg viewBox="0 0 24 24"><path d="M20.5 4.5 3.5 11l5.2 1.9M20.5 4.5 17 19l-8.3-6.1M20.5 4.5 8.7 12.9m0 0V18l3-2.9"/></svg>',
    pick: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7.5" r="3"/><ellipse cx="12" cy="18" rx="7.5" ry="2.8"/></svg>',
    add: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    redo: '<svg viewBox="0 0 24 24"><path d="M19 8a8 8 0 1 0 1 6M19 3v5h-5"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/></svg>',
  };
  const kbd = (k) => `<kbd>${k}</kbd>`;
  function chrome(inner, crumb) {
    return `<div class="adm">
      <header class="adm-top">
        <a class="adm-logo" href="#/admin"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="11" r="6.5"/><ellipse cx="20" cy="28" rx="16" ry="6.5"/></svg><b>${esc(B.name)}</b><span>оператор</span></a>
        ${crumb || ""}
        <span class="adm-demo">демо-данные</span>
        <label class="adm-search">${icon.search}<input id="a-q" placeholder="Заказ, клиент, лига" value="${esc(ctx.q)}" autocomplete="off">${kbd("/")}</label>
        <button class="adm-bell${soundOn() ? " on" : ""}" id="a-bell" aria-pressed="${soundOn()}" title="Звук при новом заказе в «Нужна помощь»"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/></svg><span>${soundOn() ? "звук вкл" : "звук выкл"}</span></button>
        ${window.GPU?.ready() ? `<button class="adm-bell${window.GPU.key() ? " on" : ""}" id="a-gpu" title="Ключ видеокарты на этом устройстве (assets/gpu.js)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/></svg><span>${window.GPU.key() ? "видеокарта: ключ есть" : "видеокарта: ввести ключ"}</span></button>` : ""}
        <button class="adm-help-btn" id="a-help" title="Клавиши">${kbd("?")}</button>
      </header>
      <h1 class="vh">${crumb ? "Заказ оператора" : "Очередь заказов оператора"}</h1>
      ${inner}
      <div class="adm-help" id="a-helpbox" hidden><div class="adm-help-card"><h3>Клавиши</h3>
        <div class="adm-help-cols"><dl><dt>${kbd("J")} ${kbd("K")}</dt><dd>вниз и вверх по списку</dd><dt>${kbd("Enter")}</dt><dd>открыть заказ</dd><dt>${kbd("/")}</dt><dd>поиск</dd><dt>${kbd("1")}…${kbd("6")}</dt><dd>вкладки</dd></dl>
        <dl><dt>${kbd("Y")} ${kbd("N")}</dt><dd>это он / не он, дальше сама</dd><dt>${kbd("V")}</dt><dd>«Вот он»: клик по игроку</dd><dt>${kbd("A")}</dt><dd>добавить пропущенную смену</dd><dt>${kbd("R")}</dt><dd>пересчитать</dd><dt>${kbd("S")}</dt><dd>отправить клиенту</dd><dt>${kbd("⇧Y")}</dt><dd>«да» для всех оставшихся смен</dd><dt>${kbd("Z")}</dt><dd>отменить последнее решение или отправку</dd><dt>${kbd("M")}</dt><dd>к моменту, где ИИ отметил игрока</dd><dt>${kbd(",")} ${kbd(".")}</dt><dd>кадр назад и вперёд</dd><dt>${kbd("J")} ${kbd("K")}</dt><dd>следующая и прошлая сомнительная смена</dd><dt>${kbd("←")} ${kbd("→")}</dt><dd>2 с, с Shift 10 с</dd><dt>${kbd("[")} ${kbd("]")}</dt><dd>скорость 1×, 1,5×, 2×</dd><dt>${kbd("⇧X")}</dt><dd>отказ</dd><dt>${kbd("Space")}</dt><dd>пауза</dd><dt>${kbd("Esc")}</dt><dd>назад</dd></dl></div>
        <p>Закрыть: ${kbd("?")} или ${kbd("Esc")}</p></div></div>
      <div class="adm-toast" id="a-toast" role="status" aria-live="polite"></div>
    </div>`;
  }
  const SOUND = "scout.admin.sound";
  const soundOn = () => { try { return localStorage.getItem(SOUND) === "1"; } catch { return false; } };
  function beep() {
    try { const ac = new (window.AudioContext || window.webkitAudioContext)(); [880, 1175].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, ac.currentTime + i * 0.16); g.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + i * 0.16 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + i * 0.16 + 0.22); o.start(ac.currentTime + i * 0.16); o.stop(ac.currentTime + i * 0.16 + 0.25); }); } catch { /* звук недоступен */ }
  }
  let seenHelp = null, freshHelp = new Set();
  function watchHelp() {
    const ids = allOrders().filter((o) => o.status === "help").map((o) => o.id);
    if (seenHelp) { const add = ids.filter((id) => !seenHelp.has(id)); if (add.length) { add.forEach((id) => freshHelp.add(id)); if (soundOn()) beep(); setTimeout(() => { add.forEach((id) => freshHelp.delete(id)); }, 12000); } }
    seenHelp = new Set(ids);
  }
  function toast(t) { const el = $("#a-toast"); if (!el) return; el.textContent = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2200); }
  function log(id, actor, text) { const ov = S.over(id); S.patch(id, { log: [...(ov.log || []), [Date.now(), actor, text]] }); }

  /* ================= ОЧЕРЕДЬ ================= */
  function listView() {
    const all = allOrders();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const done = all.filter((o) => o.status === "sent" || o.status === "ready" || o.status === "refused");
    const auto = done.filter((o) => !o.opSec && o.opSec !== null);
    const autoPct = done.length ? Math.round(auto.length / done.length * 100) : 0;
    const helped = all.filter((o) => o.opSec > 0);
    const avg = helped.length ? helped.reduce((a, o) => a + o.opSec, 0) / helped.length : 0;
    const counts = Object.fromEntries(TABS.map(([k]) => [k, k === "all" ? all.length : all.filter((o) => o.status === k).length]));
    const q = ctx.q.trim().toLowerCase();
    let rows = all.filter((o) => ctx.tab === "all" || o.status === ctx.tab)
      .filter((o) => !q || [o.id, o.client.tg, o.client.name, o.league, o.home, o.away].join(" ").toLowerCase().includes(q.replace(/^#|^@/, "")));
    rows = ctx.tab === "help" ? rows.sort((a, b) => a.due - b.due) : rows.sort((a, b) => b.created - a.created);
    ctx.sel = Math.min(ctx.sel, Math.max(0, rows.length - 1));
    ctx.rows = rows.map((o) => o.id);
    const stat = (v, l, extra = "") => `<div class="a-stat${extra}"><span class="v">${v}</span><span class="l">${l}</span></div>`;
    const body = rows.length ? rows.map((o, i) => {
      const t = totals(o);
      return `<a class="a-row${i === ctx.sel ? " sel" : ""}${o.fresh ? " fresh" : ""}${freshHelp.has(o.id) ? " new" : ""}" href="#/admin/order/${o.id}" data-i="${i}">
        <span class="c-id">#${o.id}</span>
        <span class="c-client"><b>${esc(tgName(o))}</b><small>${esc(o.client.name)}${isDemo(o) ? " · демо" : ""}</small></span>
        <span class="c-match"><b>${esc(o.home)} – ${esc(o.away)}</b><small>${[o.league, o.date, o.period].filter(Boolean).map(esc).join(", ")}</small></span>
        <span class="c-num">${kitDot(o.kit)}<b>${o.number}</b></span>
        <span class="c-st">${ctx.tab === "help" ? "" : `<span class="pill ${o.status}">${ST_NAME[o.status]}</span>`}${o.status === "help" ? `<small class="why">${esc(o.reason)}</small>` : o.status === "ai" ? `<small>${esc(o.aiStep || "")}, ${o.aiPct || 0}%</small>` : ""}</span>
        <span class="c-conf">${confBar(o.conf || 0)}</span>
        <span class="c-sh">${o.status === "ai" ? "…" : o.status === "help" ? `<b>${t.n} из ${t.all}</b>${o.shifts.filter((x) => x.st === "doubt").length ? `<em>решить ${o.shifts.filter((x) => x.st === "doubt").length}</em>` : `<em>сомнений нет</em>`}` : o.status === "refused" ? "<b>0</b>" : `<b>${o.real ? t.n : o.shiftsN || t.n}</b>`}</span>
        <span class="c-due">${dueCell(o)}</span>
      </a>`;
    }).join("") : `<div class="a-empty"><b>${ctx.tab === "help" ? "Помощь никому не нужна" : "Здесь пусто"}</b><span>${ctx.tab === "help" ? "ИИ справляется сам. Можно отдохнуть." : "Попробуй другую вкладку или очисти поиск."}</span></div>`;
    return chrome(`<div class="adm-main">
      ${freshHelp.size ? `<div class="a-alert" role="status">Новый заказ ждёт помощи: ${[...freshHelp].map((id) => `<a href="#/admin/order/${id}">#${id}</a>`).join(", ")}</div>` : ""}
      <section class="a-stats">
        ${((n) => stat(n, `${n % 10 === 1 && n % 100 !== 11 ? "заказ" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "заказа" : "заказов"} сегодня`))(all.filter((o) => o.created >= +today).length)}
        ${stat(counts.help, "ждут меня", counts.help ? " warn" : "")}
        ${stat(avg ? mmss(avg) : "—", `моё время на заказ, цель ${DEMO.goalMinutes}:00`)}
        <div class="a-stat goal"><span class="v">${autoPct}%</span><span class="l">заказов без моего участия, цель ${DEMO.goalAuto}%</span><span class="a-goal"><i style="--w:${autoPct}%"></i><em style="--g:${DEMO.goalAuto}%"></em></span></div>
      </section>
      <nav class="a-tabs" role="tablist">${TABS.map(([k, t], i) => `<button role="tab" data-tab="${k}" aria-selected="${ctx.tab === k}">${t}<span>${counts[k]}</span>${kbd(i + 1)}</button>`).join("")}</nav>
      <div class="a-table">
        <div class="a-head"><span>№</span><span>Клиент</span><span>Матч</span><span>Игрок</span><span>Статус</span><span>Уверенность ИИ</span><span>Смен</span><span>До срока</span></div>
        ${body}
      </div>
      <p class="a-foot">${kbd("J")} ${kbd("K")} выбрать, ${kbd("Enter")} открыть, ${kbd("?")} все клавиши. Все заказы, кроме #1001 и игры в #1047, демо.</p>
    </div>`);
  }

  function bindList() {
    $$(".a-tabs [data-tab]", root).forEach((b) => b.addEventListener("click", () => { ctx.tab = b.dataset.tab; ctx.sel = 0; render(); }));
    const q = $("#a-q"); q.addEventListener("input", () => { ctx.q = q.value; const pos = q.selectionStart; render(); const nq = $("#a-q"); nq.focus(); nq.setSelectionRange(pos, pos); });
  }
  function moveSel(d) {
    if (!ctx.rows?.length) return;
    ctx.sel = Math.max(0, Math.min(ctx.rows.length - 1, ctx.sel + d));
    $$(".a-row", root).forEach((r) => r.classList.toggle("sel", +r.dataset.i === ctx.sel));
    $(".a-row.sel", root)?.scrollIntoView({ block: "nearest" });
  }

  /* ================= КАРТОЧКА ЗАКАЗА ================= */
  let card = null;   // состояние открытой карточки
  let lastSent = null;   // последний отправленный заказ: 20 секунд его можно вернуть клавишей Z
  function undoSend() {
    if (!lastSent || Date.now() - lastSent.at > 20000) return false;
    const id = lastSent.id; lastSent = null;
    S.patch(id, { status: "help" }); log(id, "op", "Вернул заказ из отправленных");
    toast(`#${id} снова в «Нужна помощь». Если сообщение ушло в Telegram, удали его там`);
    if (parts[0] !== "order") render();
    return true;
  }
  function cardView(id) {
    const o = byId(id);
    if (!o) return chrome(`<div class="adm-main"><div class="a-empty"><b>Заказ #${esc(id)} не найден</b><a href="#/admin">К очереди</a></div></div>`);
    const media = o.real && window.ADMIN_MEDIA;
    const doubts = o.shifts.filter((s) => ["doubt", "yes", "no"].includes(s.st) && s.n < 100);
    card = card && card.id === o.id ? card : { id: o.id, start: Date.now(), base: o.opSec || 0, cur: (doubts.find((s) => s.st === "doubt") || doubts[0] || o.shifts[0])?.n, pick: false, add: null, follow: {} };
    const t = totals(o), kit = kitBy(o.kit);
    const reasons = (o.reasons || []).map((r) => `<li>${esc(r)}</li>`).join("");
    const crumb = `<a class="adm-back" href="#/admin" title="К очереди (Esc)">${icon.back}<span>Очередь</span></a><span class="adm-crumb">#${o.id}</span><span class="pill ${o.status}">${ST_NAME[o.status]}</span>`;
    const queue = doubts.map((s) => `<button class="dq ${s.st}${s.n === card.cur ? " cur" : ""}" data-shift="${s.n}"><b>Смена ${s.n}</b><span>${s.c0 ? `${s.c0}–${s.c1}, ` : ""}${s.sec} с</span><small>${esc(s.note)}</small><i>${s.st === "yes" ? "он" : s.st === "no" ? "не он" : "?"}</i></button>`).join("");
    const left = `<aside class="ac-left" aria-label="Заказ клиента и причина">
      <section class="ac-box"><h3>Прислал клиент</h3>
        <dl class="ac-dl">
          <dt>Трансляция</dt><dd><a href="https://${esc(o.url)}" target="_blank" rel="noopener">${esc(o.url)}</a></dd>
          <dt>Игрок</dt><dd class="ac-player"><i class="a-kit big" style="--c:${kit.hex}"></i><b>№${o.number}</b><span>${esc(kit.title.toLowerCase())} форма, ${esc(o.team)}</span></dd>
          <dt>Как узнать</dt><dd>${o.howto ? `«${esc(o.howto)}»` : `<span class="muted">не написал</span>`}</dd>
          <dt>Матч</dt><dd>${esc(o.home)} – ${esc(o.away)}, ${esc(o.date)}, ${esc(o.period)}</dd>
          <dt>Telegram</dt><dd>${esc(tgName(o))}${isDemo(o) ? ` <span class="muted">(демо)</span>` : ""}</dd>
          <dt>Заказ</dt><dd>${ago(o.created)}, срок ${dueCell(o)}</dd>
        </dl></section>
      ${S.get(o.id) && window.GPU?.ready() ? `<section class="ac-box ac-gpu" id="ac-gpu"></section>` : ""}
      ${o.reason ? `<section class="ac-reason ${o.status}"><span class="ac-why">${o.status === "refused" ? "Отказ" : "Почему позвали меня"}</span><h2>${esc(o.reason)}</h2>${o.todo && o.status === "help" ? `<p class="ac-todo"><b>Что делать.</b> ${esc(o.todo)}</p>` : ""}${reasons ? `<ul>${reasons}</ul>` : ""}</section>` : `<section class="ac-reason ok"><span class="ac-why">ИИ уверен</span><h2>${o.status === "ai" ? `ИИ ещё работает: ${esc(o.aiStep || "")}, ${o.aiPct || 0}%` : "Все смены найдены уверенно, помощь не нужна"}</h2></section>`}
    </aside>`;
    const center = `<section class="ac-center" aria-label="Видео и смены">
      <div class="ac-player-box${media ? "" : " empty"}" id="ac-player">
        ${media ? `<video id="ac-video" muted playsinline preload="auto"></video><svg class="ac-ov" id="ac-ov" viewBox="0 0 1000 562.5" preserveAspectRatio="none"></svg><div class="ac-pickhint" id="ac-pickhint">Кликни по игроку №${o.number}. ИИ поведёт его дальше сам</div><div class="ac-follow" id="ac-follow"><i></i><span>ИИ ведёт игрока по записи</span></div><div class="ac-nomark" id="ac-nomark" hidden>ИИ не видит №${o.number} в этом кадре. ${kbd("M")} к отметке</div>`
          : `<div class="ac-noframe"><svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="14" width="52" height="36" rx="6"/><circle cx="32" cy="27" r="5"/><ellipse cx="32" cy="41" rx="11" ry="3.5"/></svg><b>Кадров нет</b><span>Это демо-заказ без видео. Кадры в админке есть только у игр автора проекта (#1047 и заказы по примеру из формы).</span></div>`}
        <div class="ac-cap" id="ac-cap"></div>
      </div>
      <div class="ac-tl" id="ac-tl"></div>
      <div class="ac-legend"><span class="ok"><i></i>уверен</span><span class="doubt"><i></i>сомнение</span><span class="yes"><i></i>подтвердил</span><span class="no"><i></i>не он</span><span class="added"><i></i>добавил</span>${o.cutAt ? `<span class="cut"><i></i>нет записи</span>` : ""}</div>
      <div class="ac-decide" id="ac-decide"></div>
      <div class="ac-tools">
        <button class="atool" data-act="pick" ${media ? "" : "disabled title='Нет кадров в демо'"}>${icon.pick}<span>Вот он</span>${kbd("V")}</button>
        <button class="atool" data-act="add">${icon.add}<span>Добавить смену</span>${kbd("A")}</button>
        <button class="atool" data-act="recalc">${icon.redo}<span>Пересчитать</span>${kbd("R")}</button>
        <button class="atool danger" data-act="refuse">${icon.stop}<span>Отказ</span>${kbd("⇧X")}</button>
        <span class="sp"></span>
        <button class="atool send" data-act="send" ${o.status === "sent" ? "disabled" : ""}>${icon.tg}<span>${o.status === "sent" ? "Уже отправлено" : "Отправить клиенту"}</span>${kbd("S")}</button>
      </div>
      ${doubts.length ? `<div class="dqs" id="ac-dq">${queue}</div>` : ""}
    </section>`;
    const logs = [...o.log].sort((a, b) => b[0] - a[0]).map(([ts, a, txt]) => `<li class="${a}"><i>${a === "ai" ? "ИИ" : a === "op" ? "Я" : "К"}</i><div><span>${esc(txt)}</span><small>${ago(ts)}</small></div></li>`).join("");
    const right = `<aside class="ac-right" aria-label="Что увидит клиент и журнал">
      <section class="ac-box ac-prev"><h3>Клиент увидит</h3>
        <div class="ac-prev-nums" id="ac-nums">${prevNums(t, o)}</div>
        <div class="ac-reel">${o.real ? `<img src="${O.media.reelPoster}" alt="Кадр ролика"><span id="ac-reel-badge">ролик 9:16</span>` : `<div class="ac-reel-ph"><i class="a-kit big" style="--c:${kit.hex}"></i><b>№${o.number}</b><span>ролик соберётся после отправки</span></div>`}</div>
        ${o.real ? `<a class="ac-open" href="#/result" target="_blank" rel="noopener">Открыть страницу клиента</a>` : ""}
      </section>
      <section class="ac-box ac-log"><h3>Журнал</h3><ul id="ac-log">${logs}</ul></section>
    </aside>`;
    return chrome(`<div class="adm-card">
      <div class="ac-bar"><span class="ac-timer" id="ac-timer" title="Моё время на этот заказ. Цель ${DEMO.goalMinutes}:00">0:00</span></div>
      ${left}${center}${right}</div>`, crumb);
  }
  function prevNums(t, o) {
    return `<div><span class="num">${t.n}</span><small>смен из ${t.all}</small></div><div><span class="num">${mmss(t.toi)}</span><small>на льду</small></div><div><span class="num">${t.avg}<em>с</em></span><small>средняя</small></div>${o.real ? `<div><span class="num"><b class="p">+${t.plus}</b> <b class="m">−${t.minus}</b></span><small>при голах</small></div>` : ""}`;
  }

  /* таймлайн периода в карточке */
  function drawTl(o) {
    const el = $("#ac-tl"); if (!el) return;
    const bars = o.shifts.map((s, i) => `<button class="atb ${s.st}${s.n === card.cur ? " cur" : ""}" data-shift="${s.n}" style="left:${(s.a * 100).toFixed(2)}%;width:${Math.max(0.5, (s.b - s.a) * 100).toFixed(2)}%;--i:${i}" title="Смена ${s.n < 100 ? s.n : "добавлена"}, ${s.sec} с, уверенность ${Math.round(s.conf * 100)}%"></button>`).join("");
    const cut = o.cutAt ? `<div class="atl-cut" style="left:${((1 - clockSec(o.cutAt) / 1200) * 100).toFixed(2)}%"><span>обрыв ${o.cutAt}</span></div>` : "";
    const per = /вся/i.test(o.period) ? "3 периода" : o.period;
    el.innerHTML = `<div class="atl-head"><span>${per}</span><span>${card.add ? `<b class="atl-adding">${card.add.a == null ? "Кликни начало смены" : "Теперь конец смены"}</b>` : "нажми на смену, чтобы открыть"}</span></div>
      <div class="atl${card.add ? " adding" : ""}" id="atl">${bars}${cut}${card.add?.a != null ? `<i class="atl-mark" style="left:${(card.add.a * 100).toFixed(2)}%"></i>` : ""}<i class="atl-head-line" id="atl-play"></i></div>
      <div class="atl-ruler"><span>начало</span><span>${/вся/i.test(o.period) ? "2-й" : "10:00"}</span><span>конец</span></div>`;
  }
  function updSend(o) {
    const b = $(".atool.send", root); if (!b || o.status === "sent") return;
    const left = o.shifts.filter((x) => x.st === "doubt").length;
    b.classList.toggle("wait", left > 0);
    b.querySelector("span").textContent = left ? `Отправить · осталось ${left}` : "Отправить клиенту";
  }
  function drawDecide(o) {
    updSend(o);
    const el = $("#ac-decide"); if (!el) return;
    const s = o.shifts.find((x) => x.n === card.cur);
    const left = o.shifts.filter((x) => x.st === "doubt").length;
    if (!s || !["doubt", "yes", "no"].includes(s.st)) {
      const had = o.shifts.some((x) => ["yes", "no"].includes(x.st));
      el.innerHTML = left || ["sent", "refused", "ai"].includes(o.status) ? "" : `<div class="ac-alldone">${icon.yes}<span>${had ? "Все сомнительные смены разобраны, цифры пересчитаны." : "Сомнительных смен нет. Прочитай причину слева и отправляй."}</span><button class="ayes" data-act="send">${icon.tg}<span>Отправить клиенту</span>${kbd("S")}</button></div>`;
      return;
    }
    el.innerHTML = `<div class="ac-q"><div><b>Смена ${s.n}${s.c0 ? `, ${s.c0}–${s.c1}` : ""}: это №${o.number}?</b><span>${esc(s.note)}. Уверенность ИИ ${Math.round(s.conf * 100)}%. Осталось ${left}.</span><em class="ac-look">Ищи: ${esc(kitBy(o.kit).title.toLowerCase())} форма${o.howto ? ", " + esc(o.howto.toLowerCase()) : ""}.<span class="keys"> Он: ${kbd("Y")}. Не он: ${kbd("N")}.</span></em>${left > 1 ? `<button class="ayes-all" data-act="yesall">Да для всех ${left}${kbd("⇧Y")}</button>` : ""}</div>
      <button class="ayes${s.st === "yes" ? " on" : ""}" data-act="yes">${icon.yes}<span>Да, это он</span>${kbd("Y")}</button>
      <button class="ano${s.st === "no" ? " on" : ""}" data-act="no">${icon.no}<span>Нет</span>${kbd("N")}</button></div>`;
  }

  /* плеер с рамками детектора и эллипсом кандидата */
  let raf = 0;
  function loadShift(o, n, autoplay = true) {
    card.cur = n;
    const v = $("#ac-video"), M = window.ADMIN_MEDIA, cap = $("#ac-cap");
    const s = o.shifts.find((x) => x.n === n);
    if (cap && s) cap.innerHTML = `<b>Смена ${s.n < 100 ? s.n : "добавлена"}</b><span>${s.c0 ? `${s.c0}–${s.c1} по табло, ` : ""}${s.sec} с${s.n < 100 && o.real && !M?.shifts?.[n] ? ", видео смены с обводкой ИИ" : ""}</span><em>№${o.number} ${esc(kitBy(o.kit).title.toLowerCase())}${o.howto ? ` · ${esc(o.howto)}` : ""}</em>`;
    if (!v || !M) return;
    const sh = M.shifts[n];
    if (sh) { if (v.dataset.src !== sh.src) { v.src = sh.src; v.dataset.src = sh.src; v.poster = sh.poster; } v.dataset.mode = "ov"; }
    else if (n < 100) { const src = O.media.shift(n); if (v.dataset.src !== src) { v.src = src; v.dataset.src = src; v.poster = O.media.frame(n); } v.dataset.mode = "clip"; }
    const t0 = sh ? markTime(n) : null;   // открываем смену сразу на моменте, где ИИ видит игрока
    const seek = () => { v.currentTime = t0 || 0; };
    if (v.readyState >= 1) seek(); else v.addEventListener("loadedmetadata", seek, { once: true });
    if (autoplay) v.play().catch(() => {});
    $("#ac-ov").innerHTML = "";
  }
  const iou = (b, m) => { const x1 = Math.max(b[1], m[0]), y1 = Math.max(b[2], m[1]), x2 = Math.min(b[1] + b[3], m[0] + m[2]), y2 = Math.min(b[2] + b[4], m[1] + m[3]);
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1), u = b[3] * b[4] + m[2] * m[3] - inter; return u ? inter / u : 0; };
  function overlayLoop(o) {
    cancelAnimationFrame(raf);
    const v = $("#ac-video"), ov = $("#ac-ov"), chip = $("#ac-nomark"); if (!v || !ov) return;
    const step = () => {
      raf = requestAnimationFrame(step);
      const M = window.ADMIN_MEDIA, sh = M?.shifts?.[card.cur];
      const ph = $("#atl-play"), s = o.shifts.find((x) => x.n === card.cur);
      if (ph && s && v.duration) { ph.style.left = `${((s.a + (s.b - s.a) * Math.min(1, v.currentTime / v.duration)) * 100).toFixed(2)}%`; ph.style.opacity = 1; }
      if (!sh || v.dataset.mode !== "ov") { ov.innerHTML = ""; if (chip) chip.hidden = true; return; }
      const f = v.currentTime * M.rate, i = Math.min(sh.s.length - 1, Math.floor(f)), k = f - i;
      const A = sh.s[i] || [], Bn = sh.s[i + 1] || [];
      const nb = new Map(Bn.map((b) => [b[0], b]));
      /* Кого подписывать. Если оператор показал игрока («Вот он»), ведём его трек.
         Иначе берём рамку, которая лучше всех совпала с отметкой ИИ в этом кадре. Нет отметки: подписи нет. */
      const follow = card.follow[card.cur] ?? null, mk = sh.m[i] || null;
      let target = follow;
      if (target == null && mk) { let best = 0.2; for (const b of A) { const q = iou(b, mk); if (q > best) { best = q; target = b[0]; } } }
      const sure = follow != null || s?.st === "yes";
      const tag = sure ? `№${o.number}` : `ИИ: №${o.number}?`, tw = sure ? 68 : 118;
      let html = "", drawn = false;
      for (const b of A) {
        const c = nb.get(b[0]); const lerp = (j) => c ? b[j] + (c[j] - b[j]) * k : b[j];
        const x = lerp(1), y = lerp(2) * 0.5625, w = lerp(3), h = lerp(4) * 0.5625, isT = target != null && b[0] === target;
        html += `<rect class="bx${isT ? " cand" : ""}${card.pick ? " pickable" : ""}" data-tid="${b[0]}" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`;
        if (isT) {
          const cx = x + w / 2, cy = y + h; drawn = true;
          html += `<ellipse class="el${sure ? " sure" : ""}" cx="${cx}" cy="${cy}" rx="${Math.max(w * 0.75, 16)}" ry="${Math.max(h * 0.1, 6)}"/>`;
          html += `<g class="lb${sure ? " sure" : ""}" transform="translate(${cx} ${Math.max(28, y - 14)})"><rect x="${-tw / 2}" y="-26" width="${tw}" height="28" rx="7"/><text x="0" y="-6">${tag}</text></g>`;
        }
      }
      if (!drawn && mk && follow == null) {   // отметка есть, а рамки детектора под ней нет: рисуем по самой отметке
        const cx = mk[0] + mk[2] / 2, cy = (mk[1] + mk[3]) * 0.5625; drawn = true;
        html += `<ellipse class="el" cx="${cx}" cy="${cy}" rx="${Math.max(mk[2] * 0.75, 16)}" ry="8"/><g class="lb" transform="translate(${cx} ${Math.max(28, mk[1] * 0.5625 - 14)})"><rect x="${-tw / 2}" y="-26" width="${tw}" height="28" rx="7"/><text x="0" y="-6">${tag}</text></g>`;
      }
      ov.innerHTML = html;
      if (chip) chip.hidden = drawn || card.pick;
    };
    step();
  }
  /* к ближайшему моменту, где ИИ отметил игрока: не надо мотать видео вручную */
  function markTime(n, after = -1) {
    const M = window.ADMIN_MEDIA, sh = M?.shifts?.[n]; if (!sh) return null;
    const from = Math.max(0, Math.ceil((after + 0.4) * M.rate));
    for (let i = from; i < sh.m.length; i++) if (sh.m[i] && (i === 0 || !sh.m[i - 1] || i === from)) return Math.max(0, i / M.rate - 0.3);
    return null;
  }
  function jumpMark(o) {
    const v = $("#ac-video"); if (!v) return;
    let t = markTime(card.cur, v.currentTime); if (t == null) t = markTime(card.cur);
    if (t == null) return toast("ИИ не отметил игрока в этой смене. Покажи его сам: V");
    v.currentTime = t; v.play().catch(() => {}); toast("К отметке ИИ");
  }
  function bindCard(o) {
    drawTl(o); drawDecide(o);
    if ($("#ac-gpu")) cleanup.push(window.GPU.mountCard($("#ac-gpu"), S.get(o.id)));   // видеокарта (assets/gpu.js)
    const media = o.real && window.ADMIN_MEDIA;
    if (media) { loadShift(o, card.cur, true); overlayLoop(o); }
    else loadShift(o, card.cur, false);
    // таймер «моё время на этот заказ»
    const tm = $("#ac-timer");
    const tick = () => { if (!tm) return; const sec = card.base + (Date.now() - card.start) / 1000; tm.textContent = mmss(sec); tm.classList.toggle("slow", sec > DEMO.goalMinutes * 60); };
    tick(); const iv = setInterval(tick, 1000); cleanup.push(() => clearInterval(iv));
    root.addEventListener("click", onCardClick);
    cleanup.push(() => root.removeEventListener("click", onCardClick));
    if (o.status === "help" && !S.over(o.id).opened) { S.patch(o.id, { opened: true }); }
  }
  function onCardClick(e) {
    const o = byId(card.id); if (!o) return;
    const t = e.target;
    const act = t.closest("[data-act]")?.dataset.act;
    if (act && !t.closest("[data-act]").disabled) { e.preventDefault(); doAct(act, o); return; }
    const bar = t.closest(".atb, .dq");
    if (bar && !card.add) { const n = +bar.dataset.shift; card.cur = n; refresh(o, true); return; }
    const atl = t.closest("#atl");
    if (atl && card.add) {
      const r = atl.getBoundingClientRect(), x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      if (card.add.a == null) { card.add.a = x; drawTl(o); }
      else { const a = Math.min(card.add.a, x), b = Math.max(card.add.a, x); card.add = null; addShift(o, a, b); }
      return;
    }
    const rect = t.closest("rect.bx");
    if (rect && card.pick) { followPlayer(o, +rect.dataset.tid); }
  }
  function refresh(o, reload) {
    o = byId(card.id);
    drawTl(o); drawDecide(o);
    $$(".dq", root).forEach((b) => { const s = o.shifts.find((x) => x.n === +b.dataset.shift); b.className = `dq ${s.st}${s.n === card.cur ? " cur" : ""}`; b.querySelector("i").textContent = s.st === "yes" ? "он" : s.st === "no" ? "не он" : "?"; });
    if (reload) loadShift(o, card.cur, true);
  }
  function setPick(on) {
    card.pick = on; $("#ac-player")?.classList.toggle("picking", on);
    $$("[data-act=pick]", root).forEach((b) => b.classList.toggle("on", on));
  }
  function decide(o, val) {
    const s = o.shifts.find((x) => x.n === card.cur); if (!s || !["doubt", "yes", "no"].includes(s.st)) return;
    const dec = { ...(S.over(o.id).dec || {}), [s.n]: val };
    S.patch(o.id, { dec });
    (card.hist ||= []).push([s.n]);
    log(o.id, "op", `Смена ${s.n}: ${val === "yes" ? "это он" : "не он"}`);
    flash(val === "yes" ? "Да, это он" : "Не он");
    toast(`Смена ${s.n}: ${val === "yes" ? "это он" : "не он"} · Z отменить`);
    const next = byId(o.id).shifts.find((x) => x.st === "doubt" && x.n !== s.n);
    if (next) card.cur = next.n;
    refresh(o, !!next);
    updatePreview();
  }
  function confirmAll(o) {
    const ns = o.shifts.filter((x) => x.st === "doubt").map((x) => x.n); if (ns.length < 2) return decide(o, "yes");
    const dec = { ...(S.over(o.id).dec || {}) }; ns.forEach((n) => { dec[n] = "yes"; });
    S.patch(o.id, { dec }); (card.hist ||= []).push(ns);
    log(o.id, "op", `Подтвердил сразу ${ns.length} смен: ${ns.join(", ")}`);
    flash(`Да, все ${ns.length}`); toast(`Подтверждено ${ns.length} смен · Z отменить`);
    refresh(o, false); updatePreview();
  }
  function undo(o) {
    const ns = card.hist?.pop(); if (!ns) return toast("Отменять нечего");
    const dec = { ...(S.over(o.id).dec || {}) }; ns.forEach((n) => { delete dec[n]; });
    S.patch(o.id, { dec }); log(o.id, "op", ns.length > 1 ? `Отменил решение по ${ns.length} сменам` : `Смена ${ns[0]}: отменил решение`);
    card.cur = ns[0]; refresh(o, true); updatePreview(); toast(ns.length > 1 ? `${ns.length} смен снова под сомнением` : `Смена ${ns[0]} снова под сомнением`);
  }
  function flash(text) {
    const p = $("#ac-player"); if (!p) return;
    const f = document.createElement("div"); f.className = "ac-flash"; f.textContent = text; p.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }
  function followPlayer(o, tid) {
    setPick(false);
    card.follow[card.cur] = tid;
    const box = $("#ac-follow"); box?.classList.add("on");
    const s = o.shifts.find((x) => x.n === card.cur);
    log(o.id, "op", `Смена ${card.cur}: показал игрока в кадре`);
    setTimeout(() => {
      box?.classList.remove("on");
      log(o.id, "ai", `Смена ${card.cur}: провёл игрока по всей смене`);
      if (s && ["doubt", "no"].includes(s.st)) decide(o, "yes"); else toast("ИИ провёл игрока по всей смене");
    }, reduced ? 200 : 1400);
  }
  function addShift(o, a, b) {
    if (b - a < 0.004) { toast("Слишком короткая смена"); drawTl(o); return; }
    const added = [...(S.over(o.id).added || []), [a, b]];
    S.patch(o.id, { added });
    log(o.id, "op", `Добавил пропущенную смену, ${Math.round((b - a) * 1200)} с`);
    toast("Смена добавлена"); refresh(o); updatePreview();
  }
  function updatePreview() {
    const o = byId(card.id), el = $("#ac-nums"); if (!el) return;
    el.innerHTML = prevNums(totals(o), o);
    const lg = $("#ac-log"); if (lg) lg.innerHTML = [...o.log].sort((a, b) => b[0] - a[0]).map(([ts, a, txt]) => `<li class="${a}"><i>${a === "ai" ? "ИИ" : a === "op" ? "Я" : "К"}</i><div><span>${esc(txt)}</span><small>${ago(ts)}</small></div></li>`).join("");
  }
  function saveTime(o) { const sec = Math.round(card.base + (Date.now() - card.start) / 1000); S.patch(o.id, { opSec: sec }); card.base = sec; card.start = Date.now(); return sec; }
  function doAct(act, o) {
    if (act === "yes" || act === "no") return decide(o, act);
    if (act === "yesall") return confirmAll(o);
    if (act === "pick") { if (!(o.real && window.ADMIN_MEDIA)) return toast("В демо-заказе нет кадров"); setPick(!card.pick); if (card.pick) $("#ac-video")?.pause(); return; }
    if (act === "add") { card.add = card.add ? null : { a: null }; setPick(false); drawTl(o); return; }
    if (act === "recalc") {
      const t = totals(o); log(o.id, "ai", `Пересчитал: ${t.n} смен, ${mmss(t.toi)} на льду, ролик пересобран`);
      updatePreview(); $(".ac-prev")?.classList.remove("pulse"); void $(".ac-prev")?.offsetWidth; $(".ac-prev")?.classList.add("pulse");
      const rb = $("#ac-reel-badge"); if (rb) { rb.textContent = "ролик пересобран"; setTimeout(() => (rb.textContent = "ролик 9:16"), 2400); }
      return toast("Цифры и ролик обновлены");
    }
    if (act === "send") {
      const left = o.shifts.filter((x) => x.st === "doubt").length;
      const t = totals(o), base = window.SHARE_URL || location.href.split("#")[0];
      const link = base + "#/result?own", local = /^(localhost|127\.|\[::1\])/.test(location.hostname) && !window.SHARE_URL;
      const lines = [`Привет! ${o.who === "kid" ? "Смены готовы" : "Твои смены готовы"}: ${o.home} – ${o.away}, ${o.period.toLowerCase()}.`, `${t.n} смен, ${mmss(t.toi)} на льду, средняя смена ${t.avg} с.`,
        o.cutAt ? `Запись трансляции обрывается на ${o.cutAt} по табло: смены после этого момента не видны.` : "", `Все смены, видео и ролик: ${link}`,
        OFFER.freeLeft > 0 ? `Эта игра бесплатно. Внизу страницы три коротких вопроса, ответь на них, пожалуйста.` : "", `Следующая игра: ${PRICES[0].price} ₽, оплата после результата.`, "Если что-то не так, напиши, переделаем бесплатно."].filter(Boolean);
      const msg = lines.join("\n");
      const href = o.client.tg ? `https://t.me/${encodeURIComponent(o.client.tg)}?text=${encodeURIComponent(msg)}` : `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(lines.filter((l) => !l.includes(link)).join("\n"))}`;
      const next = allOrders().filter((x) => x.status === "help" && x.id !== o.id).sort((a, b) => a.due - b.due)[0];
      return modal(`<h3>Отправить клиенту</h3>
        <p class="a-to"><span>Кому</span><b>${esc(tgName(o))}</b><i class="a-kit" style="--c:${kitBy(o.kit).hex}"></i><span>№${o.number}, ${esc(o.home)} – ${esc(o.away)}, заказ #${o.id}</span></p>
        ${left ? `<p class="warn">Осталось сомнительных смен: ${left}. Их не будет в результате.</p>` : ""}
        <pre class="a-msg">${esc(msg)}</pre>
        <div class="a-mact"><a class="abtn send" id="a-sendgo" href="${href}" target="_blank" rel="noopener">${icon.tg}${o.client.tg ? "Открыть Telegram и отправить" : "Выбрать чат в Telegram"}${kbd("Enter")}</a><button class="abtn" id="a-copy">Скопировать</button><button class="abtn ghost" data-close>Отмена ${kbd("Esc")}</button></div>
        <p class="muted">Отправляешь сам. ${next ? `После клика сразу откроется следующий заказ #${next.id}.` : "После клика вернёшься в очередь."} Ошибся клиентом? ${kbd("Z")} вернёт заказ в «Нужна помощь».</p>
        ${local ? `<p class="muted a-local">В демо ссылка локальная (${esc(location.host)}). В настоящей версии здесь будет короткая личная ссылка вида https://домен/r/код.</p>` : ""}`, () => {
        $("#a-copy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(msg); toast("Сообщение скопировано"); } catch { toast("Выдели текст и скопируй"); } });
        $("#a-sendgo").addEventListener("click", () => {
          const sec = saveTime(o); log(o.id, "ai", `Собрал результат: ${t.n} смен, ${mmss(t.toi)} на льду`);
          S.patch(o.id, { status: "sent" }); log(o.id, "op", `Отправил клиенту. Моё время ${mmss(sec)}`);
          lastSent = { id: o.id, at: Date.now() }; closeModal();
          setTimeout(() => { location.hash = next ? `#/admin/order/${next.id}` : "#/admin"; setTimeout(() => toast(`#${o.id} отправлен · Z вернуть${next ? `. Дальше #${next.id}` : ""}`), 350); }, 300);
        });
      });
    }
    if (act === "refuse") {
      const msg = `Привет! Эту игру не получится разобрать: номер не виден в записи. Ничего платить не нужно.\nПришли другую игру: нужна запись трансляции, где камера ближе. Её разберём бесплатно.`;
      return modal(`<h3>Отказ: трансляция не подходит</h3><pre class="a-msg">${msg}</pre>
        <div class="a-mact"><a class="abtn danger" id="a-refgo" href="https://t.me/${esc(o.client.tg)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${icon.tg}Отправить отказ</a><button class="abtn ghost" data-close>Отмена ${kbd("Esc")}</button></div>
        <p class="a-to"><span>Кому</span><b>${esc(tgName(o))}</b><span>заказ #${o.id}</span></p>
        <p class="muted">Оплата не берётся. Клиент увидит вежливый отказ и предложение прислать другую игру.</p>`, () => {
        $("#a-modal [data-close].abtn")?.focus();
        $("#a-refgo").addEventListener("click", () => { const sec = saveTime(o); S.patch(o.id, { status: "refused", reason: o.reason || "Номер не виден в записи" }); log(o.id, "op", `Отказ отправлен. Моё время ${mmss(sec)}`); closeModal(); toast("Отказ отправлен"); setTimeout(() => { location.hash = "#/admin"; }, 500); });
      });
    }
  }
  function modal(html, bind) {
    closeModal();
    const m = document.createElement("div"); m.className = "a-modal"; m.id = "a-modal";
    m.innerHTML = `<div class="a-modal-back" data-close></div><div class="a-modal-card" role="dialog" aria-modal="true">${html}</div>`;
    root.appendChild(m); m.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
    bind?.(); $(".a-modal-card a, .a-modal-card button", m)?.focus();
  }
  function closeModal() { $("#a-modal")?.remove(); }

  /* ================= клавиатура ================= */
  function onKey(e) {
    if (document.body.dataset.app !== "admin") return;
    const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
    const help = $("#a-helpbox");
    if (e.key === "Escape") {
      if (typing) { document.activeElement.blur(); return; }
      if ($("#a-modal")) return closeModal();
      if (help && !help.hidden) { help.hidden = true; return; }
      if (card && (card.pick || card.add)) { setPick(false); card.add = null; drawTl(byId(card.id)); return; }
      if (location.hash.includes("/order/")) { location.hash = "#/admin"; }
      return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "?") { help.hidden = !help.hidden; return; }
    if ($("#a-modal")) return;
    const k = e.key.toLowerCase();
    if (location.hash.includes("/order/")) {
      const o = byId(card.id); if (!o) return;
      const map = { y: "yes", "н": "yes", n: "no", "т": "no", v: "pick", "м": "pick", a: "add", "ф": "add", r: "recalc", "к": "recalc", s: "send", "ы": "send" };
      if ((k === "x" || k === "ч") && e.shiftKey) { e.preventDefault(); doAct("refuse", o); return; }
      if (k === "z" || k === "я") { e.preventDefault(); if (!card.hist?.length && undoSend()) return; undo(o); return; }
      if ((k === "y" || k === "н") && e.shiftKey) { e.preventDefault(); confirmAll(o); return; }
      if (k === "m" || k === "ь") { e.preventDefault(); jumpMark(o); return; }
      if ((e.key === "," || e.key === "." || k === "б" || k === "ю") && $("#ac-video")) { const vv = $("#ac-video"); vv.pause(); vv.currentTime = Math.max(0, vv.currentTime + (e.key === "." || k === "ю" ? 1 : -1) / 30); return; }
      if (map[k] && !e.shiftKey) { e.preventDefault(); const b = $(`[data-act=${map[k]}]`, root); if (b?.disabled) return; doAct(map[k], o); return; }
      const v = $("#ac-video");
      if (e.key === " " && v) { e.preventDefault(); v.paused ? v.play() : v.pause(); return; }
      if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && v) { e.preventDefault(); const st = e.shiftKey ? 10 : 2; v.currentTime = Math.max(0, v.currentTime + (e.key === "ArrowRight" ? st : -st)); return; }
      if ((e.key === "]" || e.key === "[") && v) { const r = [1, 1.5, 2], i = r.indexOf(v.playbackRate); v.playbackRate = r[Math.max(0, Math.min(2, (i < 0 ? 0 : i) + (e.key === "]" ? 1 : -1)))]; toast(`Скорость ${v.playbackRate}×`); return; }
      if (k === "j" || k === "о" || k === "k" || k === "л") { const ds = o.shifts.filter((x) => ["doubt", "yes", "no"].includes(x.st)); const list = ds.length ? ds : o.shifts; const i = list.findIndex((x) => x.n === card.cur); const nx = list[Math.max(0, Math.min(list.length - 1, i + (k === "j" || k === "о" ? 1 : -1)))]; card.cur = nx.n; refresh(o, true); }
      return;
    }
    if (k === "/") { e.preventDefault(); $("#a-q")?.focus(); return; }
    if (k === "z" || k === "я") { e.preventDefault(); if (!undoSend()) toast("Отменять нечего"); return; }
    if (k === "j" || k === "о" || e.key === "ArrowDown") { e.preventDefault(); moveSel(1); return; }
    if (k === "k" || k === "л" || e.key === "ArrowUp") { e.preventDefault(); moveSel(-1); return; }
    if (e.key === "Enter" && ctx.rows?.length) { location.hash = `#/admin/order/${ctx.rows[ctx.sel]}`; return; }
    if (/^[1-6]$/.test(e.key)) { ctx.tab = TABS[+e.key - 1][0]; ctx.sel = 0; render(); }
  }
  document.addEventListener("keydown", onKey);

  /* ================= монтирование ================= */
  let parts = [];
  function render() {
    cleanup.forEach((f) => f()); cleanup = []; cancelAnimationFrame(raf);
    const isCard = parts[0] === "order" && parts[1];
    if (!isCard) card = null;
    watchHelp();
    root.innerHTML = isCard ? cardView(parts[1]) : listView();
    document.title = `${freshHelp.size ? `(${freshHelp.size}) ` : ""}${B.name}: оператор${isCard ? ` #${parts[1]}` : ""}`;
    $("#a-bell").addEventListener("click", () => { const on = !soundOn(); try { localStorage.setItem(SOUND, on ? "1" : "0"); } catch { /* без хранилища */ } if (on) beep(); render(); });
    $("#a-help").addEventListener("click", () => { const h = $("#a-helpbox"); h.hidden = !h.hidden; });
    $("#a-gpu")?.addEventListener("click", async () => {      // ключ видеокарты: ввести, проверить, убрать
      if (window.GPU.key()) { if (confirm("Ключ видеокарты сохранён на этом устройстве. Убрать его?")) { window.GPU.setKey(""); render(); } return; }
      const k = prompt("Вставь ключ видеокарты (Cmd+V) и нажми ОК");
      if (!k || !k.trim()) return;
      window.GPU.setKey(k);
      const ok = await window.GPU.ping().catch(() => null);
      if (ok === true) toast("Ключ подходит. Теперь заказ VK из формы в этом браузере считается сам");
      else { window.GPU.setKey(""); alert(ok === false ? "Ключ не подошёл. Скопируй его заново и повтори." : "Пускатель не ответил. Проверь интернет и повтори."); }
      render();
    });
    $("#a-helpbox").addEventListener("click", (e) => { if (e.target.id === "a-helpbox") e.currentTarget.hidden = true; });
    $("#a-q").addEventListener("keydown", (e) => { if (e.key === "Enter" && ctx.rows?.length) { location.hash = `#/admin/order/${ctx.rows[0]}`; } });
    if (isCard) { const o = byId(parts[1]); if (o) bindCard(o); $("#a-q").addEventListener("focus", () => { location.hash = "#/admin"; }, { once: true }); }
    else bindList();
  }
  function ensureMedia(cb) {
    if (window.ADMIN_MEDIA) return cb();
    const s = document.createElement("script"); s.src = "data/admin_media.js"; s.onload = cb; s.onerror = cb; document.head.appendChild(s);
  }
  let offStore = null, ivList = null;
  window.ADMIN = {
    mount(view, rest) {
      root = view; parts = rest;
      window.scrollTo(0, 0);
      ensureMedia(render);
      offStore?.(); offStore = S.on(() => { if (!parts[0]) render(); });
      clearInterval(ivList); ivList = setInterval(() => { if (!parts[0] && !/INPUT/.test(document.activeElement?.tagName)) render(); }, 5000);
    },
    unmount() {
      cleanup.forEach((f) => f()); cleanup = []; cancelAnimationFrame(raf); offStore?.(); offStore = null; clearInterval(ivList); card = null;
    },
  };
})();
