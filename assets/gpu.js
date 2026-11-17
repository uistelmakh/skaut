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
  const live = (id) => api("GET", { action: "live", id: String(id) });   // живая сводка с машины (tools/gpu_vm/live.py)

  /* ---------- экран «Ход расчёта»: что делает машина прямо сейчас, человеческими словами ---------- */
  const dur = (s) => { s = Math.max(0, Math.round(s || 0)); return s < 60 ? `${s} с` : s < 600 ? `${Math.floor(s / 60)} мин ${String(s % 60).padStart(2, "0")} с` : s < 3600 ? `${Math.round(s / 60)} мин` : `${Math.floor(s / 3600)} ч ${String(Math.floor(s % 3600 / 60)).padStart(2, "0")} мин`; };
  const clock = (t) => new Date(t * 1000).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  const LIVE_CSS = `.gl{position:fixed;inset:0;z-index:200;overflow:auto;background:var(--a-bg,#0C0D10);color:var(--a-ink,#ECEDF0);font:400 14px/1.45 var(--text,system-ui)}
    .gl-in{max-width:1180px;margin:0 auto;padding:18px 20px 60px}.gl-top{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}
    .gl-top h2{margin:0;font-size:20px;line-height:1.25;text-wrap:balance}.gl-top p{margin:4px 0 0;color:var(--a-ink2,#B4B8C0)}
    .gl-x{margin-left:auto;flex:none;padding:8px 14px;border-radius:8px;border:1px solid var(--a-line2,#333);background:transparent;color:inherit;font:inherit;cursor:pointer}
    .gl-al{margin:0 0 14px;padding:0;list-style:none;display:grid;gap:8px}.gl-al li{padding:10px 12px;border-radius:10px;border:1px solid;overflow-wrap:anywhere}
    .gl-al .error{border-color:var(--a-no,#F0574B);background:rgba(240,87,75,.12)}.gl-al .warn{border-color:var(--a-doubt,#F2B53A);background:rgba(242,181,58,.1)}
    .gl-al b{display:block;font-size:12px;letter-spacing:.04em;text-transform:uppercase;opacity:.8}
    .gl-box{background:var(--a-panel,#15171D);border:1px solid var(--a-line,#222);border-radius:12px;padding:14px;margin-bottom:14px}
    .gl-box h3{margin:0 0 10px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--a-ink3,#9198A3);font-weight:600}
    .gl-m{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.gl-m div b{display:block;font-size:22px;font-variant-numeric:tabular-nums;line-height:1.15}
    .gl-m small{color:var(--a-ink3,#9198A3)}.gl-sp{display:block;width:100%;height:64px;margin-top:12px}.gl-lg{display:flex;gap:16px;font-size:12px;color:var(--a-ink3,#9198A3);margin-top:4px;flex-wrap:wrap}
    .gl-lg i{display:inline-block;width:10px;height:3px;border-radius:2px;vertical-align:middle;margin-right:5px}
    .gl-ps{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-bottom:14px}
    .gl-p{background:var(--a-panel,#15171D);border:1px solid var(--a-line,#222);border-radius:12px;padding:14px;min-width:0}
    .gl-p.error{border-color:var(--a-no,#F0574B)}.gl-p.warn{border-color:var(--a-doubt,#F2B53A)}
    .gl-p header{display:flex;align-items:center;gap:8px;margin-bottom:8px}.gl-p header b{font-size:16px}
    .gl-chip{font-size:12px;padding:2px 8px;border-radius:99px;background:var(--a-panel2,#1B1E25);border:1px solid var(--a-line2,#333)}
    .gl-chip.run{color:#3DFF2E;border-color:#3DFF2E}.gl-chip.ok{color:var(--a-yes,#34D27B);border-color:var(--a-yes,#34D27B)}.gl-chip.error{color:var(--a-no,#F0574B);border-color:var(--a-no,#F0574B)}
    .gl-r{margin-left:auto;color:var(--a-ink3,#9198A3);font-size:13px;font-variant-numeric:tabular-nums}
    .gl-st{font-size:16px;font-weight:600;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.gl-st span{font-weight:400;color:var(--a-ink2,#B4B8C0);font-variant-numeric:tabular-nums}
    .gl-bar{height:6px;border-radius:3px;background:var(--a-panel2,#1B1E25);margin:8px 0;overflow:hidden}.gl-bar i{display:block;height:100%;background:#3DFF2E;border-radius:3px}
    .gl-ln{margin:6px 0 0;color:var(--a-ink2,#B4B8C0);overflow-wrap:anywhere}.gl-ln.warn{color:var(--a-doubt,#F2B53A)}.gl-ln q{quotes:"«" "»";color:var(--a-ink,#ECEDF0)}
    .gl-err{margin:8px 0 0;padding:8px 10px;border-radius:8px;background:rgba(240,87,75,.12);overflow-wrap:anywhere}
    .gl-p details{margin-top:10px;border-top:1px solid var(--a-line,#222);padding-top:8px}.gl-p summary{cursor:pointer;color:var(--a-ink2,#B4B8C0)}
    .gl-sl{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:3px}.gl-sl li{display:grid;grid-template-columns:minmax(0,1fr) 70px 78px;gap:8px;align-items:center;font-size:13px}
    .gl-sl li>span:last-child{text-align:right;font-variant-numeric:tabular-nums}.gl-sl .todo{opacity:.45}.gl-sl .cur{color:#3DFF2E;font-weight:600}.gl-sl .bad{color:var(--a-no,#F0574B)}
    .gl-sl em{display:block;height:4px;border-radius:2px;background:var(--a-acc2,#8FB0FF);font-style:normal;min-width:2px}
    .gl-p pre{margin:8px 0 0;padding:8px;border-radius:8px;background:var(--a-bg2,#111318);font:12px/1.4 ui-monospace,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto}
    .gl-p ul.gl-nt{margin:8px 0 0;padding-left:18px;font-size:13px;overflow-wrap:anywhere}
    .gl-ev{list-style:none;margin:0;padding:0}.gl-ev li{display:grid;grid-template-columns:70px 78px minmax(0,1fr);gap:8px;padding:5px 0;border-top:1px solid var(--a-line,#222);font-size:13px}
    .gl-ev time{color:var(--a-ink3,#9198A3);font-variant-numeric:tabular-nums}.gl-ev .who{color:var(--a-ink2,#B4B8C0)}.gl-ev .error{color:var(--a-no,#F0574B)}.gl-ev .warn{color:var(--a-doubt,#F2B53A)}
    .gl-ev .ok span:last-child::before{content:"✓ ";color:var(--a-yes,#34D27B)}.gl-ev span:last-child{overflow-wrap:anywhere}
    .gl-ev .gl-day{display:block;padding:14px 0 6px;font-weight:600;color:var(--a-ink,#ECEDF0);border-top:0}.gl-ev a{color:var(--a-acc2,#8FB0FF)}
    .gl-f select{font:inherit;color:inherit;background:var(--a-panel2,#1B1E25);border:1px solid var(--a-line2,#333);border-radius:6px;padding:3px 6px}
    .gl-f{display:flex;gap:16px;align-items:center;margin-bottom:8px;flex-wrap:wrap}.gl-f label{display:flex;gap:6px;align-items:center;cursor:pointer;color:var(--a-ink2,#B4B8C0)}
    @media(max-width:600px){.gl-in{padding:12px 12px 48px}.gl-ev li{grid-template-columns:62px minmax(0,1fr)}.gl-ev .who{display:none}}`;
  const STATE_TXT = { waiting: "ждёт очереди", starting: "машина создаётся", running: "считает", done: "готово", failed: "закончилось с ошибкой", killed: "остановлено", lost: "машины нет", none: "не запускался" };
  const chipOf = (st) => st === "идёт" ? "run" : st === "готов" ? "ok" : st === "ошибка" ? "error" : "";
  const who = (p) => p == null ? "машина" : p === "sys" ? "система" : p === 4 ? "овертайм" : `период ${p}`;
  /* одна строка про период — и для карточки, и для экрана */
  function perLine(p) {
    if (p.state === "идёт" && p.step_name) return `${p.name}: ${p.step_name}, шаг ${p.step_n || "?"} из ${p.steps_total || "?"}, ${dur(p.step_sec)}${p.progress?.pct != null ? `, ${p.progress.pct} %` : ""}`;
    if (p.state === "готов") return `${p.name}: готов${p.result ? `, смен ${p.result.shifts}, на льду ${mmss(p.result.ice_sec)}` : ""}`;
    if (p.state === "ошибка") return `${p.name}: ошибка${p.step_name ? ` на шаге «${p.step_name}»` : ""}`;
    return `${p.name}: ${p.state}`;
  }
  function spark(hist) {
    if (!hist || hist.length < 2) return "";
    const W = 600, H = 64, t0 = hist[0][0], t1 = hist[hist.length - 1][0] || t0 + 1;
    const line = (j) => hist.filter((r) => r[j] != null).map((r) => `${(((r[0] - t0) / Math.max(1, t1 - t0)) * W).toFixed(1)},${(H - 2 - (r[j] / 100) * (H - 4)).toFixed(1)}`).join(" ");
    return `<svg class="gl-sp" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Загрузка процессора и видеокарты за время расчёта">
      <line x1="0" y1="${H - 2}" x2="${W}" y2="${H - 2}" stroke="currentColor" stroke-opacity=".15"/><line x1="0" y1="2" x2="${W}" y2="2" stroke="currentColor" stroke-opacity=".15"/>
      <polyline points="${line(1)}" fill="none" stroke="#8FB0FF" stroke-width="2" vector-effect="non-scaling-stroke"/><polyline points="${line(2)}" fill="none" stroke="#3DFF2E" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
      <div class="gl-lg"><span><i style="background:#8FB0FF"></i>процессор</span><span><i style="background:#3DFF2E"></i>видеокарта</span><span>от 0 до 100 %, слева начало расчёта</span></div>`;
  }
  function liveHtml(r, o, onlyBad) {
    const L = r.live, busy = ["starting", "running", "waiting"].includes(r.state), now = r.now || Date.now() / 1000;
    const head = `<div class="gl-top"><div><h2>Ход расчёта · заказ #${esc(o.id)}${o.number ? ` · №${esc(o.number)}` : ""}${o.team ? ` «${esc(o.team)}»` : ""}</h2>`;
    const close = `</div><button class="gl-x" id="gl-x">Закрыть</button></div>`;
    const sys = (r.sys || []).map((e) => ({ t: e.t, level: e.level, text: e.text, period: "sys" }));
    const feed = (list) => `<ul class="gl-ev">${list.map((e) => `<li class="${e.level}"><time>${clock(e.t)}</time><span class="who">${who(e.period)}</span><span>${esc(e.text)}</span></li>`).join("") || `<li><time></time><span class="who"></span><span>${onlyBad ? "Ошибок и предупреждений нет." : "Событий пока нет."}</span></li>`}</ul>`;
    const sysBox = sys.length ? `<div class="gl-box"><h3>Что происходило с этим заказом</h3>${feed([...sys].reverse())}</div>` : "";
    if (r.state === "none") return `${head}<p>Этот заказ на видеокарте ещё не запускался.</p>${close}${sysBox}`;
    if (!L) return `${head}<p>${esc(STATE_TXT[r.state] || r.state)}${r.note ? `: ${esc(r.note)}` : ""}.</p><p>Подробности появятся, когда машина начнёт считать — обычно через 3–4 минуты после запуска. Если расчёт был до 17.11.2026, подробной сводки по нему нет.</p>${close}${sysBox}`;
    const age = Math.max(0, now - L.time), spent = busy ? (now - L.started) / 60 : L.machine_min;
    const sum = busy ? `Считает ${dur(spent * 60)} · потрачено около ${Math.round(spent / 60 * (L.rate || 0))} ₽${L.left_sec ? ` · осталось примерно ${dur(L.left_sec)} (около ${L.left_rub} ₽)` : ""}`
      : `${STATE_TXT[r.state] || r.state} · машина работала ${dur(L.machine_min * 60)} · ${Math.round(L.rub)} ₽`;
    const al = [...(L.alerts || [])];
    if (busy && age > 120) al.unshift({ level: "error", text: `Сводка с машины не обновлялась ${dur(age)}. Машина не отвечает: её прервало облако или она зависла целиком. Прерванную машину сторож запустит снова сам.` });
    if (busy && r.deadline && r.deadline - now < 1200) al.push({ level: "warn", text: `До срока машины осталось ${dur(r.deadline - now)} — потом она выключится сама.` });
    const M = L.machine || {}, bar = (v) => v == null ? "нет данных" : `${v} %`;
    const mach = `<div class="gl-box"><h3>Машина</h3><div class="gl-m">
      <div><b>${bar(M.cpu)}</b><small>процессор сейчас${M.cpu_avg != null ? `, в среднем ${M.cpu_avg} %` : ""}</small></div>
      <div><b>${bar(M.gpu)}</b><small>видеокарта сейчас${M.gpu_avg != null ? `, в среднем ${M.gpu_avg} %` : ""}</small></div>
      <div><b>${M.ram_gb != null ? `${M.ram_gb} ГБ` : "нет данных"}</b><small>память${M.ram_total_gb ? ` из ${M.ram_total_gb} ГБ` : ""}</small></div>
      <div><b>${M.disk_free_gb != null ? `${M.disk_free_gb} ГБ` : "нет данных"}</b><small>свободно на диске${M.disk_total_gb ? ` из ${M.disk_total_gb} ГБ` : ""}</small></div></div>${spark(M.hist)}</div>`;
    const per = (p) => {
      const lim = (p.stale_min || 15) * 60, quiet = p.silent_sec || 0, hang = p.state === "идёт" && quiet >= 0.6 * lim;
      const maxSec = Math.max(1, ...p.done.map((x) => x.sec)), doneBy = new Map(p.done.map((x) => [x.step, x]));
      const ladder = (L.steps || []).map((s) => {
        const d = doneBy.get(s.step);
        if (d) return `<li><span>${esc(s.name)}</span><span><em style="width:${Math.max(3, Math.round(100 * d.sec / maxSec))}%"></em></span><span>${dur(d.sec)}</span></li>`;
        if (p.state === "идёт" && p.step === s.step) return `<li class="cur"><span>▶ ${esc(s.name)}</span><span></span><span>${dur(p.step_sec)}</span></li>`;
        if (p.state === "ошибка" && p.failed_step === s.step) return `<li class="bad"><span>✕ ${esc(s.name)}</span><span></span><span>сбой</span></li>`;
        return p.state === "нет овертайма" ? "" : `<li class="todo"><span>${esc(s.name)}</span><span></span><span>—</span></li>`;
      }).join("");
      return `<section class="gl-p ${p.state === "ошибка" ? "error" : hang ? "warn" : ""}"><header><b>${esc(p.name)}</b><span class="gl-chip ${chipOf(p.state)}">${esc(p.state)}</span>
        <span class="gl-r">${p.state === "идёт" && p.step_n ? `шаг ${p.step_n} из ${p.steps_total}` : p.total_sec ? `всего ${dur(p.total_sec)}` : ""}</span></header>
        ${p.state === "идёт" && p.step_name ? `<div class="gl-st">${esc(p.step_name)} <span>${dur(p.step_sec)}${p.progress?.pct != null ? ` · ${p.progress.pct} %` : ""}</span></div>
          ${p.progress?.pct != null ? `<div class="gl-bar"><i style="width:${p.progress.pct}%"></i></div>` : ""}
          <p class="gl-ln ${hang ? "warn" : ""}">${quiet < 45 ? "Шаг пишет в журнал, последнее сообщение" : `Шаг молчит ${dur(quiet)}${hang ? ` — возможно, завис (остановят после ${p.stale_min} мин тишины)` : ""}. Последнее сообщение`}: <q>${esc(p.last_line || "пока ничего")}</q></p>
          ${p.left_sec != null ? `<p class="gl-ln">До конца периода примерно ${dur(p.left_sec)}${p.pace && Math.abs(p.pace - 1) >= 0.08 ? ` · идёт на ${Math.round(Math.abs(1 - p.pace) * 100)} % ${p.pace < 1 ? "быстрее" : "медленнее"} прошлого матча` : ""}</p>` : ""}` : ""}
        ${p.state === "готов" && p.result ? `<div class="gl-st">Смен ${p.result.shifts} <span>на льду ${mmss(p.result.ice_sec)} · виден ${mmss(p.result.visible_sec)}</span></div>${p.result.warnings?.length ? `<ul class="gl-nt">${p.result.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}` : ""}
        ${p.state === "нет овертайма" ? `<p class="gl-ln">Овертайма в этом матче не было — считать нечего.</p>` : ""}
        ${p.state === "ждёт" ? `<p class="gl-ln">Ещё не начат.</p>` : ""}
        ${p.state === "ошибка" ? `<div class="gl-err"><b>Остановился${p.step_name ? ` на шаге «${esc(p.step_name)}»` : ""}.</b> ${esc(p.error || "Причина не записана.")}</div>` : ""}
        ${ladder ? `<details><summary>Шаги: готово ${p.done.length} из ${(L.steps || []).length}</summary><ul class="gl-sl">${ladder}</ul></details>` : ""}
        ${p.notes?.length ? `<details><summary>Заметки расчёта (${p.notes.length})</summary><ul class="gl-nt">${p.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></details>` : ""}
        ${p.tail?.length ? `<details${p.state === "ошибка" ? " open" : ""}><summary>Последние строки журнала шага</summary><pre>${esc(p.tail.join("\n"))}</pre></details>` : ""}</section>`;
    };
    const ev = [...(L.events || []), ...sys].sort((a, b) => b.t - a.t).filter((e) => !onlyBad || e.level === "error" || e.level === "warn");
    return `${head}<p>${esc(sum)}</p><p>${busy ? `Сводка обновлена ${dur(age)} назад, экран обновляется сам раз в 15 секунд.` : `Последняя сводка с машины — в ${clock(L.time)}.`}</p>${close}
      ${al.length ? `<ul class="gl-al">${al.map((a) => `<li class="${a.level}"><b>${a.level === "error" ? "Ошибка" : "Внимание"}</b>${esc(a.text)}</li>`).join("")}</ul>` : ""}
      <div class="gl-ps">${(L.periods || []).map(per).join("")}</div>${mach}
      <div class="gl-box"><h3>Что происходило</h3><div class="gl-f"><label><input type="checkbox" id="gl-bad"${onlyBad ? " checked" : ""}> только ошибки и предупреждения</label></div>
      ${feed(ev)}</div>`;
  }
  /* ---------- экран «Журнал»: запуски, отказы, очередь, жизнь машин, заявки — по всем заказам ---------- */
  const syslog = (days) => api("GET", { action: "syslog", days: String(days || 7) });
  const dayName = (t) => { const d = new Date(t * 1000), n = new Date(); const same = (a, b) => a.toDateString() === b.toDateString(); const y = new Date(n); y.setDate(n.getDate() - 1);
    return same(d, n) ? "Сегодня" : same(d, y) ? "Вчера" : d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" }); };
  function journalHtml(j, orders, onlyBad, days) {
    const now = j.now || Date.now() / 1000, from = now - days * 86400;
    const ev = (j.events || []).map((e) => ({ ...e }));
    for (const o of orders || []) if (o.created && o.created / 1000 >= from) ev.push({ t: Math.round(o.created / 1000), level: "info", sid: String(o.id), text: `Поступила заявка: №${o.number ?? "?"}${o.team ? ` «${o.team}»` : ""}${o.url ? ", видео " + String(o.url).replace(/^https?:\/\//, "").slice(0, 60) : ""}` });
    const list = ev.filter((e) => e.t >= from && (!onlyBad || e.level === "error" || e.level === "warn")).sort((a, b) => b.t - a.t);
    const M = j.machines || [], W = j.waiting || [];
    const nowLine = [M.length ? M.map((m) => `машина считает заказ #${esc(m.sid || "?")} (${esc({ RUNNING: "работает", STOPPED: "остановлена", STARTING: "запускается", PROVISIONING: "создаётся", STOPPING: "выключается" }[m.status] || m.status)})`).join(", ") : "машин в облаке нет",
      W.length ? `в ожидании запуска: ${W.map((x) => "#" + esc(x)).join(", ")}` : "",
      j.budget != null ? `сегодня потрачено ${Math.round(j.spent_today || 0)} из ${Math.round(j.budget)} ₽, запусков ${j.today ?? 0} из ${j.limit ?? "?"}` : ""].filter(Boolean).join(" · ");
    let day = "", rows = "";
    for (const e of list) {
      const d = dayName(e.t);
      if (d !== day) { rows += `<li class="gl-day">${esc(d)}</li>`; day = d; }
      rows += `<li class="${e.level}"><time>${clock(e.t)}</time><span class="who">${e.sid ? `<a href="#/admin/order/${esc(e.sid)}" data-go="${esc(e.sid)}">#${esc(e.sid)}</a>` : "система"}</span><span>${esc(e.text)}</span></li>`;
    }
    const bad = ev.filter((e) => e.t >= from && (e.level === "error" || e.level === "warn")).length;
    return `<div class="gl-top"><div><h2>Журнал системы</h2><p>Сейчас: ${nowLine}.</p><p>За ${days} дн.: событий ${ev.filter((e) => e.t >= from).length}, из них ошибок и предупреждений ${bad}. Обновляется сам раз в 30 секунд.</p></div><button class="gl-x" id="gl-x">Закрыть</button></div>
      <div class="gl-box"><div class="gl-f"><label><input type="checkbox" id="gl-bad"${onlyBad ? " checked" : ""}> только ошибки и предупреждения</label>
        <label>за <select id="gl-days">${[1, 3, 7, 14].map((d) => `<option value="${d}"${d === days ? " selected" : ""}>${d} дн.</option>`).join("")}</select></label></div>
      <ul class="gl-ev gl-j">${rows || `<li><time></time><span class="who"></span><span>${onlyBad ? "Ошибок и предупреждений нет." : "Событий пока нет: журнал ведётся с 17.11.2026."}</span></li>`}</ul></div>`;
  }
  function openJournal(orders) {
    if (!document.getElementById("gl-css")) { const s = document.createElement("style"); s.id = "gl-css"; s.textContent = LIVE_CSS; document.head.append(s); }
    document.querySelector(".gl")?.remove();
    const root = document.createElement("div"); root.className = "gl"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Журнал системы"); root.tabIndex = -1;
    root.innerHTML = `<div class="gl-in"><div class="gl-top"><div><h2>Журнал системы</h2><p>Загружаю…</p></div><button class="gl-x" id="gl-x">Закрыть</button></div></div>`; document.body.append(root); root.focus();
    let t = 0, alive = true, onlyBad = false, days = 7, last = null;
    const close = () => { alive = false; clearTimeout(t); root.remove(); };
    root.querySelector("#gl-x").onclick = close;
    const paint = () => {
      if (!alive || !last) return;
      const y = root.scrollTop; root.firstElementChild.innerHTML = journalHtml(last, typeof orders === "function" ? orders() : orders, onlyBad, days); root.scrollTop = y;
      root.querySelector("#gl-x").onclick = close;
      root.querySelector("#gl-bad").onchange = (e) => { onlyBad = e.target.checked; paint(); };
      root.querySelector("#gl-days").onchange = (e) => { days = +e.target.value; tick(); };
      root.querySelectorAll("[data-go]").forEach((a) => a.addEventListener("click", () => close()));
    };
    const tick = async () => {
      clearTimeout(t); if (!alive) return;
      try { last = await syslog(days); paint(); }
      catch (x) { if (!last) { root.firstElementChild.innerHTML = `<div class="gl-top"><div><h2>Журнал системы</h2><p>${esc(!key() ? "Нужен ключ видеокарты: кнопка с ключом в верхней панели." : x.message === "unknown_action" ? "Пускатель в облаке старой версии — журнала пока нет." : why(x))}</p></div><button class="gl-x" id="gl-x">Закрыть</button></div>`; root.querySelector("#gl-x").onclick = close; } }
      if (alive) t = setTimeout(tick, 30000);
    };
    root.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") close(); });
    tick();
    return close;
  }
  function openLive(o, first) {
    if (!document.getElementById("gl-css")) { const s = document.createElement("style"); s.id = "gl-css"; s.textContent = LIVE_CSS; document.head.append(s); }
    document.querySelector(".gl")?.remove();
    const root = document.createElement("div"); root.className = "gl"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Ход расчёта"); root.tabIndex = -1;
    root.innerHTML = `<div class="gl-in"></div>`; document.body.append(root); root.focus();
    let t = 0, alive = true, onlyBad = false, last = first || null;
    const open = new Set();                                    // раскрытые блоки не схлопываются при обновлении
    const close = () => { alive = false; clearTimeout(t); root.remove(); };
    const paint = () => {
      if (!alive || !last) return;
      const y = root.scrollTop; root.querySelectorAll("details").forEach((d, i) => { if (d.open) open.add(i); else open.delete(i); });
      root.firstElementChild.innerHTML = liveHtml(last, o, onlyBad);
      root.querySelectorAll("details").forEach((d, i) => { if (open.has(i)) d.open = true; }); root.scrollTop = y;
      root.querySelector("#gl-x").onclick = close;
      const cb = root.querySelector("#gl-bad"); if (cb) cb.onchange = () => { onlyBad = cb.checked; paint(); };
    };
    const tick = async () => {
      clearTimeout(t); if (!alive) return;
      try { last = await live(o.id); paint(); }
      catch (x) { if (!last) root.firstElementChild.innerHTML = `<div class="gl-top"><div><h2>Ход расчёта</h2><p>${esc(x.message === "unknown_action" ? "Пускатель в облаке старой версии — подробной сводки пока нет." : why(x))}</p></div><button class="gl-x" id="gl-x">Закрыть</button></div>`, root.querySelector("#gl-x").onclick = close; }
      if (alive && (!last || ["starting", "running", "waiting"].includes(last.state))) t = setTimeout(tick, 15000);
    };
    root.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") close(); });
    paint(); tick();
    return close;
  }

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
    server: "Пускатель в облаке споткнулся на этом запросе. Расчёт от этого не останавливается.",
    not_configured: "Пускатель ещё не подключён (GPU_API в config.js пуст).",
  };
  const why = (e) => WHY[e.message] || `Ошибка: ${e.message}`;

  /* автозапуска из формы заказа больше нет (15.11.2026): расчёт запускает владелец кнопкой в админке.
     Пустая функция оставлена для страниц со старым app.js из кэша браузера */
  function autoRun() {}

  const ST = { waiting: "ждём", starting: "машина создаётся", running: "считает", done: "готово", failed: "ошибка", killed: "остановлено", lost: "машины нет", none: "ждёт запуска" };
  function mountCard(el, o, onLaunch) {      // onLaunch — заявка ушла из «ждёт запуска»: админка перерисует карточку
    if (!el || !o) return () => {};
    let t = 0, alive = true, est = null, estErr = "", noGpu = false, last = null, lv = null, closeLive = null;   // noGpu — ссылка не VK: облако такой матч не считает; lv — живая сводка с машины
    const css = `<style>.gpu-st{font-size:14px;line-height:1.45;margin:6px 0 10px}.gpu-st b{display:block;font-size:15px}.gpu-st small{display:block;opacity:.7}
      .gpu-row{display:flex;gap:8px;flex-wrap:wrap}.gpu-row input{flex:1;min-width:0;padding:8px 10px;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit}
      .gpu-row button{padding:8px 12px;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;cursor:pointer}
      .gpu-row button.go{background:#3DFF2E;color:#111;border-color:#3DFF2E;font-weight:600}.gpu-row button:disabled{opacity:.5;cursor:default}.gpu-err{color:#ff6b5e;font-size:13px;margin-top:6px}
      .gpu-est{margin:0 0 14px;font-size:14px;line-height:1.4}.gpu-est dt{font-size:12px;opacity:.65;margin-top:8px}.gpu-est dd{margin:0;font-weight:600}
      .gpu-est dd small{display:block;font-weight:400;opacity:.7}.gpu-est dd.ok{color:#34d27b}.gpu-est dd.warn{color:#f2b53a}
      .gpu-live{margin:0 0 10px;padding:0;list-style:none;font-size:13px;line-height:1.4}.gpu-live li{padding:5px 0;border-top:1px solid rgba(255,255,255,.08);overflow-wrap:anywhere}
      .gpu-live .error{color:#ff6b5e}.gpu-live .warn{color:#f2b53a}</style>`;
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
      el.innerHTML = `${css}<h3>Видеокарта</h3><div class="gpu-st"><b>${esc(noGpu && st === "none" ? "на видеокарте не считается" : ST[st] || st)}</b>${s?.note && !(lv?.live && st !== "none" && /п\d|пОТ/.test(s.note)) ? `<span>${esc(s.note)}</span>` : ""}
        ${s?.periods ? `<small>периоды ${s.periods.join(", ")}${s.skipped?.length ? `; пропущен ${s.skipped.map((x) => x.period).join(", ")} (экзамен)` : ""}</small>` : ""}
        ${mins ? `<small>${mins} мин, около ${rub} ₽</small>` : ""}${s?.results?.length ? `<small>готовы: ${s.results.length} из ${s.periods?.length || "?"}; на Мак — tools/gpu.py fetch ${esc(s.job)}</small>` : ""}</div>
        ${lv?.live && st !== "none" ? `<ul class="gpu-live">${(lv.live.alerts || []).slice(0, 3).map((a) => `<li class="${a.level}">${esc(a.text.length > 150 ? a.text.slice(0, 150) + "…" : a.text)}</li>`).join("")}${(lv.live.periods || []).map((p) => `<li class="${p.state === "ошибка" ? "error" : ""}">${esc(perLine(p))}</li>`).join("")}</ul>` : ""}
        ${busy ? "" : `<dl class="gpu-est">${est ? `<dt>Периоды</dt><dd>${esc(perText(est.periods))}</dd>
          <dt>Оценка</dt><dd>≈ ${est.minutes} мин, ≈ ${est.rub} ₽ <small>потолок ${est.max_rub} ₽ (срок машины ${est.max_hours} ч)</small></dd>
          <dt>Запись в VK</dt><dd class="${est.vk.ready ? "ok" : "warn"}">${esc(est.vk.note)}</dd>
          ${est.busy ? `<dt>Видеокарта</dt><dd class="warn">занята (${esc(est.busy)}): расчёт встанет в очередь</dd>` : ""}
          <dt>Запусков сегодня</dt><dd class="${est.today >= est.limit ? "warn" : ""}">${est.today} из ${est.limit}</dd>
          ${est.budget ? `<dt>Потрачено сегодня</dt><dd class="${est.spent_today >= est.budget - 15 ? "warn" : ""}">${Math.round(est.spent_today)} из ${Math.round(est.budget)} ₽</dd>` : ""}` : `<dt>${noGpu ? "Почему" : "Оценка"}</dt><dd>${estErr ? esc(estErr) : "считаю…"}</dd>`}</dl>`}
        <div class="gpu-row">${busy ? `<button id="gpu-stop">Остановить</button>` : noGpu ? "" : `<button class="go" id="gpu-run">${st === "none" ? "Запустить расчёт" : "Запустить заново"}</button>`}${st !== "none" ? `<button id="gpu-live" title="Что машина делает прямо сейчас: шаги, ошибки, зависания, загрузка">Ход расчёта</button>` : ""}<button id="gpu-forget" title="Убрать ключ с этого устройства">Ключ</button></div>
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
      el.querySelector("#gpu-live")?.addEventListener("click", () => { closeLive = openLive(o, lv); });
      el.querySelector("#gpu-forget").addEventListener("click", () => { if (confirm("Убрать ключ видеокарты с этого устройства?")) { setKey(""); draw(); } });
    };
    const poll = async () => {
      clearTimeout(t);
      if (!key()) return draw();
      try {
        const s = await status(o.id); draw(s);
        const busy = ["starting", "running", "waiting"].includes(s.state);
        if (s.state && s.state !== "none") live(o.id).then((r) => { lv = r; if (last === s) draw(s); }).catch(() => {});   // старый пускатель сводку не отдаёт — карточка работает как раньше
        if (busy) t = setTimeout(poll, 20000);
        else if (!est && !estErr) estimate(o).then((e) => { est = e; draw(last); }).catch((x) => { estErr = why(x); noGpu = ["youtube", "not_vk"].includes(x.message); draw(last); });
        if (s.state && s.state !== "none" && mark(o.id, s.job, s.started ? s.started * 1000 : 0)) onLaunch?.();   // запущен раньше или с другого устройства
      } catch (x) {                     // разовый сбой запроса: прошлое состояние остаётся на экране, через 20 с пробуем снова
        draw(last, `${why(x)}${x.body?.detail ? ` (${x.body.detail})` : ""} Повторю запрос через 20 секунд.`);
        if (alive && x.message !== "need_key" && x.message !== "not_configured") t = setTimeout(poll, 20000);
      }
    };
    poll();
    return () => { alive = false; clearTimeout(t); closeLive?.(); };
  }

  window.GPU = { key, setKey, run, estimate, status, stop, ping, live, openLive, liveHtml, syslog, openJournal, journalHtml, autoRun, mountCard, ready: () => !!API_() };
})();
