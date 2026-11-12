/* Общее состояние заказов для клиента и админки.

   Два режима.
   1. Локальный (по умолчанию, в том числе для тестов): заказы из формы и решения оператора лежат в localStorage
      этого браузера. Клиент в одной вкладке и админка в другой видят одно и то же через событие storage.
   2. Облачный: на сайте uistelmakh.github.io (или локально после localStorage["scout.cloud"] = "1") заказы ещё и
      уходят в функцию Yandex Cloud (window.ORDERS_API в config.js). Тогда заказ с телефона виден в админке
      на ноутбуке. Код админки для облака кладёт в sessionStorage экран входа (app.js).
   Чтение всегда мгновенное, из памяти; облако догоняет фоном раз в несколько секунд. */
(() => {
  const KEY = "scout.demo.v2";
  const EMPTY = () => ({ orders: [], over: {} });
  let mem = null;
  /* если хранилище недоступно (приватный режим, просмотрщик), всё живёт в памяти этой вкладки */
  const read = () => { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : (mem || EMPTY()); } catch { return mem || EMPTY(); } };
  const write = (s) => { mem = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* только память */ } };
  mem = read();
  const subs = new Set();
  const emit = () => subs.forEach((f) => f());
  window.addEventListener("storage", (e) => { if (e.key === KEY) { mem = read(); emit(); } });

  /* Заказ из формы проходит сам: принят → ИИ смотрит → (оператор) → готово.
     Если оператор ничего не сделал, после 10 секунд заказ ждёт его в очереди «Нужна помощь». */
  const PHASES = [[0, "new"], [3000, "ai"], [10000, "help"]];
  function phase(o, now = Date.now()) {
    if (o.status && ["sent", "refused", "ready"].includes(o.status)) return o.status;
    const dt = now - o.created; let p = "new";
    for (const [t, s] of PHASES) if (dt >= t) p = s;
    return p;
  }

  /* ---------- облако ---------- */
  const flag = (() => { try { return localStorage.getItem("scout.cloud"); } catch { return null; } })();
  const API = window.ORDERS_API || "";
  const CLOUD = !!API && flag !== "0" && (location.hostname === "uistelmakh.github.io" || flag === "1");
  const adminKey = () => { try { return sessionStorage.getItem("scout.admin.key") || ""; } catch { return ""; } };
  const watched = new Set();          // заказы, статус которых этот браузер ждёт (свои и открытый по ссылке)
  const pending = new Map();          // id → сколько записей ещё летит в облако: их не перетираем ответом списка
  let online = null;                  // null — ещё не знаем, true/false — ответило ли облако последний раз

  async function api(method, params, body) {
    const url = API + (params ? "?" + new URLSearchParams(params) : "");
    const headers = { "Content-Type": "application/json" };
    const k = adminKey(); if (k) headers["X-Admin-Key"] = k;
    const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || r.status); e.status = r.status; throw e; }
    return j;
  }
  const hold = (id, d) => { const n = (pending.get(String(id)) || 0) + d; n > 0 ? pending.set(String(id), n) : pending.delete(String(id)); };

  async function sync() {
    if (!CLOUD || document.hidden) return;
    try {
      const s = read(); let changed = false;
      if (adminKey()) {
        const remote = await api("GET", { action: "list" });
        const ids = new Set(remote.orders.map((o) => String(o.id)));
        const localOnly = s.orders.filter((o) => !ids.has(String(o.id)) && pending.has(String(o.id)));
        const orders = [...localOnly, ...remote.orders];
        const over = { ...remote.over };
        for (const id of pending.keys()) if (s.over[id]) over[id] = s.over[id];
        for (const id of Object.keys(s.over)) if (!(id in over) && !ids.has(id)) over[id] = s.over[id];   // правки демо-заказов этого браузера
        changed = JSON.stringify([orders, over]) !== JSON.stringify([s.orders, s.over]);
        if (changed) write({ orders, over });
      } else {
        const own = s.orders.filter((o) => !["sent", "refused"].includes(phase({ ...o, ...(s.over[o.id] || {}) }))).map((o) => String(o.id));
        for (const id of new Set([...own, ...watched])) {
          if (pending.has(id)) continue;
          const r = await api("GET", { action: "get", id });
          if (!r.order) continue;
          const i = s.orders.findIndex((o) => String(o.id) === id);
          const before = JSON.stringify([s.orders[i], s.over[id]]);
          if (i < 0) s.orders.unshift(r.order); else s.orders[i] = r.order;
          s.over[id] = r.over || {};
          if (JSON.stringify([r.order, s.over[id]]) !== before) changed = true;
        }
        if (changed) write(s);
      }
      online = true;
      if (changed) emit();
    } catch { online = false; }
  }
  if (CLOUD) {
    let t = 0;
    const loop = () => { clearTimeout(t); sync().finally(() => { t = setTimeout(loop, adminKey() ? 8000 : 5000); }); };
    loop();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) loop(); });
  }

  window.STORE = {
    cloud: CLOUD,
    online: () => online,
    /* заказ из формы плюс поверх него статус и время, которые поменяли оператор или кнопка демо */
    all() { mem = read(); return mem.orders.map((o) => { const v = mem.over[o.id] || {}; return { ...o, ...(v.status ? { status: v.status } : {}), ...(v.created ? { created: v.created } : {}) }; }); },
    get(id) { return this.all().find((o) => String(o.id) === String(id)); },
    add(o) {
      const s = read(); s.orders.unshift(o); write(s); emit();
      if (CLOUD) { hold(o.id, 1); api("POST", null, { action: "add", order: o }).catch(() => {}).finally(() => hold(o.id, -1)); }
      return o;
    },
    /* всё, что меняют поверх заказа (решения оператора, статус, журнал), лежит отдельно в over[id] */
    patch(id, p) {
      const s = read(); s.over[id] = Object.assign(s.over[id] || {}, p);
      write(s); emit();
      if (CLOUD) { hold(id, 1); api("POST", null, { action: "patch", id: String(id), p }).catch(() => {}).finally(() => hold(id, -1)); }
    },
    over(id) { return read().over[id] || {}; },
    phase,
    /* в облаке номер случайный из пяти цифр: заказы с разных устройств не столкнутся */
    nextId(base = 1050) {
      const ids = new Set(this.all().map((o) => +o.id));
      if (CLOUD) { let n; do { n = 10000 + Math.floor(Math.random() * 90000); } while (ids.has(n)); return n; }
      return Math.max(base - 1, ...ids) + 1;
    },
    /* страница статуса просит догрузить заказ, открытый по ссылке из другого браузера */
    watch(id) { if (CLOUD && id) { watched.add(String(id)); sync(); } },
    sync,
    reset() { write({ orders: [], over: {} }); emit(); },
    on(f) { subs.add(f); return () => subs.delete(f); },
  };
})();
