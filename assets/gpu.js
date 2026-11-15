/* Расчёт матча на видеокарте Yandex Cloud (функция rink-launch, исходник tools/gpu_vm/launcher, GPU.md).

   Расчёт запускает только владелец: админка → карточка заказа → блок «Видеокарта» → «Запустить расчёт».
   Заявка из формы сама ничего не запускает и ждёт в статусе «ждёт запуска» (assets/store.js, phase).
   В блоке до запуска видно: какие периоды, оценка минут и рублей, есть ли запись в VK; перед стартом —
   подтверждение «Запустить за ≈ N ₽?». Функция без признака ручного запуска (manual) отказывает.
   Ключ видеокарты хранится только в этом браузере (localStorage "scout.gpu.key"); без ключа функция ничего не делает.
   Защиты на стороне функции: одна машина за раз, не больше 3 запусков в сутки, срок машины 5 ч. */
(() => {
  const API_ = () => window.GPU_API || "";
  const KEY = "scout.gpu.key";
  const key = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
  const setKey = (k) => { try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY); } catch { /* без хранилища */ } };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  async function api(method, params, body) {
    const API = API_();
    if (!API) throw Object.assign(new Error("not_configured"), { status: 0 });
    const url = API + (params ? "?" + new URLSearchParams(params) : "");
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json", "X-GPU-Key": key() }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || r.status), { status: r.status, body: j });
    return j;
  }
  const orderOf = (o) => ({ id: o.id, url: o.url, number: o.number, kit: o.kit, team: o.team, scope: o.scope || "game", marker: o.marker });
  const run = (o) => api("POST", null, { action: "run", manual: true, order: orderOf(o) });   // manual: нажата кнопка в админке
  /* оценка перед запуском: периоды, минуты, рубли, запись в VK. Ничего не запускает. Держим 5 минут на заказ */
  const EST = new Map();
  const estimate = async (o) => {
    const hit = EST.get(String(o.id));
    if (hit && Date.now() - hit.at < 300000) return hit.data;
    const data = await api("POST", null, { action: "estimate", order: orderOf(o) });
    EST.set(String(o.id), { at: Date.now(), data });
    return data;
  };
  const perText = (ps) => { const main = (ps || []).filter((p) => p !== 4); return main.join(", ") + ((ps || []).includes(4) ? `${main.length ? " и " : ""}овертайм, если был` : ""); };
  /* отметка «расчёт запускали»: по ней заявка уходит из «ждёт запуска» (assets/store.js) */
  const mark = (id, job, at) => { const S = window.STORE; if (!S || S.over(id).gpu) return false; S.patch(id, { gpu: { job: job || null, at: at || Date.now() } }); return true; };
  const status = (id) => api("GET", { action: "status", id: String(id) });
  const stop = (id) => api("POST", null, { action: "stop", id: String(id) });
  const ping = () => api("GET", { action: "ping" }).then((r) => !!r.key);

  /* ошибки функции — человеческими словами */
  const WHY = {
    youtube: "YouTube облако Яндекса не скачивает. Такой матч считается только на Маке.",
    not_vk: "Нужна ссылка на видео VK (vkvideo.ru или vk.com/video…).",
    only_exams: "Это экзаменационный период — его не считаем.",
    busy: "Видеокарта уже занята другим расчётом. Дождись конца или останови его.",
    already_running: "Этот заказ уже считается.",
    manual_only: "Запуск только кнопкой «Запустить расчёт». Обнови страницу и нажми её ещё раз.",
    vk_not_ready: "VK ещё обрабатывает запись. Попробуй позже.",
    bad_periods: "Не понял, какие периоды считать.",
    daily_limit: "Сегодня уже 3 запуска — это лимит на сутки (защита от счёта).",
    budget: "Лимит расходов на сегодня исчерпан. Новый расчёт можно запустить завтра или поднять лимит (GPU.md).",
    need_key: "Ключ видеокарты не подходит. Введи его заново.",
    bad_number: "Номер игрока — только цифры.", bad_kit: "Неизвестный цвет формы.",
    cloud: "Облако Яндекса не ответило. Проверь баланс в консоли (Биллинг) и повтори.",
    not_configured: "Пускатель ещё не подключён (GPU_API в config.js пуст).",
  };
  const why = (e) => WHY[e.message] || `Ошибка: ${e.message}`;

  /* автозапуска из формы заказа больше нет (15.11.2026): расчёт запускает владелец кнопкой в админке.
     Пустая функция оставлена для страниц со старым app.js из кэша браузера */
  function autoRun() {}

  const ST = { waiting: "ждём", starting: "машина создаётся", running: "считает", done: "готово", failed: "ошибка", killed: "остановлено", lost: "машины нет", none: "ждёт запуска" };
  function mountCard(el, o, onLaunch) {      // onLaunch — заявка ушла из «ждёт запуска»: админка перерисует карточку
    if (!el || !o) return () => {};
    let t = 0, alive = true, est = null, estErr = "", noGpu = false, last = null;   // noGpu — ссылка не VK: облако такой матч не считает
    const css = `<style>.gpu-st{font-size:14px;line-height:1.45;margin:6px 0 10px}.gpu-st b{display:block;font-size:15px}.gpu-st small{display:block;opacity:.7}
      .gpu-row{display:flex;gap:8px;flex-wrap:wrap}.gpu-row input{flex:1;min-width:0;padding:8px 10px;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit}
      .gpu-row button{padding:8px 12px;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;cursor:pointer}
      .gpu-row button.go{background:#3DFF2E;color:#111;border-color:#3DFF2E;font-weight:600}.gpu-row button:disabled{opacity:.5;cursor:default}.gpu-err{color:#ff6b5e;font-size:13px;margin-top:6px}
      .gpu-est{margin:0 0 14px;font-size:14px;line-height:1.4}.gpu-est dt{font-size:12px;opacity:.65;margin-top:8px}.gpu-est dd{margin:0;font-weight:600}
      .gpu-est dd small{display:block;font-weight:400;opacity:.7}.gpu-est dd.ok{color:#34d27b}.gpu-est dd.warn{color:#f2b53a}</style>`;
    const draw = (s, err) => {
      if (!alive) return;
      last = s;
      if (!key()) {
        el.innerHTML = `${css}<h3>Видеокарта</h3><p class="gpu-st">Введи ключ видеокарты один раз на этом устройстве. Он лежит в файле <code>tools/gpu_vm/launch_key.txt</code> на Маке.</p>
          <div class="gpu-row"><input id="gpu-key" type="password" autocomplete="off" placeholder="ключ"><button id="gpu-save">Сохранить</button></div>`;
        el.querySelector("#gpu-save").onclick = () => { setKey(el.querySelector("#gpu-key").value); poll(); };
        return;
      }
      const st = s?.state || "none", busy = ["starting", "running", "waiting"].includes(st);
      const mins = s?.started && s.state !== "waiting" ? Math.round(((s.time && !busy ? s.time : Date.now() / 1000) - s.started) / 60) : 0;
      const rub = s?.rate ? Math.round(mins / 60 * s.rate) : 0;
      el.innerHTML = `${css}<h3>Видеокарта</h3><div class="gpu-st"><b>${esc(noGpu && st === "none" ? "на видеокарте не считается" : ST[st] || st)}</b>${s?.note ? `<span>${esc(s.note)}</span>` : ""}
        ${s?.periods ? `<small>периоды ${s.periods.join(", ")}${s.skipped?.length ? `; пропущен ${s.skipped.map((x) => x.period).join(", ")} (экзамен)` : ""}</small>` : ""}
        ${mins ? `<small>${mins} мин, около ${rub} ₽</small>` : ""}${s?.results?.length ? `<small>готовы: ${s.results.length} из ${s.periods?.length || "?"}; на Мак — tools/gpu.py fetch ${esc(s.job)}</small>` : ""}</div>
        ${busy ? "" : `<dl class="gpu-est">${est ? `<dt>Периоды</dt><dd>${esc(perText(est.periods))}</dd>
          <dt>Оценка</dt><dd>≈ ${est.minutes} мин, ≈ ${est.rub} ₽ <small>потолок ${est.max_rub} ₽ (срок машины ${est.max_hours} ч)</small></dd>
          <dt>Запись в VK</dt><dd class="${est.vk.ready ? "ok" : "warn"}">${esc(est.vk.note)}</dd>
          ${est.busy ? `<dt>Видеокарта</dt><dd class="warn">занята (${esc(est.busy)}): расчёт встанет в очередь</dd>` : ""}
          <dt>Запусков сегодня</dt><dd class="${est.today >= est.limit ? "warn" : ""}">${est.today} из ${est.limit}</dd>
          ${est.budget ? `<dt>Потрачено сегодня</dt><dd class="${est.spent_today >= est.budget - 15 ? "warn" : ""}">${Math.round(est.spent_today)} из ${Math.round(est.budget)} ₽</dd>` : ""}` : `<dt>${noGpu ? "Почему" : "Оценка"}</dt><dd>${estErr ? esc(estErr) : "считаю…"}</dd>`}</dl>`}
        <div class="gpu-row">${busy ? `<button id="gpu-stop">Остановить</button>` : noGpu ? "" : `<button class="go" id="gpu-run">${st === "none" ? "Запустить расчёт" : "Запустить заново"}</button>`}<button id="gpu-forget" title="Убрать ключ с этого устройства">Ключ</button></div>
        ${err ? `<div class="gpu-err">${esc(err)}</div>` : ""}`;
      el.querySelector("#gpu-run")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget; btn.disabled = true;
        try {
          if (!est) est = await estimate(o);          // без оценки не запускаем: в подтверждении должна быть цена
          const warn = est.vk.ready === false ? `\n\n${est.vk.note}. Заявка встанет в ожидание и запустится сама, когда запись будет готова.`
            : est.busy ? "\n\nВидеокарта занята: расчёт начнётся, когда она освободится." : "";
          if (!confirm(`Запустить за ≈ ${est.rub} ₽?\n\nПериоды: ${perText(est.periods)}.\nОколо ${est.minutes} мин машины, не больше ${est.max_rub} ₽.${warn}`)) { btn.disabled = false; return; }
          const r = await run(o);
          draw({ state: r.state || "starting", note: r.note || `оценка ≈ ${est.rub} ₽, не больше ${r.max_rub} ₽`, ...r });
          setTimeout(poll, 5000);
          if (mark(o.id, r.job)) onLaunch?.();
        } catch (x) { draw(s, why(x)); }
      });
      el.querySelector("#gpu-stop")?.addEventListener("click", async () => {
        if (!confirm(s?.state === "waiting" ? "Отменить ожидание? Расчёт не запустится." : "Остановить расчёт? Готовые периоды останутся в хранилище.")) return;
        try { await stop(o.id); poll(); } catch (x) { draw(s, why(x)); }
      });
      el.querySelector("#gpu-forget").addEventListener("click", () => { if (confirm("Убрать ключ видеокарты с этого устройства?")) { setKey(""); draw(); } });
    };
    const poll = async () => {
      clearTimeout(t);
      if (!key()) return draw();
      try {
        const s = await status(o.id); draw(s);
        const busy = ["starting", "running", "waiting"].includes(s.state);
        if (busy) t = setTimeout(poll, 30000);
        else if (!est && !estErr) estimate(o).then((e) => { est = e; draw(last); }).catch((x) => { estErr = why(x); noGpu = ["youtube", "not_vk"].includes(x.message); draw(last); });
        if (s.state && s.state !== "none" && mark(o.id, s.job, s.started ? s.started * 1000 : 0)) onLaunch?.();   // запущен раньше или с другого устройства
      } catch (x) { draw(null, why(x)); }
    };
    poll();
    return () => { alive = false; clearTimeout(t); };
  }

  window.GPU = { key, setKey, run, estimate, status, stop, ping, autoRun, mountCard, ready: () => !!API_() };
})();
