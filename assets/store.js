/* Общее состояние демо для клиента и админки. Бэкенда нет: заказы из формы и действия оператора
   лежат в localStorage этого браузера. Клиент в одной вкладке и админка в другой видят одно и то же
   (событие storage), поэтому сценарий «клиент отправил → оператор помог → клиент получил» можно показать вживую. */
(() => {
  const KEY = "scout.demo.v2";
  const EMPTY = () => ({ orders: [], over: {} });
  let mem = null;
  /* если хранилище недоступно (приватный режим, просмотрщик), всё живёт в памяти этой вкладки */
  const read = () => { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : (mem || EMPTY()); } catch { return mem || EMPTY(); } };
  const write = (s) => { mem = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* только память */ } };
  mem = read();
  const subs = new Set();
  window.addEventListener("storage", (e) => { if (e.key === KEY) { mem = read(); subs.forEach((f) => f()); } });

  /* Заказ из формы проходит сам: принят → ИИ смотрит → (оператор) → готово.
     Если оператор ничего не сделал, после 10 секунд заказ ждёт его в очереди «Нужна помощь». */
  const PHASES = [[0, "new"], [3000, "ai"], [10000, "help"]];
  function phase(o, now = Date.now()) {
    if (o.status && ["sent", "refused", "ready"].includes(o.status)) return o.status;
    const dt = now - o.created; let p = "new";
    for (const [t, s] of PHASES) if (dt >= t) p = s;
    return p;
  }

  window.STORE = {
    /* заказ из формы плюс поверх него статус и время, которые поменяли оператор или кнопка демо */
    all() { mem = read(); return mem.orders.map((o) => { const v = mem.over[o.id] || {}; return { ...o, ...(v.status ? { status: v.status } : {}), ...(v.created ? { created: v.created } : {}) }; }); },
    get(id) { return this.all().find((o) => String(o.id) === String(id)); },
    add(o) { const s = read(); s.orders.unshift(o); write(s); subs.forEach((f) => f()); return o; },
    /* всё, что меняют поверх заказа (решения оператора, статус, журнал), лежит отдельно в over[id] */
    patch(id, p) {
      const s = read(); s.over[id] = Object.assign(s.over[id] || {}, p);
      write(s); subs.forEach((f) => f());
    },
    over(id) { return read().over[id] || {}; },
    phase,
    nextId(base = 1050) { const ids = this.all().map((o) => +o.id); return Math.max(base - 1, ...ids) + 1; },
    reset() { write({ orders: [], over: {} }); subs.forEach((f) => f()); },
    on(f) { subs.add(f); return () => subs.delete(f); },
  };
})();
