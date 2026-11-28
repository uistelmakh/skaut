/* Клиентская часть прототипа. Без сборки и без сервера приложений.
   Название — window.BRAND (assets/config.js), настоящий заказ — window.ORDER,
   общее состояние с админкой — window.STORE (assets/store.js). Админка живёт в assets/admin.js. */
(() => {
  const B = window.BRAND, O = window.ORDER, PRICES = window.PRICES, OFFER = window.OFFER, VALUE = window.VALUE, ICE = window.ICE;
  const MARKERS = window.MARKERS, KITS = window.KITS, S = window.STORE;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const view = $("#view");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- время и форматы ---------- */
  const clockSec = (c) => { const [m, s] = c.split(":").map(Number); return m * 60 + s; };
  const at = (c) => (O.periodSec - clockSec(c)) / O.periodSec;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
  const hms = (t) => `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  const yt = (t) => `https://www.youtube.com/watch?v=${O.youtube}&t=${t}s`;
  const rub = (n) => n.toLocaleString("ru-RU").replace(/ /g, " ");
  const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; };
  const shiftBy = (n) => O.shifts.find((s) => s.n === n);
  const markerHex = (key) => (MARKERS.find((m) => m.key === key) || MARKERS[0]).hex;
  const kitBy = (key) => KITS.find((k) => k.key === key) || KITS[0];
  const T = O.totals;

  const ICON = {
    play: '<svg class="ico-play" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1.2v11.6a.6.6 0 0 0 .92.5l9.1-5.8a.6.6 0 0 0 0-1L2.92.7A.6.6 0 0 0 2 1.2z"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 7.5 12 4l4 3.5M6 12v7h12v-7"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h9v9M18 6 7 17"/></svg>',
    tg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 4.5 3.5 11l5.2 1.9M20.5 4.5 17 19l-8.3-6.1M20.5 4.5 8.7 12.9m0 0V18l3-2.9"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  };

  const jersey = (n, draw) => `<span class="jersey${draw ? " draw" : ""}"><b>${esc(n)}</b><svg viewBox="0 0 150 50" aria-hidden="true"><ellipse cx="75" cy="25" rx="70" ry="20" pathLength="100"/></svg></span>`;
  /* гол при игроке: забили — красная плашка, пропустили — бледно-красная с тёмно-красным текстом */
  const goalTag = (g) => g ? `<span class="tag ${g.mine ? "tag--plus" : "tag--minus"}">${g.mine ? "гол" : "пропустили"} ${esc(g.score)}</span>` : "";
  const goalOfShift = (n) => O.goals.find((g) => g.shift === n);

  /* ---------- табло ----------
     LED-цифры: каждая цифра — лента 0–9 дважды; в покое стоит на настоящем значении,
     при первом показе табло «прокручивается» к нему (класс .is-in, см. motion). Диктор читает текст из .vh */
  const led = (v) => `<span class="lv" aria-hidden="true">${[...String(v)].map((ch, k) => /\d/.test(ch)
    ? `<span class="odo"><span class="odo-s" style="--d:${ch};--k:${k}">${"0123456789".repeat(2).split("").join("\n")}</span></span>`
    : `<span class="odo-c">${esc(ch)}</span>`).join("")}</span><span class="vh">${esc(v)}</span>`;
  const board = (s) => (/^\d:\d\d$/.test(s) ? "0" + s : s);   // 8:48 → 08:48, как на табло арены

  function scoreboard(who) {
    const cell = (label, value) => `<li class="sb-c"><span class="sb-l">${label}</span><b class="led sb-v">${value}</b></li>`;
    return `<div class="sb" data-roll>
      <div class="sb-top"><span class="sb-team">${esc(O.team)}</span><b class="led sb-score">${led(O.scoreEnd)}</b><span class="sb-team">${esc(O.opp)}</span>
        <span class="sb-meta">№${O.number} · ${O.period}-й период · ${esc(O.date)}</span></div>
      <ul class="sb-grid" aria-label="Цифры периода">
        ${cell("На льду", led(board(T.toi)))}
        ${cell("Смены", led(T.shifts))}
        ${cell("Средняя", led(mmss(T.avgSec)))}
        ${cell(`Голы при ${who}`, `${led("+" + T.plus)} <span class="sb-minus">${led("−" + T.minus)}</span>`)}
      </ul>
    </div>`;
  }

  /* ---------- лента смен: кадр, время на льду на табло-плашке, гол обведён красным ---------- */
  function shiftCards() {
    return O.shifts.map((s) => {
      const g = goalOfShift(s.n);
      return `<button class="card${g ? (g.mine ? " card--goal" : " card--miss") : ""}" type="button" data-play="${s.n}" data-row="${s.n}" aria-label="Смотреть смену ${s.n}: ${s.c0} – ${s.c1} по табло, ${s.sec} секунд на льду${g ? `, ${g.mine ? "гол" : "пропустили"} ${esc(g.score)}` : ""}">
        <span class="card-frame"><img src="${O.media.frame(s.n)}" alt="" loading="lazy" decoding="async"><span class="led card-sec">${mmss(s.sec)}</span><span class="card-play" aria-hidden="true">${ICON.play}</span></span>
        <span class="card-foot"><b>Смена ${s.n}${g ? ` · <em>${g.mine ? "гол" : "пропустили"} ${esc(g.score)}</em>` : ""}</b><span>${s.c0} – ${s.c1}</span></span>
      </button>`;
    }).join("");
  }

  /* ---------- шкала периода: синие полосы — игрок на льду, красные черты — голы ---------- */
  function timeline(selected, { anim = false, who = "нём" } = {}) {
    let prev = -1;
    const goals = O.goals.map((g) => {
      const x = at(g.clock), up = x - prev < 0.06; prev = up ? prev : x;
      const cls = g.onIce ? (g.mine ? "plus" : "minus") : "off";
      return `<span class="tl-goal ${cls}${up ? " up" : ""}" style="left:${(x * 100).toFixed(2)}%" aria-hidden="true"><b>${esc(g.score)}</b></span>`;
    }).join("");
    const bars = O.shifts.map((s, i) => {
      const x = at(s.c0), w = at(s.c1) - x;
      return `<button class="tl-bar${s.n === selected ? " on" : ""}${w < 0.014 ? " thin" : ""}" type="button" data-shift="${s.n}" style="left:${(x * 100).toFixed(2)}%;width:${(w * 100).toFixed(2)}%;--i:${i}" aria-label="Смена ${s.n}, ${s.c0} – ${s.c1}, ${s.sec} секунд"></button>`;
    }).join("");
    return `<div class="tl-wrap">
      <p class="tl-cap"><span>20:00</span><span>Период по табло, счёт ${O.scoreStart} → ${O.scoreEnd}</span><span>0:00</span></p>
      <div class="tl"${anim ? " data-tl" : ""}><div class="tl-track">${bars}${goals}</div></div>
      <div class="tl-legend"><span class="sh"><i></i>№${O.number} на льду</span><span class="plus"><i></i>забили при ${who}</span><span class="minus"><i></i>пропустили при ${who}</span><span class="off"><i></i>гол без ${who === "тебе" ? "тебя" : "него"}</span>${selected ? `<span class="pick"><i></i>выбрана</span>` : ""}</div>
    </div>`;
  }

  function pickedCard(n) {
    const s = shiftBy(n), g = goalOfShift(n);
    return `<button class="thumb" type="button" data-play="${n}"><img src="${O.media.frame(n)}" alt=""><span class="thumb-play">${ICON.play}Смотреть<span class="vh"> смену ${n}</span></span><span class="len">${mmss(s.len)}</span></button>
      <div class="picked-info"><div><h3 class="u">Смена ${n}</h3><p>${s.c0} – ${s.c1} по табло ${goalTag(g)}</p></div><span class="u picked-sec">${s.sec}<small>с</small></span></div>`;
  }

  /* ролик 9:16 в рамке телефона; кнопка включает его со звуком */
  const reelBox = () => `<div class="reel" id="reel"><video src="${O.media.reel}" poster="${O.media.reelPoster}" playsinline preload="none" aria-label="Ролик ${O.media.reelLen} секунд: камера ведёт за игроком №${O.number}, под ним неоновый эллипс"></video><button class="reel-play" type="button" aria-label="Включить ролик"><span>${ICON.play}</span></button></div>`;


  function selectShift(n, root = view, show) {
    $$(".tl-bar", root).forEach((b) => b.classList.toggle("on", +b.dataset.shift === n));
    $$("[data-row]", root).forEach((b) => b.classList.toggle("on", +b.dataset.row === n));
    const p = $("#picked", root);
    if (p) { p.innerHTML = pickedCard(n); if (!reduced) p.animate?.([{ opacity: .4, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "cubic-bezier(.2,.8,.2,1)" }); }
    state.shift = n;
    if (show && p) { const r = p.getBoundingClientRect(); if (r.bottom > innerHeight - 90 || r.top < 70) p.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" }); }
  }

  /* ---------- состояние ---------- */
  const SCOPES = [["p1", "1-й период", "1-й"], ["p2", "2-й период", "2-й"], ["p3", "3-й период", "3-й"], ["game", "Вся игра", "Вся игра"]];
  const DRAFT = "scout.order.draft";
  /* черновик формы: ссылка, период, ник и список игроков (до V9 был один игрок полями number/kit/team) */
  const blankOrder = () => ({ url: "", scope: "game", players: [{ number: "", kit: "blue", team: "", howto: "", marker: "none" }] });
  const loadDraft = () => {
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT) || "{}"), b = blankOrder();
      const players = Array.isArray(d.players) && d.players.length ? d.players.slice(0, 5)
        : [{ number: d.number || "", kit: d.kit || "blue", team: d.team || "", howto: d.howto || "" }];
      return { url: d.url || b.url, scope: d.scope || b.scope, players: players.map((p) => ({ ...b.players[0], ...(d.marker ? { marker: d.marker } : {}), ...p })) };
    } catch { return blankOrder(); }
  };
  const saveDraft = () => { try { sessionStorage.setItem(DRAFT, JSON.stringify(state.order)); } catch { /* без хранилища черновик живёт до перезагрузки */ } };
  const state = { shift: 2, order: loadDraft(), sel: 0 };
  const CTA = "Получить смены";                 // без цены в кнопке: цены — в 3-м периоде
  const tgLink = (text) => `https://t.me/${B.telegram}?text=${encodeURIComponent(text)}`;
  const TEAM_MSG = "Привет! Хочу смены для всей команды.\nКоманда: \nИгроков: \nСсылка на игру: ";
  /* одна фраза о риске: говорится там, где человек решает (у кнопки и у цены) */
  const TRUST = "Платишь после того, как увидел свои смены. Не нашли в записи — не платишь.";
  const orderTrust = "Платишь после того, как увидел смены. Не нашли игрока в записи: ничего не платишь.";

  /* ================= ЛЕНДИНГ =================
     Концепция «Каток» (docs/design/DESIGN.md): страница — матч на льду, читается сверху вниз как игра.
     Центр льда (герой) → 1-й период (что приходит) → 2-й (почему и как) → 3-й (цены) → овертайм (вопросы) → сирена.
     Разметка катка — структура: красная центральная и синие линии делят секции. Цифры — из window.ORDER, цены — из config.js. */
  const line = (kind) => `<div class="line line--${kind}" aria-hidden="true"></div>`;
  const perHead = (label, id, title, lead = "") => `<header class="per-head"><span class="per-l">${label}</span><h2 class="u per-t" id="${id}">${title}</h2>${lead ? `<p class="per-lead">${lead}</p>` : ""}</header>`;
  const faceoff = (cls) => `<svg class="${cls}" viewBox="0 0 600 600" aria-hidden="true"><circle class="fo-ring" cx="300" cy="300" r="290"/><circle class="fo-dot" cx="300" cy="300" r="11"/></svg>`;

  /* финальная полоса «Сирена»: тёмная арена, свет гола сверху. Сетка в одну колонку — ничего не налезает */
  const endBand = (id, title, extra = "") => `<section class="siren" id="${id}" aria-labelledby="${id}-t">
      <div class="wrap siren-in">
        <span class="led siren-clock" aria-hidden="true">00:00</span>
        <h2 class="u siren-t" id="${id}-t">${title}</h2>
        ${extra}
        <div class="cta-row"><a class="btn btn--white btn--big" id="${id}-go" href="#/order">${CTA}</a><a class="link" href="https://t.me/${B.telegram}" target="_blank" rel="noopener">Написать в Telegram</a></div>
      </div>
    </section>`;

  function home() {
    const prices = PRICES.map((p) => `<div class="price${p.main ? " main" : ""}">
        <div class="price-top"><span class="price-t">${esc(p.title)}</span>${p.main ? `<span class="price-badge">выгодно</span>` : ""}</div>
        <div class="u price-p">${rub(p.price)}&nbsp;₽</div>
        ${p.games > 1 ? `<p class="price-per">${rub(p.per)} ₽ за игру, выгода ${p.save}%</p>` : ""}
        <p>${esc(p.note)}</p></div>`).join("");
    const vmax = Math.max(...VALUE.map((v) => v.price));
    const value = VALUE.map((v) => `<div class="vrow${v.us ? " us" : ""}">
        <div class="vrow-head"><span>${esc(v.label)}</span><b>${esc(v.text || rub(v.price) + " ₽")}</b></div>
        <div class="vbar"><i style="--w:${Math.max(0.035, v.price / vmax).toFixed(3)}"></i></div>
        ${v.src ? `<small>${esc(v.src)}</small>` : ""}</div>`).join("");
    const half = PRICES[1].per < ICE.min / 2;   // фраза про половину выхода на лёд показывается, только пока это правда
    const faq = [
      ["А если найдёт не меня?", "Каждую игру после ИИ проверяет человек, смену за сменой. Если мы не уверены, что это ты, такой смены в результате не будет. Не нашли тебя совсем? Ничего не платишь."],
      ["Какие трансляции подходят?", "Запись игры на VK Видео, YouTube или Rutube, где на спине виден номер. Лига любая. Видео с телефона и файлы из облака пока не разбираем. Вставь ссылку в форму: она сразу скажет, подходит или нет."],
      ["Можно заказать не себе?", "Да. Ребёнку, тренеру, другу: нужен только номер на спине и цвет формы. Можно сразу несколько игроков из одной игры. Видео приходит в Telegram тому, кто заказал, по личной ссылке."],
      ["Где мои данные?", `На сайте мы ничего не храним: заявка — это сообщение в Telegram, туда же приходят видео. Лица не распознаём: ищем по номеру и цвету формы. Подробно: <a class="link" href="#/privacy">что мы храним и зачем</a>.`],
      ["Как работает пакет?", `Берёшь 5 или 10 игр и присылаешь их, когда играешь. Пакет действует ${OFFER.packMonths} месяцев. Платишь после первого результата. Не нашли тебя в игре? Она не списывается.`],
    ].map(([q, a]) => `<details class="faq-item"><summary>${q}</summary><p>${a}</p></details>`).join("");
    const shifts = `${T.shifts} ${plural(T.shifts, "смена", "смены", "смен")}`;
    /* схема розыгрыша: пунктирная стрелка через три точки вбрасывания (координаты — центры трёх колонок) */
    const PLAY = "M236 50 C 360 -4, 470 104, 600 50 S 846 -4, 964 50";

    return `<div class="home">
    <section class="hero ice" aria-labelledby="hero-t">
      <div class="wrap hero-in">
        <div class="hero-txt">
          ${faceoff("hero-circle")}
          <h1 class="u hero-title" id="hero-t">Каждая смена&nbsp;—<br> отдельным<br> видео</h1>
          <p class="hero-sub">Пришли ссылку на трансляцию матча и номер на спине. ${esc(B.name)} найдёт игрока во всей записи и пришлёт в Telegram каждую его смену, время на льду, голы при нём и ролик 9:16 — с обводкой игрока или без, как выберешь.</p>
          <div class="cta-row"><a class="btn btn--accent btn--big" href="#/order">${CTA}</a><a class="more" href="#/result">Смотреть пример</a></div>
          <p class="hero-trust">${TRUST}</p>
        </div>
        <div class="hero-media">
          <div class="phone">${reelBox()}</div>
          <p class="hand hero-note"><svg class="hand-arrow" viewBox="0 0 60 30" aria-hidden="true"><path d="M56 19 C 42 7, 24 6, 6 15 M6 15 L17 6 M6 15 L19 21"/></svg><span>это №${O.number}, ${T.shifts} ${plural(T.shifts, "смена", "смены", "смен")} за период</span></p>
        </div>
      </div>
    </section>
    ${line("red")}

    <section class="per" id="p1" data-per="1-Й ПЕРИОД" aria-labelledby="p1-t">
      <div class="wrap">
        ${perHead("1-й период", "p1-t", "Что приходит в Telegram", `Настоящий заказ: №${O.number}, ${esc(O.team)} против ${esc(O.opp)}, ${O.period}-й период, ${esc(O.date)}. Вот что пришло после игры.`)}
        ${scoreboard("нём")}
        <div class="rail-head"><h3 class="u">${shifts}&nbsp;— каждая отдельным видео</h3><p>С выхода на лёд до скамейки. Время по табло трансляции. Нажми на смену, и она включится.</p></div>
        <div class="rail">${shiftCards()}</div>
        <div class="rail-foot"><button class="btn btn--line" type="button" data-play="all"><span>Все смены подряд одним видео</span><span class="rail-len">${mmss(O.media.allLen)}</span></button><a class="more" href="#/result">Открыть страницу результата</a></div>
        <div class="period">${timeline(null, { anim: true })}</div>
      </div>
    </section>
    ${line("blue")}

    <section class="per ice" id="how" data-per="2-Й ПЕРИОД" aria-labelledby="how-t">
      <div class="wrap">
        ${perHead("2-й период", "how-t", "Ты не хочешь&nbsp;— и не надо")}
        <div class="two">
          <div class="pain"><h3 class="hand">Не хочешь</h3>
            <ul><li>Перематывать два часа трансляции</li><li>Искать себя среди двадцати игроков</li><li>Гадать, сколько ты на самом деле играл</li><li>Резать видео для сторис руками</li></ul></div>
          <div class="solve"><h3 class="hand">Поэтому ${esc(B.name)}</h3>
            <ul><li>Ссылка и номер — минута</li><li>Каждая смена — отдельное видео</li><li>Время на льду до секунды по табло</li><li>Ролик 9:16, камера ведёт за тобой</li></ul></div>
        </div>
        <div class="wb" data-draw>
          <svg class="wb-path" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true">
            <defs><mask id="wb-m" maskUnits="userSpaceOnUse" x="0" y="-40" width="1200" height="180"><path class="wb-mask" d="${PLAY}" pathLength="1"/></mask></defs>
            <path class="wb-dash" d="${PLAY}" mask="url(#wb-m)"/><path class="wb-head" d="M950 29 L968 52 L939 53"/>
          </svg>
          <p class="hand wb-note">твоя часть — только первый шаг</p>
          <ol class="steps">
            <li style="--i:0"><span class="u step-n" aria-hidden="true">1</span><h3>Пришли ссылку и номер</h3><p>Трансляция с VK Видео, YouTube или Rutube, номер на спине и цвет формы. Можно сразу несколько игроков.</p></li>
            <li style="--i:1"><span class="u step-n" aria-hidden="true">2</span><h3>${esc(B.name)} ищет тебя в записи</h3><p>ИИ находит номер и цвет формы в каждом кадре, потом человек пересматривает каждую смену.</p></li>
            <li style="--i:2"><span class="u step-n" aria-hidden="true">3</span><h3>Видео приходят в Telegram</h3><p>Как только всё проверено: смены, время на льду, голы при тебе и ролик 9:16.</p></li>
          </ol>
        </div>
      </div>
    </section>
    ${line("blue")}

    <section class="per" id="prices" data-per="3-Й ПЕРИОД" aria-labelledby="pr-t">
      <div class="wrap">
        ${perHead("3-й период", "pr-t", "Цены", TRUST)}
        <div class="prices">${prices}</div>
        <p class="note">Пакет действует ${OFFER.packMonths} месяцев, игры из пакета присылаешь, когда играешь.</p>
        <div class="value">
          <div class="value-say"><h3 class="u">${PRICES[0].price}&nbsp;₽ за игру&nbsp;— дешевле одного выхода на лёд</h3>
            <p>${half ? `В пакете ${PRICES[1].per} ₽ за игру, это меньше половины выхода на лёд. ` : ""}Ручной разбор у видеоаналитика стоит в 8–25 раз дороже.</p></div>
          <div class="vrows">${value}</div>
        </div>

        <div class="season-wrap" id="season">
          <h3 class="u sub-t">Сезон — в твоём Telegram</h3>
          <p class="per-lead">Каждую игру присылаем в один и тот же чат. Вся история сезона остаётся у тебя: видно, сколько ты на самом деле играешь и как меняются цифры от игры к игре. На сайте мы ничего не храним.</p>
          <ul class="season">
            <li><h4>Смены</h4><p>Сколько раз выходил на лёд: за период, за игру, за сезон.</p></li>
            <li><h4>Минуты на льду</h4><p>Точное время и средняя смена. Видно, больше тебе дают играть или меньше.</p></li>
            <li><h4>Игры</h4><p>Все сыгранные матчи в одной переписке, у каждой смены своё видео.</p></li>
            <li><h4>Голы при тебе</h4><p>Плюс и минус: сколько забили и пропустили, пока ты был на льду.</p></li>
          </ul>
          <p class="note">Одна игра из примера: ${shifts}, ${T.toi} на льду, +${T.plus} −${T.minus}. С каждой новой игрой цифры складываются в сезон.</p>
        </div>

        <div class="team" id="team">
          <svg class="team-rink" viewBox="0 0 400 200" aria-hidden="true"><rect x="4" y="4" width="392" height="192" rx="64"/><path class="r" d="M200 4v192"/><path class="b" d="M140 4v192M260 4v192"/><circle cx="200" cy="100" r="34"/><circle cx="80" cy="60" r="20"/><circle cx="80" cy="140" r="20"/><circle cx="320" cy="60" r="20"/><circle cx="320" cy="140" r="20"/></svg>
          <h3 class="u team-t">Командам</h3>
          <div class="team-body"><p><b>Тренер или капитан?</b> Разберём всю команду с одной записи: смены и время на льду каждого игрока. Цену посчитаем под ваш состав.</p>
            <a class="btn btn--accent btn--big" href="${tgLink(TEAM_MSG)}" target="_blank" rel="noopener">${ICON.tg}Написать про команду</a></div>
        </div>
      </div>
    </section>
    ${line("red")}

    <section class="per ice" id="faq" data-per="ОВЕРТАЙМ" aria-labelledby="faq-t">
      <div class="wrap">
        ${perHead("Овертайм", "faq-t", "Вопросы")}
        <div class="faq">${faq}</div>
      </div>
    </section>
    ${line("goal")}

    ${endBand("end", "Твоя игра.<br> Твои смены.")}
    </div>`;
  }

  /* ================= РЕЗУЛЬТАТ ================= */
  function result(_, q = "") {
    const n = state.shift, own = /(^|&)own\b/.test(q), who = own ? "тебе" : "нём";
    return `<div class="res">
      <section class="r-hero ice" aria-labelledby="r-title">
        <div class="wrap">
          <div class="r-hero-in">
            <div class="r-id">
              <p class="r-done">${ICON.check}${own ? "Готово. Каждую смену проверил человек" : "Все смены игрока из трансляции. Каждую проверил человек"}</p>
              <h1 class="u r-title" id="r-title">${esc(O.team)}</h1>
              <p class="r-sub">против ${esc(O.opp)}, ${O.period}-й период, ${esc(O.date)}</p>
            </div>
            ${jersey(O.number, true)}
          </div>
          <div class="r-stats">${scoreboard(own ? "тебе" : "нём")}</div>
        </div>
      </section>
      ${line("red")}

      <section class="band" aria-labelledby="r-sh">
        <div class="wrap">
          ${perHead(`${O.period}-й период`, "r-sh", `${T.shifts} ${plural(T.shifts, "смена", "смены", "смен")}`, "Каждая смена — отдельное видео. Нажми, и она включится: там же ссылка на этот момент в трансляции и «Скачать».")}
          <div class="rail">${shiftCards()}</div>
          <div class="rail-foot"><button class="btn btn--line" type="button" data-play="all"><span>Все смены подряд: одно видео вместе с остановками игры</span><span class="rail-len">${mmss(O.media.allLen)}</span></button></div>
        </div>
      </section>

      <section class="band ice" aria-label="Период и ролик">
        <div class="wrap r-grid">
          <div class="r-main tile">
            <div class="blk-head"><h2 class="u blk-title">Период по секундам</h2><span>Нажми на полосу, чтобы выбрать смену</span></div>
            ${timeline(n, { who })}
            <div class="picked" id="picked">${pickedCard(n)}</div>
          </div>
          <aside class="r-side tile tile--dark">
            <h2 class="u blk-title">Ролик с обводкой</h2>
            <div class="phone">${reelBox()}</div>
            <span class="reel-mark"><i></i>Неоновая обводка, прожектор, ${O.media.reelLen} с</span>
            <div class="actions"><a class="btn btn--white" href="${O.media.reel}" download="smeny-${O.number}-rolik.mp4">${ICON.down}Скачать</a><button class="btn btn--line" type="button" data-share>${ICON.share}Поделиться</button></div>
          </aside>
        </div>
        <p class="wrap note">Время по табло. Если что-то не так, напиши в Telegram — переделаем без доплаты.</p>
      </section>

      ${own ? `<section class="band"><div class="wrap r-own">
        <div class="panel tile"><h2 class="u blk-title">Следующая игра на этой неделе?</h2>
          <p>${PRICES[1].games} игр за ${rub(PRICES[1].price)} ₽, это ${PRICES[1].per} ₽ за игру. Платишь после результата, пакет действует ${OFFER.packMonths} месяцев.</p>
          <div class="actions"><a class="btn btn--accent" href="#/order">Прислать следующую игру</a><button class="btn btn--line" type="button" data-share>${ICON.share}Скинуть в чат команды</button></div></div>
      </div></section>` : `${line("goal")}${endBand("want", `Это смены №${O.number}. Хочешь так же про себя?`,
        `<p class="siren-lead">Пришли ссылку на трансляцию своей игры и номер. Как всё будет готово, пришлём в Telegram все твои смены, время на льду и ролик. Игра стоит ${PRICES[0].price} ₽, платишь после результата. Не нашли тебя в записи — не платишь.</p>`)}`}
    </div>`;
  }

  /* ================= ФОРМА ЗАКАЗА ================= */
  /* Проверка ссылки прямо в поле. В демо это проверка по домену и виду адреса: саму запись не открываем. */
  function checkUrl(raw) {
    const v = (raw || "").trim();
    if (!v) return null;
    const bad = (text) => ({ ok: false, text });
    if (/\s/.test(v) || !/^(https?:\/\/)?[\w.-]+\.[a-zа-я]{2,}/i.test(v)) return bad("Это не похоже на ссылку. Скопируй адрес страницы с записью игры.");
    let u; try { u = new URL(/^https?:\/\//i.test(v) ? v : "https://" + v); } catch { return bad("Это не похоже на ссылку. Скопируй адрес страницы с записью игры."); }
    const h = u.hostname.replace(/^(www|m)\./, ""), path = u.pathname;
    const ok = (svc) => ({ ok: true, svc, text: `${svc}, подходит. Доступ к записи проверим сами.` });
    if (/(^|\.)youtube\.com$|^youtu\.be$/.test(h)) {
      if (path.startsWith("/playlist") || (u.searchParams.get("list") && !u.searchParams.get("v") && h !== "youtu.be")) return bad("Это плейлист. Нужна ссылка на одну игру.");
      if (/^\/(@|channel\/|c\/|user\/)/.test(path)) return bad("Это канал. Открой запись игры и скопируй её ссылку.");
      if (h === "youtu.be" ? path.length > 1 : (u.searchParams.get("v") || /^\/(live|embed|shorts)\/.+/.test(path))) return ok("YouTube");
      return bad("Не вижу здесь видео. Открой запись игры и скопируй её ссылку.");
    }
    if (/(^|\.)(vkvideo\.ru|vk\.com|vk\.ru)$/.test(h)) {
      if (/video-?\d+_\d+/.test(path + u.search) || /^\/(video|clip)/.test(path) && /\d/.test(path)) return ok("VK Видео");
      return bad("Это страница группы или профиля. Открой само видео и скопируй его ссылку.");
    }
    if (/(^|\.)rutube\.ru$/.test(h)) {
      if (/^\/(video|live\/video)\/[\w-]+/.test(path)) return ok("Rutube");
      return bad("Это канал или плейлист. Открой запись игры и скопируй её ссылку.");
    }
    if (/disk\.yandex|yadi\.sk|drive\.google|docs\.google|cloud\.mail\.ru|dropbox\.com|icloud\.com|t\.me$|telegram\.me$/.test(h)) return bad("Файлы из облака и видео с телефона пока не разбираем. Нужна запись трансляции на VK Видео, YouTube или Rutube.");
    return bad("С этого сайта пока не разбираем. Подходят VK Видео, YouTube и Rutube.");
  }

  /* Экран заказа (V10, вид V22): конфигуратор. Слева светлая площадка со свитерами игроков заявки, под выбранным — эллипс
     обводки его цветом. Справа белая карточка: ссылка, период, вкладки игроков, номер, команда, цвет формы, обводка.
     Несколько игроков — несколько заказов одной заявки (поле group): общая часть расчёта матча берётся из первого (A7). */
  const MAXP = 5;
  const SW = "M66 8 Q100 20 134 8 L172 22 Q190 30 193 48 L198 100 L164 106 L161 70 L161 162 Q100 170 39 162 L39 70 L36 106 L2 100 L7 48 Q10 30 28 22 Z";
  const onKit = (k) => (["white", "yellow"].includes(k) ? "#000" : "#fff");
  const svcName = (url) => checkUrl(url)?.ok ? checkUrl(url).svc : "";
  const numOk = (n) => /^\d{1,2}$/.test(n) && +n >= 1;
  /* обводка игрока в ролике — по желанию: «без обводки» или цвет из window.MARKERS */
  const HL = [{ key: "none", title: "Без обводки", hex: "" }, ...(window.MARKERS || [])];
  const hlBy = (k) => HL.find((m) => m.key === k) || HL[0];
  const hlName = (k) => k === "none" ? "без обводки" : `${hlBy(k).title.toLowerCase()} эллипс`;
  /* у каждого игрока свой цвет: цвет, который уже у другого игрока заявки, выбрать нельзя */
  const hlOwner = (key, me) => key === "none" ? -1 : state.order.players.findIndex((q, j) => j !== me && q.marker === key);
  const hlHtml = (i) => { const p = state.order.players[i];
    return HL.map((m) => { const own = hlOwner(m.key, i), busy = own >= 0;
      return m.key === "none"
        ? `<button type="button" class="o2-hlb o2-hl-none" data-hl="none" aria-pressed="${p.marker === "none"}">Без обводки</button>`
        : `<button type="button" class="o2-hlb o2-hl-c" data-hl="${m.key}" aria-pressed="${p.marker === m.key}"${busy ? ' aria-disabled="true"' : ""} aria-label="${m.title} эллипс${busy ? `, уже у игрока ${own + 1}` : ""}" title="${busy ? `Уже у игрока ${own + 1}` : m.title}" style="--c:${m.hex}"></button>`; }).join(""); };
  /* форма: в одной игре две команды, значит в заявке не больше двух цветов формы */
  const kitsOthers = (me) => [...new Set(state.order.players.filter((_, j) => j !== me).map((q) => q.kit))];
  const kitAllowed = (key, me) => { const others = kitsOthers(me); return others.length < 2 || others.includes(key); };
  const kitsTooMany = () => new Set(state.order.players.map((q) => q.kit)).size > 2;
  const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7"/></svg>';

  function jerseySvg(p, i) {
    const k = kitBy(p.kit), on = onKit(k.key), team = (p.team || "").toUpperCase();
    const fit = team.length > 11 ? ` textLength="118" lengthAdjust="spacingAndGlyphs"` : "";
    return `<svg class="o2-svg" viewBox="0 0 200 172" aria-hidden="true">
      <defs><clipPath id="o2c${i}"><path d="${SW}"/></clipPath></defs>
      <path class="o2-body" d="${SW}" fill="${k.hex}"${k.key === "white" ? ' stroke="rgba(0,0,0,.16)" stroke-width="1.5"' : ""}/>
      <g clip-path="url(#o2c${i})" fill="${on}" opacity=".9"><rect x="0" y="136" width="200" height="8"/><rect x="0" y="149" width="200" height="4"/><rect x="0" y="78" width="42" height="8"/><rect x="158" y="78" width="42" height="8"/></g>
      <path d="M78 11 Q100 25 122 11" fill="none" stroke="${on}" stroke-width="4" stroke-linecap="round"/>
      ${team ? `<text x="100" y="44" text-anchor="middle" class="o2-plate" fill="${on}"${fit}>${esc(team)}</text>` : ""}
      <text x="100" y="124" text-anchor="middle" class="o2-no" fill="${on}"${p.number ? "" : ' opacity=".28"'}>${esc(p.number || "00")}</text>
    </svg>`;
  }

  function stageRow() {
    const ps = state.order.players, sel = state.sel;
    const js = ps.map((p, i) => `<button type="button" class="o2-j${i === sel ? " on" : ""}" data-sel="${i}" aria-pressed="${i === sel}" aria-label="Игрок ${i + 1}${p.number ? `, номер ${esc(p.number)}` : ""}">
        <span class="o2-jtag">Игрок ${i + 1}</span>${jerseySvg(p, i)}<span class="o2-ring${p.marker && p.marker !== "none" ? " hl" : " hl-none"}" style="--hl:${hlBy(p.marker).hex || "transparent"}" aria-hidden="true"></span></button>`).join("");
    const add = ps.length < MAXP ? `<button type="button" class="o2-jadd" data-act="add"><span class="o2-jadd-sw" aria-hidden="true"><svg viewBox="0 0 200 172"><path d="${SW}"/></svg>${ICON.plus}</span><span>Ещё игрок</span></button>` : "";
    return js + add;
  }

  function stageTitle() {
    const nums = state.order.players.map((p) => p.number).filter(Boolean).map((n) => `№${esc(n)}`);
    const list = nums.length > 1 ? `${nums.slice(0, -1).join(", ")} и ${nums[nums.length - 1]}` : nums[0] || "";
    return list ? `Ищем в записи <b>${list}</b>` : "Впиши номер на спине";
  }

  function stageChips() {
    const o = state.order, svc = svcName(o.url), sc = SCOPES.find((s) => s[0] === o.scope);
    return `${svc ? `<span class="o2-chip ok"><i>${TICK}</i>${svc}, игра найдена</span>` : `<span class="o2-chip">Игра не выбрана</span>`}<span class="o2-chip">${o.scope === "game" ? "Вся игра, все периоды" : sc[1]}</span>`;
  }

  function tabsHtml() {
    const ps = state.order.players;
    return ps.map((p, i) => { const k = kitBy(p.kit);
      const tab = `<button type="button" role="tab" class="o2-tab" data-sel="${i}" aria-selected="${i === state.sel}"><i style="--c:${k.hex};--on:${onKit(k.key)}">${esc(p.number || "?")}</i>Игрок ${i + 1}</button>`;
      return ps.length > 1
        ? `<span class="o2-tabw${i === state.sel ? " on" : ""}" role="presentation">${tab}<button type="button" class="o2-tab-x" data-del="${i}" aria-label="Убрать игрока ${i + 1}" title="Убрать игрока ${i + 1}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></button></span>`
        : tab; }).join("")
      + (ps.length < MAXP ? `<button type="button" class="o2-tab-add" data-act="add" aria-label="Добавить игрока">${ICON.plus}</button>` : "");
  }

  function editorHtml() {
    const ps = state.order.players, i = state.sel, p = ps[i], k = kitBy(p.kit);
    const two = kitsOthers(i).length >= 2;
    const kits = KITS.map((x) => { const ok = kitAllowed(x.key, i);
      return `<button type="button" class="o2-kit" data-kit="${x.key}" aria-pressed="${p.kit === x.key}"${ok ? "" : ' aria-disabled="true"'} aria-label="${x.title} форма${ok ? "" : ", недоступно: в заявке уже две команды"}" title="${ok ? x.title : "В игре две команды: третий цвет формы не выбрать"}" style="--c:${x.hex}"></button>`; }).join("");
    return `<div class="o2-row">
        <div class="o2-f"><label for="o2-num">Номер</label><input class="o2-num" id="o2-num" data-f="number" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" enterkeyhint="next" placeholder="00" value="${esc(p.number)}" aria-describedby="o2-err-num"></div>
        <div class="o2-f"><label for="o2-team">Команда, как на табло</label><input class="o2-in o2-team" id="o2-team" data-f="team" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="next" maxlength="60" placeholder="Например, Эдмонтон" value="${esc(p.team)}" aria-describedby="o2-err-team"></div>
      </div>
      <p class="err" id="o2-err-num" role="alert" hidden>Номер на спине: от 1 до 99.</p>
      <p class="err" id="o2-err-team" role="alert" hidden>Напиши команду, как на табло.</p>
      <span class="o2-lbl" id="o2-kit-lbl">Цвет формы в этой игре: <b id="o2-kitname">${k.title.toLowerCase()}</b></span>
      <div class="o2-kits" role="group" aria-labelledby="o2-kit-lbl">${kits}</div>
      ${two ? `<p class="o2-hint o2-kit-note">В игре две команды, поэтому в заявке только два цвета формы. Чтобы взять другой цвет, поменяй его у остальных игроков.</p>` : ""}
      <p class="err" id="o2-err-kit" role="alert" hidden>В заявке больше двух цветов формы. В одной игре две команды — оставь два цвета.</p>
      <span class="o2-lbl" id="o2-hl-lbl">Обводка этого игрока в ролике: <b id="o2-hlname">${hlName(p.marker || "none")}</b></span>
      <div class="o2-hls" id="o2-hls" role="group" aria-labelledby="o2-hl-lbl">${hlHtml(i)}</div>
      <p class="o2-hint">Цветной эллипс под ногами, чтобы игрока сразу было видно. У каждого игрока свой цвет, можно без обводки.</p>
      ${p.howto || p.showHow ? `<div class="o2-f"><label for="o2-how">Приметы</label><input class="o2-in" id="o2-how" data-f="howto" autocomplete="off" enterkeyhint="next" maxlength="120" placeholder="Левша, белый шлем, капитан" value="${esc(p.howto)}"></div>`
        : `<button type="button" class="o2-more" data-act="how">+ Приметы, если номер плохо видно</button>`}
      ${ps.length > 1 ? `<button type="button" class="o2-del" data-act="del">Убрать игрока ${i + 1}</button>` : ""}`;
  }

  function order() {
    const o = state.order, n = o.players.length, svc = svcName(o.url);
    if (state.sel >= n) state.sel = 0;
    const scopes = SCOPES.map(([k, t, short]) => `<button type="button" data-scope="${k}" aria-pressed="${o.scope === k}" aria-label="${t}">${short}</button>`).join("");
    return `<div class="wrap o2-page">
      <header class="o2-head"><h1 class="u o2-h1">Кого ищем в записи?</h1><p>Ссылка на матч, номер и цвет формы. Остальное ${esc(B.name)} сделает сам.</p></header>
      <div class="o2">
      <section class="o2-stage" aria-label="Игроки в заявке">
        <div class="o2-chips" id="o2-chips">${stageChips()}</div>
        <div class="o2-jrow" id="o2-jrow">${stageRow()}</div>
        <div class="o2-foot"><p class="o2-title" id="o2-title" aria-live="polite">${stageTitle()}</p><p>ИИ ищет игрока по номеру и цвету формы, потом человек пересматривает каждую смену.</p></div>
      </section>

      <form id="order-form" class="o2-panel" novalidate aria-label="Заявка">
        <div class="o2-pbody">
          <div class="o2-sec">
            <label class="o2-lbl" for="f-url">Ссылка на игру</label>
            <div class="o2-link${svc ? " ok" : ""}" id="o2-link">
              <input class="o2-url" id="f-url" name="url" type="url" inputmode="url" autocomplete="url" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="VK Видео, YouTube или Rutube" value="${esc(o.url)}" aria-describedby="url-note err-url">
              <span class="o2-svc" id="svc">${svc}</span>
              <button type="button" class="o2-paste" id="o2-paste" hidden>Вставить</button>
            </div>
            <p class="url-note" id="url-note" role="status" hidden></p>
            <p class="err" id="err-url" role="alert" hidden>Нужна ссылка на запись игры: VK Видео, YouTube или Rutube.</p>
            <span class="o2-lbl o2-lbl--gap" id="scopes-lbl">Период</span>
            <div class="seg o2-seg" id="scopes" role="group" aria-labelledby="scopes-lbl">${scopes}</div>
            <p class="o2-hint">Нет ссылки под рукой? <button type="button" class="link" id="paste-demo">Заполнить примером</button></p>
          </div>


          <div class="o2-sec">
            <div class="o2-tabs" id="o2-tabs" role="tablist" aria-label="Игроки">${tabsHtml()}</div>
            <div class="o2-ed" id="o2-ed" role="tabpanel">${editorHtml()}</div>
          </div>

          <div class="o2-sec o2-trust"><p class="o2-trustline o2-trust-m">${orderTrust}</p>
            <label class="o2-agree"><input type="checkbox" id="f-agree"><span>Даю <a class="link" href="#/consent">согласие на обработку персональных данных</a>. Если заказываю за несовершеннолетнего, я его родитель или законный представитель.</span></label>
            <p class="err" id="err-agree" role="alert" hidden>Без согласия мы не сможем разобрать игру. Поставь галочку.</p>
            <p class="o2-legal">Условия работы и цены: <a class="link" href="#/terms">оферта</a>. Как обращаемся с данными: <a class="link" href="#/privacy">политика</a>. На сайте ничего не сохраняется: заявка уходит сообщением в Telegram, видео придёт туда же.</p></div>
        </div>

        <div class="o2-pfoot">
          <button class="btn btn--accent btn--big o2-go" type="submit">Отправить заявку в Telegram</button>
          <p class="o2-trustline">${orderTrust}</p>
        </div>
        <div class="o2-bar"><button class="btn btn--accent btn--big" type="submit">Отправить заявку в Telegram</button></div>
      </form>
      </div>
    </div>`;
  }

  function orderMessage(o, ids) {
    const sc = SCOPES.find((s) => s[0] === o.scope)[1].toLowerCase();
    const ps = o.players;
    const who = (p) => `№${p.number}, форма ${kitBy(p.kit).title.toLowerCase()}, ${p.team}, обводка: ${hlName(p.marker || "none")}${p.howto ? `. Приметы: ${p.howto}` : ""}`;
    const lines = ps.length === 1
      ? [`Привет! Хочу смены. Заказ №${ids[0]}`, `Игра: ${o.url}`, `Игрок: ${who(ps[0])}`]
      : [`Привет! Хочу смены для ${ps.length} игроков. Заявка №${ids[0]}`, `Игра: ${o.url}`, ...ps.map((p, i) => `${i + 1}. ${who(p)} (заказ №${ids[i]})`)];
    return [...lines, `Разобрать: ${sc}`, `Согласие на обработку данных: да (редакция от ${window.LEGAL.edition})`].join("\n");
  }

  function bindOrder() {
    const o = state.order, form = $("#order-form"), url = $("#f-url"), note = $("#url-note"), ed = $("#o2-ed"), tabs = $("#o2-tabs"), row = $("#o2-jrow");
    const setErr = (input, err, bad) => { if (!input) return; input.classList.toggle("bad", bad); input.setAttribute("aria-invalid", String(bad)); const e = $(err); if (e) e.hidden = !bad; };

    /* всё, что зависит от игроков, кроме полей редактора (их не трогаем, пока человек в них пишет) */
    const paint = () => {
      row.innerHTML = stageRow();
      $("#o2-title").innerHTML = stageTitle();
      tabs.innerHTML = tabsHtml();
      saveDraft();
    };
    const paintEditor = (focus) => { ed.innerHTML = editorHtml(); if (focus) $(focus, ed)?.focus({ preventScroll: true }); };
    const select = (i, focus) => { state.sel = i; paint(); paintEditor(focus); };
    const paintUrl = () => {
      const c = checkUrl(o.url);
      $("#o2-link").classList.toggle("ok", !!c?.ok);
      $("#svc").textContent = c?.ok ? c.svc : "";
      note.hidden = !c || c.ok; if (c && !c.ok) { note.textContent = c.text; note.className = "url-note no"; }
      $("#o2-paste").hidden = !navigator.clipboard?.readText || !!o.url;
      $("#o2-chips").innerHTML = stageChips();
      saveDraft();
    };
    const addPlayer = () => {
      if (o.players.length >= MAXP) return;
      const last = o.players[o.players.length - 1];
      const freeHl = HL.slice(1).find((m) => !o.players.some((q) => q.marker === m.key));
      o.players.push({ number: "", kit: last?.kit || "blue", team: last?.team || "", howto: "", marker: last && last.marker !== "none" && freeHl ? freeHl.key : "none" });
      select(o.players.length - 1, "#o2-num");
      $(".o2-j.on", row)?.animate?.([{ opacity: 0, transform: "translateY(16px) scale(.92)" }, { opacity: 1, transform: "none" }], { duration: reduced ? 1 : 420, easing: "cubic-bezier(0,1.085,.4,1)" });
    };

    /* ссылка и период */
    url.addEventListener("input", () => { o.url = url.value.trim(); if (url.classList.contains("bad") && checkUrl(o.url)?.ok) setErr(url, "#err-url", false); paintUrl(); });
    url.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#o2-num")?.focus(); } });
    $("#o2-paste").addEventListener("click", async () => {
      try { const t = (await navigator.clipboard.readText()).trim(); if (t) { url.value = t; o.url = t; paintUrl(); (checkUrl(t)?.ok ? $("#o2-num") : url)?.focus(); } }
      catch { url.focus(); toast("Вставь ссылку вручную: долгое нажатие в поле"); }
    });
    $("#scopes").addEventListener("click", (e) => { const b = e.target.closest("[data-scope]"); if (!b) return; o.scope = b.dataset.scope; $$("button", $("#scopes")).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); $("#o2-chips").innerHTML = stageChips(); saveDraft(); });

    /* выбор игрока: свитер на площадке или вкладка */
    /* убрать игрока: крестик на вкладке или кнопка в редакторе */
    const delPlayer = (i) => {
      if (o.players.length < 2) return;
      o.players.splice(i, 1);
      select(Math.max(0, Math.min(i < state.sel || i === o.players.length ? state.sel - 1 : state.sel, o.players.length - 1)));
      toast(`Игрок убран из заявки`);
    };
    const onPick = (e) => {
      const x = e.target.closest("[data-del]"); if (x) { delPlayer(+x.dataset.del); return; }
      const s = e.target.closest("[data-sel]"); if (s) { select(+s.dataset.sel); return; }
      if (e.target.closest('[data-act="add"]')) addPlayer();
    };
    row.addEventListener("click", onPick); tabs.addEventListener("click", onPick);

    /* редактор выбранного игрока */
    ed.addEventListener("input", (e) => {
      const f = e.target.dataset.f; if (!f) return; const p = o.players[state.sel];
      if (f === "number") { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 2); p.number = e.target.value; if (numOk(p.number)) setErr(e.target, "#o2-err-num", false); }
      else { p[f] = e.target.value.trim(); if (f === "team" && p.team.length > 1) setErr(e.target, "#o2-err-team", false); }
      paint();
    });
    ed.addEventListener("click", (e) => {
      const kb = e.target.closest("[data-kit]"), hb = e.target.closest("[data-hl]"), act = e.target.closest("[data-act]"), p = o.players[state.sel];
      if (kb) {
        if (kb.getAttribute("aria-disabled") === "true") { toast("В игре две команды: третий цвет формы не выбрать"); return; }
        p.kit = kb.dataset.kit;
        const mate = o.players.find((q, j) => j !== state.sel && q.kit === p.kit && q.team);   // та же форма — та же команда
        if (mate && !p.team) p.team = mate.team;
        paint(); paintEditor(); return;
      }
      if (hb) {
        if (hb.getAttribute("aria-disabled") === "true") { toast(hb.title); return; }
        p.marker = hb.dataset.hl; paint(); paintEditor(); return;
      }
      if (!act) return;
      if (act.dataset.act === "how") { p.showHow = true; paintEditor("#o2-how"); }
      if (act.dataset.act === "del") delPlayer(state.sel);
    });
    ed.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || !e.target.matches("input")) return; e.preventDefault();
      const ins = $$("input", ed), next = ins[ins.indexOf(e.target) + 1];
      if (next) next.focus(); else if (state.sel < o.players.length - 1) select(state.sel + 1, "#o2-num"); else $(".o2-go")?.focus();
    });
    ed.addEventListener("focusout", (e) => { if (e.target.dataset.f === "number" && e.target.value && !numOk(e.target.value)) setErr(e.target, "#o2-err-num", true); });


    $("#paste-demo").addEventListener("click", () => {
      Object.assign(o, { url: `https://www.youtube.com/watch?v=${O.youtube}`, scope: "p2", players: [{ number: "97", kit: "blue", team: "Эдмонтон", howto: "" }] });
      url.value = o.url; setErr(url, "#err-url", false);
      $$("button", $("#scopes")).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.scope === o.scope)));
      select(0); paintUrl();
    });

    /* липкая панель на телефоне не должна закрывать поле, в которое человек пишет */
    form.addEventListener("focusin", (e) => {
      const bar = $(".o2-bar"); if (!bar || getComputedStyle(bar).display === "none" || e.target.closest(".o2-bar")) return;
      requestAnimationFrame(() => { const r = e.target.getBoundingClientRect(), b = bar.getBoundingClientRect(); if (r.bottom > b.top - 16) window.scrollBy({ top: r.bottom - b.top + 40 }); });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let first = null;
      const urlGood = !!checkUrl(o.url)?.ok; setErr(url, "#err-url", !urlGood); if (!urlGood) { note.hidden = true; first = url; }
      if (!first) {
        const bad = o.players.findIndex((p) => !numOk(p.number) || p.team.length < 2);
        if (bad >= 0) {
          if (bad !== state.sel) select(bad);
          const p = o.players[bad];
          setErr($("#o2-num"), "#o2-err-num", !numOk(p.number)); setErr($("#o2-team"), "#o2-err-team", p.team.length < 2);
          first = !numOk(p.number) ? $("#o2-num") : $("#o2-team");
        }
      }
      if (!first && kitsTooMany()) { const e2 = $("#o2-err-kit"); if (e2) e2.hidden = false; first = $(".o2-kit", ed); }
      const agree = $("#f-agree");
      if (!first && agree && !agree.checked) { setErr(agree, "#err-agree", true); first = agree; }
      if (first) { first.focus({ preventScroll: true }); first.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" }); return; }
      openConfirm();
    });
    $("#f-agree")?.addEventListener("change", (e) => { if (e.target.checked) setErr(e.target, "#err-agree", false); });
    paintUrl();
  }

  /* перед отправкой: готовое сообщение, которое уйдёт автору. Отправляет его сам человек.
     Каждый игрок — свой заказ (свой номер, свой расчёт и своя страница результата), group — номер первого. */
  function openConfirm() {
    const o = state.order, n = o.players.length, ids = [];
    for (let i = 0; i < n; i++) {
      let id = S.nextId();
      if (!S.cloud) id = (ids[0] ?? id) + i;
      else while (ids.includes(id)) id = S.nextId();
      ids.push(id);
    }
    const msg = orderMessage(o, ids);
    openModal(`<div class="confirm">
      <div class="confirm-head"><h2 id="confirm-title">Проверь заявку</h2><button class="icon-btn" type="button" data-close aria-label="Закрыть"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      <p class="cap">Нажми кнопку: откроется Telegram с этим текстом. Там нажми «Отправить».</p>
      <pre class="msg">${esc(msg)}</pre>
      <div class="confirm-actions"><a class="btn btn--accent" id="send-order" href="${tgLink(msg)}" target="_blank" rel="noopener">${ICON.tg}Отправить в Telegram</a><button class="btn btn--ghost" data-close>Исправить</button></div>
      <p class="cap">Заявку получит Сергей, автор сервиса (@${esc(B.telegram)}). На сайте она не сохраняется, видео нигде не публикуется.</p></div>`);
    $("#send-order").addEventListener("click", () => {
      // на сайте ничего не сохраняем: заявка — это сообщение в Telegram, дальше всё там
      state.order = blankOrder(); state.sel = 0; saveDraft();
      setTimeout(() => {
        $(".confirm").innerHTML = `<div class="confirm-head"><h2 id="confirm-title">Заявка ушла в Telegram</h2><button class="icon-btn" type="button" data-close aria-label="Закрыть"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
          <p class="cap">Если Telegram не открылся или сообщение не отправилось, напиши <a class="link" href="https://t.me/${esc(B.telegram)}" target="_blank" rel="noopener">@${esc(B.telegram)}</a> и вставь текст заявки.</p>
          <p>Ответим в Telegram, видео смен и ролик пришлём туда же. На сайте ничего не сохраняется.</p>
          <div class="confirm-actions"><a class="btn btn--accent" href="#/" data-close>На главную</a></div>`;
      }, 400);
    });
  }

  /* ================= СТАТУС ЗАКАЗА ================= */
  const STEPS = [["Заказ принят", "Ждём твоё сообщение в Telegram"], ["ИИ смотрит игру", "Ищет игрока по номеру на спине"], ["Проверяем каждую смену", "Человек смотрит смены перед отправкой"], ["Готово", "Пришлём ссылку в Telegram"]];
  function findOrder(id) {
    const own = S.get(id);
    if (own) return { ...own, status: S.phase(own) };
    const demo = (window.ADMIN_DEMO?.orders || []).find((x) => String(x.id) === String(id));
    if (!demo) return null;
    return { ...demo, ...S.over(id), created: Date.now() - demo.createdMin * 60000 };
  }
  function status(id) {
    const o = findOrder(id);
    if (!o && S.cloud && S.online() === null) return `<div class="wrap st"><div class="st-head"><p class="cap">Заказ №${esc(String(id || "").slice(0, 12))}</p><h1 class="d2">Ищем заказ</h1><p class="lead">Секунду, загружаем статус.</p></div></div>`;
    if (!o) return `<div class="wrap st"><div class="st-refuse">
        <h1 class="d2">Заказ №${esc(String(id || "").slice(0, 12))} не нашли</h1>
        <p class="lead">Проверь ссылку из сообщения. Если заказ был, напиши нам в Telegram: найдём по нику.</p>
        <div class="hero-cta"><a class="btn btn--accent btn--big" href="https://t.me/${B.telegram}" target="_blank" rel="noopener">${ICON.tg}Написать в Telegram</a><a class="link" href="#/order">Новый заказ</a></div></div></div>`;
    const map = { new: 0, ai: 1, help: 2, ready: 2, sent: 3 };
    if (o.status === "refused") {
      return `<div class="wrap st"><div class="st-refuse">
        <svg class="st-ico" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36"/><path d="M40 22v24M40 56v2"/></svg>
        <h1 class="d2">Эту игру не получится разобрать</h1>
        <p class="lead">Номер не виден в записи: камера далеко, цифры на спине не читаются. Ничего не платишь.</p>
        <p class="lead">Пришли другую игру: нужна запись трансляции, где камера ближе.</p>
        <div class="hero-cta"><a class="btn btn--accent btn--big" href="#/order">Прислать другую игру</a><a class="link" href="https://t.me/${B.telegram}" target="_blank" rel="noopener">Написать в Telegram</a></div>
      </div></div>`;
    }
    const cur = map[o.status] ?? 0, isDone = cur === 3;
    const R = S.over(o.id).result;          // настоящий результат: страница по ссылке (tools/gpu.py publish)
    const steps = STEPS.map(([h, p], i) => `<li class="${i < cur || isDone ? "is-done" : i === cur ? "is-now" : ""}" style="--i:${i}">
        <span class="st-dot"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7"/></svg></span>
        <div><b>${h}</b><span>${i === cur && !isDone ? p : i < cur || isDone ? (i === 3 ? (R ? "Результат по ссылке справа" : "Готово") : i === 0 ? "Сообщение получили" : "Готово") : p}</span>${i === 0 && cur === 0 && o.msg ? `<a class="btn btn--small st-again" href="${tgLink(o.msg)}" target="_blank" rel="noopener">${ICON.tg}Открыть Telegram ещё раз</a>` : ""}</div></li>`).join("");
    const kit = kitBy(o.kit), tg = o.tg || o.client?.tg || "";
    return `<div class="wrap st">
      <div class="st-head">
        <p class="cap">Заказ №${esc(o.id)}</p>
        <h1 class="d2">${isDone ? "Смены готовы" : "Смены уже ищем"}</h1>
        <p class="lead">${isDone ? (R ? `Смены №${esc(o.number)} найдены по номеру и цвету формы: ${R.periods.length} ${plural(R.periods.length, "период", "периода", "периодов")}.` : `Мы нашли все смены №${esc(o.number)} и проверили каждую.`) : `Как всё будет готово, пришлём в Telegram${tg ? ` @${esc(tg)}` : " ответом на твоё сообщение"}, страницу можно закрыть.`}</p>
        ${!isDone && o.msg && cur > 0 ? `<p class="cap st-resend">Сообщение в Telegram не отправилось? <a class="link" href="${tgLink(o.msg)}" target="_blank" rel="noopener">Открыть Telegram ещё раз</a></p>` : ""}
      </div>
      <div class="st-grid">
        <ol class="st-steps" aria-live="polite">${steps}</ol>
        <div class="st-side">
          ${isDone ? (R ? `<a class="st-result" href="${esc(R.url)}" target="_blank" rel="noopener"><span class="sb-l">На льду</span><span class="led st-num">${board(mmss(R.toi))}</span><span>${R.shifts} ${plural(R.shifts, "смена", "смены", "смен")}</span><span class="btn btn--white">Открыть результат</span></a>${R.until ? `<p class="st-keep">Видео хранится до <b>${new Date(R.until * 1000 - 86400000).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</b>. Скачайте его на странице результата, чтобы оно осталось у вас.</p>` : ""}` : `<a class="st-result" href="#/result?own"><span class="sb-l">На льду</span><span class="led st-num">${board(T.toi)}</span><span>${T.shifts} ${plural(T.shifts, "смена", "смены", "смен")}</span><span class="btn btn--white">Открыть результат</span></a>`) : `
          <div class="st-soon" aria-label="Пример того, что придёт">
            <div class="st-soon-reel"><img src="${O.media.reelPoster}" alt="" loading="lazy"><svg viewBox="0 0 90 160" aria-hidden="true"><ellipse cx="45" cy="112" rx="24" ry="7"/></svg><b>№${esc(o.number)}</b></div>
            <div class="st-soon-txt"><b>Ролик появится здесь</b><span>И цифры игры: время на льду, смены, голы при игроке.</span>
              <div class="st-soon-nums" aria-hidden="true"><span><i data-v="0:00"></i>на льду</span><span><i data-v="00"></i>смен</span><span><i data-v="00 с"></i>средняя</span></div></div>
          </div>
          <div class="st-wait"><span class="st-tg" aria-hidden="true">${ICON.tg}</span><span>Ничего делать не нужно. Мы напишем, как только всё будет готово.</span></div>`}
          <div class="sum">
            <div><span>Игра</span><b>${esc(String(o.url).replace(/^https?:\/\/(www\.)?/, ""))}</b></div>
            <div><span>Игрок</span><b><i class="kit-dot" style="--c:${kit.hex}"></i>№${esc(o.number)}, ${esc(o.team)}</b></div>
            ${Array.isArray(o.groupIds) && o.groupIds.length > 1 ? `<div><span>В заявке</span><b>${o.groupIds.map((gid) => { const g = S.get(gid); const t = g ? `№${esc(g.number)}` : `заказ ${esc(gid)}`; return String(gid) === String(o.id) ? t : `<a class="link" href="#/status/${esc(gid)}">${t}</a>`; }).join(", ")}</b></div>` : ""}
            <div><span>Разобрать</span><b>${esc(String(o.period).toLowerCase())}</b></div>
          </div>
          ${isDone ? "" : `<button class="st-demo" id="st-demo" type="button">Демо: показать следующий шаг</button>`}
        </div>
      </div>
    </div>`;
  }
  let stopStatus = null;
  function bindStatus(id) {
    S.watch?.(id);   // в облаке догружаем заказ, открытый по ссылке из другого браузера
    const tick = () => { if (location.hash.includes(`status/${id}`)) { const html = status(id); if (view.dataset.sig !== html) { view.dataset.sig = html; view.innerHTML = html; view.classList.add("go-in", "settled"); bindStatusDemo(id); } } };
    view.dataset.sig = view.innerHTML;
    bindStatusDemo(id);
    const iv = setInterval(tick, 1000), off = S.on(tick);
    stopStatus = () => { clearInterval(iv); off(); };
  }
  function bindStatusDemo(id) {
    $("#st-demo")?.addEventListener("click", () => {
      const o = S.get(id);
      if (o) { const ph = S.phase(o); if (ph === "new") S.patch(id, { created: Date.now() - 3000 }); else if (ph === "ai") S.patch(id, { created: Date.now() - 10000 }); else S.patch(id, { status: "sent" }); }
      else S.patch(id, { status: "sent" });
    });
  }

  /* ================= ДАННЫЕ, СОГЛАСИЕ, ОФЕРТА, 404 =================
     Реквизиты — только из window.LEGAL (config.js). Редакция меняется там же. */
  const L = window.LEGAL;
  const contacts = () => `Telegram <a class="link" href="https://t.me/${esc(B.telegram)}" target="_blank" rel="noopener">@${esc(B.telegram)}</a>${L.email ? `, почта <a class="link" href="mailto:${esc(L.email)}">${esc(L.email)}</a>` : ""}`;
  const who = () => `${esc(L.name)}, ИНН ${esc(L.inn)}, ОГРНИП ${esc(L.ogrnip)}, ${esc(L.address)}`;
  const doc = (title, lead, blocks) => `<div class="wrap doc"><h1 class="d2">${title}</h1><p class="lead">${lead}</p>
      <p class="doc-ed">Редакция от ${esc(L.edition)}</p>
      ${blocks.map(([h, items]) => `<section><h2 class="d3">${h}</h2><ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul></section>`).join("")}
      <section class="doc-req"><h2 class="d3">Реквизиты</h2><ul><li>${esc(L.name)}</li><li>ИНН ${esc(L.inn)}</li><li>ОГРНИП ${esc(L.ogrnip)}</li><li>${esc(L.address)}</li><li>${contacts()}</li></ul></section>
      <p class="cap"><a class="link" href="#/terms">Оферта</a> · <a class="link" href="#/privacy">Политика обработки данных</a> · <a class="link" href="#/consent">Согласие на обработку данных</a> · <a class="link" href="#/">На главную</a></p></div>`;
  function privacy() {
    return doc("Политика обработки персональных данных", `Как ${esc(B.name)} собирает, хранит и удаляет данные. Документ издан во исполнение статьи 18.1 закона № 152-ФЗ «О персональных данных».`, [
      ["1. Оператор", [`Оператор персональных данных: ${who()}. Дальше «мы».`, `Связаться по вопросам данных: ${contacts()}.`]],
      ["2. Какие данные обрабатываем", [
        "Данные заказчика: имя и ник в Telegram, текст переписки, сведения об оплате (сумма, дата, номер платежа). Номер карты мы не получаем: его обрабатывает платёжный сервис ЮKassa.",
        "Данные игрока, которого указал заказчик: номер на форме, цвет формы, команда, приметы, ссылка на запись игры.",
        "Изображение игрока в записи трансляции и в видео смен, которые мы делаем из этой записи.",
        "Биометрические данные не обрабатываем. Лица не распознаём: игрока ищем по номеру на спине и цвету формы, которые назвал заказчик.",
      ]],
      ["3. Зачем", ["Чтобы выполнить заказ: найти смены игрока, посчитать время на льду, сделать видео смен и отправить результат.", "Чтобы связаться с заказчиком по заказу и ответить на вопросы.", "Чтобы принять оплату, выдать кассовый чек и вести налоговый учёт, как требует закон."]],
      ["4. На каком основании", ["Договор с заказчиком: публичная оферта на этом сайте (пункт 5 части 1 статьи 6 закона № 152-ФЗ).", "Согласие на обработку данных, которое заказчик даёт в форме заказа (пункт 1 части 1 статьи 6). За несовершеннолетнего игрока согласие даёт родитель или законный представитель.", "Требования налогового законодательства и закона № 54-ФЗ о кассовых чеках: для данных об оплате."]],
      ["5. Что делаем с данными", [
        "Собираем, записываем, храним, используем, передаём перечисленным ниже исполнителям, удаляем. Обработка смешанная: автоматическая на серверах и ручная проверка результата.",
        "Расчёт и временное хранение видео: Yandex Cloud (ООО «Яндекс.Облако»), серверы в России.",
        "Приём оплаты и кассовые чеки: ЮKassa (ООО НКО «ЮМани»).",
        "Переписка и отправка результата: Telegram. Этот канал связи выбирает сам заказчик, когда пишет нам. Серверы Telegram находятся за пределами России, поэтому переписка с нами означает трансграничную передачу данных.",
        "Мы не продаём данные, не передаём их для рекламы и не публикуем видео игрока. Публикация в соцсетях возможна только по отдельному письменному согласию игрока или его законного представителя.",
      ]],
      ["6. Сколько храним", [`Запись игры, видео смен и результаты лежат в облаке не дольше ${L.keepDays} дней после расчёта, затем удаляются автоматически.`, "Переписка в Telegram хранится, пока её не удалит заказчик или мы, но не дольше 1 года после последнего заказа.", "Сведения об оплате и чеки храним столько, сколько требует налоговое законодательство."]],
      ["7. Сайт", ["Сайт не сохраняет заявки и не ставит счётчики посещений и рекламы. Черновик формы хранится только в твоём браузере до закрытия вкладки.", "Сайт размещён на GitHub Pages, один шрифт загружается с Google Fonts. Эти сервисы технически получают IP-адрес и данные браузера при открытии страницы. Доступа к этим сведениям у нас нет."]],
      ["8. Твои права", ["Узнать, какие данные о тебе или о твоём ребёнке у нас есть, исправить их, потребовать удалить и отозвать согласие.", `Напиши «удалите мои данные» или свой вопрос: ${contacts()}. Ответим не позже 10 рабочих дней.`, "Если считаешь, что мы нарушаем закон, можешь пожаловаться в Роскомнадзор или в суд."]],
      ["9. Как защищаем", ["Доступ к данным заказов есть только у оператора, вход по паролю.", "Хранилища в облаке закрыты, ключи доступа в коде сайта не лежат.", "Данные удаляются по срокам из пункта 6."]],
    ]);
  }
  function consent() {
    return doc("Согласие на обработку персональных данных", "Ставя галочку в форме заказа, ты даёшь это согласие. Оно отдельное от оферты, как требует статья 9 закона № 152-ФЗ.", [
      ["Кому", [`Я даю согласие оператору: ${who()}.`]],
      ["На какие данные", ["Мои: имя и ник в Telegram, текст переписки.", "Игрока, которого я указал: номер на форме, цвет формы, команда, приметы, ссылка на запись игры, изображение игрока в этой записи и в видео смен."]],
      ["Зачем", ["Чтобы выполнить мой заказ: найти смены игрока, посчитать время на льду, сделать видео смен и прислать результат, а также для связи со мной по заказу."]],
      ["Что можно делать с данными", ["Сбор, запись, хранение, использование, передача исполнителям из политики обработки данных (Yandex Cloud, ЮKassa, Telegram), удаление. Автоматически и вручную.", "Я понимаю, что переписка через Telegram означает передачу данных на серверы за пределами России, и согласен на это."]],
      ["За несовершеннолетнего", ["Если игрок младше 18 лет, я подтверждаю, что я его родитель или законный представитель и даю согласие за него."]],
      ["Срок и отзыв", ["Согласие действует, пока выполняется заказ и хранятся его материалы, но не дольше 1 года с даты заявки.", `Я могу отозвать согласие в любой момент, написав: ${contacts()}. После отзыва данные удаляются в течение 10 рабочих дней, кроме сведений об оплате, которые хранятся по закону.`]],
    ]);
  }
  function terms() {
    const p1 = PRICES[0], p5 = PRICES[1], p10 = PRICES[2];
    return doc("Публичная оферта на оказание услуг", `Это предложение заключить договор на условиях ниже (статья 437 Гражданского кодекса РФ). Исполнитель: ${who()}.`, [
      ["1. Что делаем", [
        "Разбираем запись трансляции хоккейного матча по ссылке заказчика и находим смены игрока, которого указал заказчик: по номеру на форме и цвету формы.",
        "Результат: список смен со ссылками на моменты записи, время на льду и другие цифры по игре, видео каждой смены и общий ролик 9:16.",
        "Результат предназначен для личного некоммерческого использования заказчиком.",
      ]],
      ["2. Как заключается договор", [
        "Заказчик отправляет заявку через форму на сайте, она приходит нам сообщением в Telegram.",
        "Договор считается заключённым, когда заказчик оплачивает услугу (пункт 3 статьи 438 ГК РФ). Оплата означает полное согласие с этой офертой.",
      ]],
      ["3. Цена и оплата", [
        `Одна игра (все периоды): ${rub(p1.price)} ₽. Пакет ${p5.games} игр: ${rub(p5.price)} ₽. Пакет ${p10.games} игр: ${rub(p10.price)} ₽.`,
        "Оплата после результата: сначала присылаем результат, потом ссылку на оплату картой или через СБП. Карту заранее не просим и сами ничего не списываем.",
        "После оплаты приходит электронный кассовый чек.",
        "НДС не облагается: исполнитель применяет упрощённую систему налогообложения.",
      ]],
      ["4. Сроки", [
        `Результат присылаем в Telegram, как только он готов и проверен, но не позже ${L.doneDays} рабочих дней с получения заявки.`,
        "Если запись не подходит для разбора, сообщаем об этом раньше и ничего не берём.",
        "Подходят записи трансляций на VK Видео, YouTube и Rutube, где виден номер на спине. Видео с телефона и файлы из облака пока не разбираем.",
      ]],
      ["5. Если что-то не так", [
        "Не нашли игрока в записи: услуга не оказана, ничего не платишь. Из пакета такая игра не списывается.",
        `Нашли не все смены или ошиблись: напиши в течение ${L.fixDays} дней после результата, переделаем без доплаты.`,
        "Если переделка не помогла, вернём деньги за эту игру.",
      ]],
      ["6. Пакеты и возврат", [
        `Пакет действует ${OFFER.packMonths} месяцев с первой игры. Игры присылаешь, когда удобно.`,
        "От пакета можно отказаться в любой момент. Возвращаем деньги за неиспользованные игры по цене одной игры в этом пакете в течение 10 дней на тот же способ оплаты.",
        `Заявление на возврат: сообщение в Telegram${L.email ? " или на почту из реквизитов" : ""}.`,
      ]],
      ["7. Запись игры и права", [
        "Права на трансляцию принадлежат организатору соревнования. Мы не публикуем запись и видео смен, а делаем результат только для заказчика.",
        "Публиковать видео смен в открытом доступе заказчик может, только если это не нарушает права организатора соревнования и людей в кадре.",
        "Заказчик указывает своего игрока сам. Если заказчик заказывает разбор за другого человека, он подтверждает, что тот или его законный представитель не против.",
      ]],
      ["8. Ответственность", [
        "Наша ответственность по одному заказу ограничена суммой, которую заказчик за него заплатил.",
        "Мы не отвечаем за недоступность записи по вине площадки, где она размещена.",
      ]],
      ["9. Данные и споры", [
        'Персональные данные обрабатываются по <a class="link" href="#/privacy">политике обработки данных</a> и <a class="link" href="#/consent">согласию</a>.',
        `Претензии принимаем в Telegram${L.email ? " и на почту" : ""}, отвечаем в течение 10 дней. Если договориться не получилось, спор решает суд по законодательству РФ, с учётом закона «О защите прав потребителей».`,
        "Мы можем изменить оферту. Новая редакция действует для заказов, оплаченных после её публикации.",
      ]],
    ]);
  }
  function notFound() {
    return `<div class="wrap st"><div class="st-refuse"><span class="nf-board" aria-hidden="true"><span class="sb-l">Вне игры</span><span class="led nf-num" data-v="404"></span></span>
      <h1 class="d2">Такой страницы нет</h1><p class="lead">Ссылка устарела или в ней опечатка. Вот куда можно пойти.</p>
      <div class="hero-cta"><a class="btn btn--accent btn--big" href="#/">На главную</a><a class="link" href="#/result">Смотреть пример</a><a class="link" href="https://t.me/${B.telegram}" target="_blank" rel="noopener">Написать в Telegram</a></div></div></div>`;
  }

  /* ================= МАРШРУТЫ ================= */
  const ROUTES = { "": home, home, result, order, status, privacy, consent, terms };
  const NAV = { "": "home", home: "home", result: "result", order: "order", status: "order" };
  const TITLES = { home: "все смены из трансляции", result: `№${O.number} ${O.team}, ${T.toi} на льду`, order: "получить смены", status: "статус заказа", privacy: "политика данных", consent: "согласие на обработку данных", terms: "оферта", none: "страницы нет" };
  let jump = null;

  /* ---------- вход в админку по коду ----------
     Сервера нет, поэтому это шторка, а не защита: код проверяется в браузере, файлы админки лежат открыто.
     Храним не сам код, а его хэш. Новый код: python3 -c "import hashlib; print(hashlib.sha256(b'КОД').hexdigest())".
     Без кода скрипты и демо-заказы админки не грузятся. Вход помнится до закрытия вкладки. */
  const ADMIN_PIN_SHA256 = "9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0";
  const ADMIN_PIN_FNV = 0xb5edd2d5;          // запасной хэш для адресов без https (телефон в той же сети Wi-Fi)
  const GATE = "scout.admin.ok";
  let gateOk = false;
  const adminOk = () => { if (gateOk) return true; try { return sessionStorage.getItem(GATE) === "1"; } catch { return false; } };
  async function pinOk(pin) {
    if (window.crypto?.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("") === ADMIN_PIN_SHA256;
    }
    let h = 0x811c9dc5; for (const b of new TextEncoder().encode(pin)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
    return h === ADMIN_PIN_FNV;
  }
  function gate() {
    document.body.dataset.route = "gate";
    document.title = `${B.name}: вход для оператора`;
    view.className = "";
    view.innerHTML = `<div class="wrap gate"><form class="gate-card" id="gate-form" novalidate>
      <svg class="logo-mark gate-mark" viewBox="0 0 104 40" aria-hidden="true"><rect class="lm-line" x="0" y="19" width="104" height="2.5"/><rect class="lm-line" x="34" y="12" width="2.5" height="16"/><rect class="lm-line" x="69" y="12" width="2.5" height="16"/><path class="lm-stint" d="M44 6 H70 L63 34 H37 Z"/></svg>
      <h1 class="d3">Вход для оператора</h1>
      <label for="gate-pin">Код</label>
      <input class="input gate-pin" id="gate-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" enterkeyhint="go" aria-describedby="gate-err">
      <p class="err" id="gate-err" role="alert" hidden>Неверный код</p>
      <button class="btn btn--accent btn--big" type="submit">Войти</button>
      <a class="link" href="#/">На главную</a></form></div>`;
    const pin = $("#gate-pin"), err = $("#gate-err");
    pin.focus();
    pin.addEventListener("input", () => { err.hidden = true; pin.classList.remove("bad"); });
    $("#gate-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (await pinOk(pin.value.trim())) { gateOk = true; try { sessionStorage.setItem(GATE, "1"); sessionStorage.setItem("scout.admin.key", pin.value.trim()); } catch { /* помним до перезагрузки */ } S.sync?.(); mount(); return; }
      err.hidden = false; pin.classList.add("bad"); pin.select();
    });
  }

  /* подгрузка по требованию: админка и демо-заказы нужны только своим экранам */
  const lazy = {};
  const ASSET_V = "20261128a";                    // та же версия, что ?v= в index.html
  function need(src) {
    return lazy[src] ||= new Promise((done) => {
      const url = src + "?v=" + ASSET_V;      // версия: после выкладки браузер не берёт старую админку из кэша
      const el = src.endsWith(".css") ? Object.assign(document.createElement("link"), { rel: "stylesheet", href: url }) : Object.assign(document.createElement("script"), { src: url });
      el.onload = done; el.onerror = done; document.head.appendChild(el);
    });
  }
  function mount() {
    stopStatus?.(); stopStatus = null;
    const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
    const [route, ...rest] = path.replace(/\/$/, "").split("/");
    if (route === "cabinet") { location.replace("#/"); return; }   // кабинет убран 20.11, старые ссылки ведут на главную
    if (route === "admin" && !adminOk()) { window.ADMIN?.unmount?.(); delete document.body.dataset.app; gate(); return; }
    if ((route === "admin" && !window.ADMIN) || (route === "status" && !window.ADMIN_DEMO)) {
      need("data/admin_demo.js").then(() => route === "admin" ? Promise.all([need("assets/admin.css"), need("assets/admin.js")]) : null).then(mount);
      return;
    }
    closeSheet(true);
    if (route === "admin") {
      document.body.dataset.app = "admin";
      view.className = "";
      window.ADMIN ? window.ADMIN.mount(view, rest) : (view.innerHTML = "<p class='wrap'>Админка не загружена.</p>");
      return;
    }
    window.ADMIN?.unmount?.();
    delete document.body.dataset.app;
    const known = route in ROUTES, fn = known ? ROUTES[route] : notFound, nav = NAV[route] || (known ? "doc" : "none");
    const html = fn(rest[0], query);
    if (!html) return;
    view.className = "";
    view.innerHTML = html;
    document.body.dataset.route = nav;
    document.documentElement.style.setProperty("--mark", markerHex(O.marker));
    $$("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === nav));
    document.title = `${[B.name, B.product].filter(Boolean).join(" ")}: ${TITLES[route] || TITLES[nav] || TITLES.none}`;
    const own = /(^|&)own\b/.test(query);
    const cta = $(".top-cta"); if (cta) cta.textContent = route === "result" && !own ? "Хочу так же" : CTA;
    if (jump) { const el = document.getElementById(jump); jump = null; window.scrollTo(0, 0); if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "start" })); }
    else window.scrollTo(0, 0);
    showDock(true);
    /* часы в шапке: на главной идут вместе с прокруткой, на остальных страницах — подпись страницы */
    pers = nav === "home" ? $$("[data-per]", view) : [];
    if (pers.length) tickClock();
    else setClock(...(route === "result" ? [own ? "РЕЗУЛЬТАТ" : "ПРИМЕР", `№${O.number}`] : [CLOCK[route] || CLOCK.none, ""]));
    requestAnimationFrame(() => { view.classList.add("go-in"); motion(); });
    if (route === "order") bindOrder();
    if (route === "status") bindStatus(rest[0]);
  }
  /* переход с анимацией браузера; если она не началась за 400 мс (окно не рисуется, слабый телефон) — без неё. mount — ровно один раз */
  function go() {
    let done = false;
    const run = () => { if (done) return; done = true; mount(); };
    if (document.startViewTransition && !reduced && view.innerHTML) {
      const t = document.startViewTransition(run); [t.ready, t.finished, t.updateCallbackDone].forEach((p) => p.catch(() => {}));
      setTimeout(() => { if (!done) { t.skipTransition?.(); run(); } }, 400);
    } else run();
  }

  /* ---------- движение: одна система на весь сайт ----------
     (а) часы в шапке идут вместе с прокруткой главной; (б) цифры табло один раз «прокручиваются» к настоящему значению;
     (в) стрелка розыгрыша рисуется сама; (г) полосы смен на шкале выезжают по очереди. Больше на прокрутку ничего не движется.
     prefers-reduced-motion: классы .armed не ставятся — всё сразу в конечном виде, часы показывают только период. */
  let io = null;
  function motion() {
    io?.disconnect();
    const targets = $$("[data-tl], [data-roll], [data-draw]", view);
    if (reduced || !("IntersectionObserver" in window)) return;
    targets.forEach((el) => el.classList.add("armed"));
    io = new IntersectionObserver((ents) => ents.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target); e.target.classList.add("is-in");
    }), { threshold: 0.35 });
    targets.forEach((el) => io.observe(el));
  }

  /* часы-табло в шапке: период секции, которая на экране, и время от 20:00 до 0:00 по прокрутке внутри неё */
  const CLOCK = { order: "ЗАКАЗ", status: "СТАТУС", privacy: "ДАННЫЕ", consent: "СОГЛАСИЕ", terms: "ОФЕРТА", none: "ОФСАЙД" };
  const clk = $("#clock"), clkL = $("#clock-l"), clkT = $("#clock-t");
  let pers = [], clkRaf = 0;
  function setClock(label, time) {
    if (!clk) return;
    if (clkL.textContent !== label) clkL.textContent = label;
    if (clkT.textContent !== time) clkT.textContent = time;
    clk.classList.toggle("no-t", !time);
  }
  function tickClock() {
    clkRaf = 0;
    if (!pers.length) return;
    const a = scrollY + innerHeight * 0.45;                // точка отсчёта — чуть выше середины экрана
    let label = pers[0].dataset.per, left = O.periodSec;   // герой — центр льда до вбрасывания: 20:00
    for (const s of pers) {
      const top = s.getBoundingClientRect().top + scrollY;
      if (a < top) break;
      label = s.dataset.per;
      left = Math.round(O.periodSec * (1 - Math.min(1, (a - top) / s.offsetHeight)));
    }
    setClock(label, reduced ? "" : mmss(left));
  }
  const onClock = () => { if (pers.length && !clkRaf) clkRaf = requestAnimationFrame(tickClock); };
  window.addEventListener("scroll", onClock, { passive: true });
  window.addEventListener("resize", onClock, { passive: true });

  /* метки, где ИИ видит игрока в клипе смены: плеер открывает смену с этого момента */
  function loadMarks(cb) {
    if (window.TRY_MARKS) return cb();
    const sc = document.createElement("script"); sc.src = "data/try_marks.js"; sc.onload = cb; sc.onerror = cb; document.head.appendChild(sc);
  }

  /* ---------- нижнее меню прячется, когда листаешь вниз, и возвращается вверх ---------- */
  let lastY = 0;
  function showDock(on) { document.body.classList.toggle("dock-off", !on); }
  window.addEventListener("scroll", () => {
    const y = window.scrollY, dy = y - lastY;
    if (Math.abs(dy) > 6) { showDock(dy < 0 || y < 80); lastY = y; }
    if (window.innerHeight + y >= document.documentElement.scrollHeight - 4) showDock(true);
  }, { passive: true });

  /* ---------- шторка с видео и модальные окна ---------- */
  const sheet = $("#sheet"), sv = $("#sheet-video");
  let lastFocus = null;
  function openSheetFrame() {
    if (sheet.hidden) { lastFocus = document.activeElement; sheet.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add("open"))); document.body.style.overflow = "hidden"; }
  }
  function openSheet(what) {
    sheet.classList.remove("modal");
    const all = what === "all", n = all ? null : +what, s = all ? null : shiftBy(n), g = all ? null : goalOfShift(n);
    $("#sheet-title").textContent = all ? "Все смены подряд" : `Смена ${n}`;
    $("#sheet-meta").innerHTML = all ? `${T.shifts} смен одним видео, ${mmss(O.media.allLen)}` : `<span>${s.c0} – ${s.c1} по табло, на льду ${s.sec} с</span>${goalTag(g)}`;
    const src = all ? O.media.all : O.media.shift(n);
    $("#sheet-actions").innerHTML = (all ? "" : `<a class="btn" href="${yt(s.yt)}" target="_blank" rel="noopener">${ICON.out}В трансляции на ${hms(s.yt)}</a>`)
      + `<a class="btn btn--ghost" href="${src}" download="${all ? "vse-smeny" : "smena-" + n}.mp4">${ICON.down}Скачать</a>`;
    $("#sheet-nav").innerHTML = all ? "" : `<button data-play="${n - 1}" ${n === 1 ? "disabled" : ""}>Предыдущая</button><button data-play="${n + 1}" ${n === O.shifts.length ? "disabled" : ""}>Следующая</button>`;
    sv.src = src; sv.poster = all ? O.media.frame(1) : O.media.frame(n);
    if (!all && $("#picked")) selectShift(n);
    openSheetFrame();
    sv.play().catch(() => {});
    /* клип открывается на моменте, где ИИ видит игрока: в клипе смены его обводка уже вшита */
    if (!all) loadMarks(() => { const first = window.TRY_MARKS?.shifts?.[n]?.first ?? 2; const go = () => { if (sv.currentTime < first - 0.5) sv.currentTime = Math.max(0, first - 0.4); }; sv.readyState >= 1 ? go() : sv.addEventListener("loadedmetadata", go, { once: true }); });
    $$(".reel video").forEach((v) => { if (!v.muted) v.pause(); });
  }
  function openModal(html) {
    sheet.classList.add("modal");
    $("#sheet-modal").innerHTML = html;
    openSheetFrame();
    sheet.querySelector(".sheet-card").setAttribute("aria-labelledby", $("#sheet-modal h2")?.id || "sheet-title");
    $("#sheet-modal a, #sheet-modal button")?.focus();
  }
  function closeSheet(now) {
    if (sheet.hidden) return;
    sheet.classList.remove("open"); sv.pause(); document.body.style.overflow = "";
    const fin = () => { sheet.hidden = true; sheet.classList.remove("modal"); sv.removeAttribute("src"); sv.load(); $("#sheet-modal").innerHTML = ""; };
    now ? fin() : setTimeout(fin, 380);
    lastFocus?.focus?.();
  }

  function toast(text) { const t = $("#toast"); t.textContent = text; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2200); }
  async function share() {
    const url = window.SHARE_URL || new URL("result.html", location.href.split("#")[0]).href;
    const data = { title: `№${O.number} ${O.team}: ${T.shifts} смен, ${T.toi} на льду`, text: `Смены из трансляции: ${T.shifts} смен, ${T.toi} на льду`, url };
    try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); toast("Ссылка скопирована. Вставь её в чат"); } catch { toast("Скопируй ссылку из адресной строки"); }
  }

  /* ---------- события ---------- */
  document.addEventListener("click", (e) => {
    if (document.body.dataset.app === "admin") return;
    const t = e.target;
    const jumpLink = t.closest("[data-jump]");
    if (jumpLink) { jump = jumpLink.dataset.jump; if (/^#\/?(home)?$/.test(location.hash) || !location.hash) { e.preventDefault(); document.getElementById(jump)?.scrollIntoView({ block: "start" }); jump = null; } return; }
    if (t.closest("[data-close]")) { closeSheet(); return; }
    const bar = t.closest(".tl-bar");
    if (bar) { const n = +bar.dataset.shift; if ($("#picked")) selectShift(n, view, true); else openSheet(n); return; }
    const play = t.closest("[data-play]");
    if (play && !play.disabled) { e.preventDefault(); openSheet(play.dataset.play); return; }
    if (t.closest("[data-share]")) { share(); return; }
    const rp = t.closest(".reel-play");
    if (rp) { const box = rp.closest(".reel"), v = $("video", box); v.controls = true; v.play(); box.classList.add("playing"); return; }
  });
  document.addEventListener("keydown", (e) => {
    if (document.body.dataset.app === "admin") return;
    if (e.key === "Escape") closeSheet();
    if (e.key === "Tab" && !sheet.hidden) {   // фокус не уходит под открытое окно
      const f = $$("a[href], button:not([disabled]), video[controls]", sheet).filter((el) => el.offsetParent !== null); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener("hashchange", go);

  window.CLIENT = { closeSheet, openModal };
  $$("[data-brand]").forEach((el) => { el.textContent = B[el.dataset.brand]; });
  mount();
})();
