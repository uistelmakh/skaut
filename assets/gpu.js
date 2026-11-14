/* Расчёт матча на видеокарте Yandex Cloud (функция rink-launch, исходник tools/gpu_vm/launcher, GPU.md).

   Ключ видеокарты хранится только в этом браузере (localStorage "scout.gpu.key"); без ключа функция ничего не
   запускает. Где ключ введён:
     • форма заказа: после «Отправить в Telegram» расчёт всей игры стартует сам (ссылки VK; YouTube облако не скачивает);
     • админка, карточка заказа: блок «Видеокарта» — состояние, «Посчитать», «Остановить».
   Защиты на стороне функции: одна машина за раз, не больше 3 запусков в сутки, экзамены не считаются, срок машины 5 ч. */
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
  const run = (o) => api("POST", null, { action: "run", order: orderOf(o) });
  const status = (id) => api("GET", { action: "status", id: String(id) });
  const stop = (id) => api("POST", null, { action: "stop", id: String(id) });
  const ping = () => api("GET", { action: "ping" }).then((r) => !!r.key);

  /* ошибки функции — человеческими словами */
  const WHY = {
    youtube: "YouTube облако Яндекса не скачивает. Такой матч считается только на Маке.",
    not_vk: "Нужна ссылка на видео VK (vkvideo.ru или vk.com/video…).",
    only_exams: "Это экзаменационный период — его не считаем.",
    busy: "Видеокарта уже занята другим расчётом. Дождись конца или останови его.",
    daily_limit: "Сегодня уже 3 запуска — это лимит на сутки (защита от счёта).",
    need_key: "Ключ видеокарты не подходит. Введи его заново.",
    bad_number: "Номер игрока — только цифры.", bad_kit: "Неизвестный цвет формы.",
    cloud: "Облако Яндекса не ответило. Проверь баланс в консоли (Биллинг) и повтори.",
    not_configured: "Пускатель ещё не подключён (GPU_API в config.js пуст).",
  };
  const why = (e) => WHY[e.message] || `Ошибка: ${e.message}`;

  /* автозапуск из формы заказа: только в браузере с ключом и только для VK */
  function autoRun(o) {
    if (!key() || !API_() || !/vk(video)?\.(com|ru)/.test(o.url || "")) return;
    run(o).then((r) => console.info("видеокарта:", r.job, "периоды", r.periods)).catch((e) => console.warn("видеокарта:", why(e)));
  }

  const ST = { starting: "машина создаётся", running: "считает", done: "готово", failed: "ошибка", killed: "остановлено", lost: "машины нет", none: "не запускали" };
  function mountCard(el, o) {
    if (!el || !o) return () => {};
    let t = 0, alive = true;
    const css = `<style>.gpu-st{font-size:14px;line-height:1.45;margin:6px 0 10px}.gpu-st b{display:block;font-size:15px}.gpu-st small{display:block;opacity:.7}
      .gpu-row{display:flex;gap:8px;flex-wrap:wrap}.gpu-row input{flex:1;min-width:0;padding:8px 10px;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit}
      .gpu-row button{padding:8px 12px;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;cursor:pointer}
      .gpu-row button.go{background:#3DFF2E;color:#111;border-color:#3DFF2E;font-weight:600}.gpu-err{color:#ff6b5e;font-size:13px;margin-top:6px}</style>`;
    const draw = (s, err) => {
      if (!alive) return;
      if (!key()) {
        el.innerHTML = `${css}<h3>Видеокарта</h3><p class="gpu-st">Введи ключ видеокарты один раз на этом устройстве. Он лежит в файле <code>tools/gpu_vm/launch_key.txt</code> на Маке.</p>
          <div class="gpu-row"><input id="gpu-key" type="password" autocomplete="off" placeholder="ключ"><button id="gpu-save">Сохранить</button></div>`;
        el.querySelector("#gpu-save").onclick = () => { setKey(el.querySelector("#gpu-key").value); poll(); };
        return;
      }
      const st = s?.state || "none", busy = ["starting", "running"].includes(st);
      const mins = s?.started ? Math.round(((s.time && !busy ? s.time : Date.now() / 1000) - s.started) / 60) : 0;
      const rub = s?.rate ? Math.round(mins / 60 * s.rate) : 0;
      el.innerHTML = `${css}<h3>Видеокарта</h3><div class="gpu-st"><b>${esc(ST[st] || st)}</b>${s?.note ? `<span>${esc(s.note)}</span>` : ""}
        ${s?.periods ? `<small>периоды ${s.periods.join(", ")}${s.skipped?.length ? `; пропущен ${s.skipped.map((x) => x.period).join(", ")} (экзамен)` : ""}</small>` : ""}
        ${mins ? `<small>${mins} мин, около ${rub} ₽</small>` : ""}${s?.results?.length ? `<small>готовы: ${s.results.length} из ${s.periods?.length || "?"}; на Мак — tools/gpu.py fetch ${esc(s.job)}</small>` : ""}</div>
        <div class="gpu-row">${busy ? `<button id="gpu-stop">Остановить</button>` : `<button class="go" id="gpu-run">${st === "none" ? "Посчитать всю игру" : "Посчитать заново"}</button>`}<button id="gpu-forget" title="Убрать ключ с этого устройства">Ключ</button></div>
        ${err ? `<div class="gpu-err">${esc(err)}</div>` : ""}`;
      el.querySelector("#gpu-run")?.addEventListener("click", async (e) => {
        e.currentTarget.disabled = true;
        try { const r = await run(o); draw({ state: "starting", note: `до ${r.max_rub} ₽ в худшем случае`, ...r }); setTimeout(poll, 5000); }
        catch (x) { draw(s, why(x)); }
      });
      el.querySelector("#gpu-stop")?.addEventListener("click", async () => {
        if (!confirm("Остановить расчёт? Готовые периоды останутся в хранилище.")) return;
        try { await stop(o.id); poll(); } catch (x) { draw(s, why(x)); }
      });
      el.querySelector("#gpu-forget").addEventListener("click", () => { if (confirm("Убрать ключ видеокарты с этого устройства?")) { setKey(""); draw(); } });
    };
    const poll = async () => {
      clearTimeout(t);
      if (!key()) return draw();
      try { const s = await status(o.id); draw(s); if (["starting", "running"].includes(s.state)) t = setTimeout(poll, 30000); }
      catch (x) { draw(null, why(x)); }
    };
    poll();
    return () => { alive = false; clearTimeout(t); };
  }

  window.GPU = { key, setKey, run, status, stop, ping, autoRun, mountCard, ready: () => !!API_() };
})();
