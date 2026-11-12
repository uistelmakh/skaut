/* Клиентская часть прототипа. Без сборки и без сервера приложений.
   Название — window.BRAND (assets/config.js), настоящий заказ — window.ORDER, демо кабинета — window.DEMO,
   общее состояние с админкой — window.STORE (assets/store.js). Админка живёт в assets/admin.js. */
(() => {
  const B = window.BRAND, O = window.ORDER, D = window.DEMO, PRICES = window.PRICES, OFFER = window.OFFER, VALUE = window.VALUE, ICE = window.ICE;
  const HERO = { src: "media/reel_hero.mp4", poster: "media/frames/reel_hero.jpg" };   // ролик без размытой заставки, лёгкий
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
  const maxSec = Math.max(...O.shifts.map((s) => s.sec));
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
  const goalTag = (g) => g ? `<span class="tag ${g.mine ? "tag--plus" : "tag--minus"}">гол ${esc(g.score)}</span>` : "";
  const goalOfShift = (n) => O.goals.find((g) => g.shift === n);

  /* ---------- шкала периода ---------- */
  function timeline(selected, legendTop) {
    let prev = -1;
    const goals = O.goals.map((g) => {
      const x = at(g.clock), up = x - prev < 0.09; prev = up ? prev : x;
      const cls = g.onIce ? (g.mine ? "plus" : "minus") : "";
      return `<div class="tl-goal ${cls}${up ? " up" : ""}" style="left:${(x * 100).toFixed(2)}%"><span><b>${esc(g.score)}</b></span><i></i></div>`;
    }).join("");
    const bars = O.shifts.map((s, i) => {
      const x = at(s.c0), w = at(s.c1) - x;
      return `<button class="tl-bar${s.n === selected ? " on" : ""}${w < 0.014 ? " thin" : ""}" data-shift="${s.n}" style="left:${(x * 100).toFixed(2)}%;width:${(w * 100).toFixed(2)}%;--i:${i}" aria-label="Смена ${s.n}, ${s.c0} – ${s.c1}, ${s.sec} секунд"></button>`;
    }).join("");
    const ruler = ["20:00", "15:00", "10:00", "5:00", "0:00"].map((t, i) => `<span style="left:${i * 25}%">${t}</span>`).join("");
    const legend = `<div class="tl-legend"><span class="sh"><i></i>на льду</span><span class="plus"><i></i>забили при тебе</span><span class="minus"><i></i>пропустили</span><span><i></i>без тебя</span><span class="pick"><i></i>выбрана</span></div>`;
    return `<div class="tl-wrap">${legendTop ? legend : ""}<div class="tl" data-tl>
      <div class="tl-goals">${goals}</div><div class="tl-track">${bars}</div><div class="tl-head"></div><div class="tl-ruler">${ruler}</div></div>
      ${legendTop ? "" : legend}</div>`;
  }

  function pickedCard(n) {
    const s = shiftBy(n), g = goalOfShift(n);
    return `<button class="thumb" data-play="${n}"><img src="${O.media.frame(n)}" alt=""><span class="play">${ICON.play}Смотреть<span class="vh"> смену ${n}</span></span><span class="len">${mmss(s.len)}</span></button>
      <div class="picked-info"><div><h3>Смена ${n}</h3><p>${s.c0} – ${s.c1} по табло ${goalTag(g)}</p></div><span class="num">${s.sec}<small>с</small></span></div>`;
  }

  function shiftRows(selected) {
    return O.shifts.map((s) => {
      const g = goalOfShift(s.n);
      return `<button class="shift${s.n === selected ? " on" : ""}" data-play="${s.n}" data-row="${s.n}">
        <span class="n">${s.n}</span>
        <span><span class="when">${s.c0} – ${s.c1} ${goalTag(g)}</span><span class="bar" style="--w:${(s.sec / maxSec).toFixed(3)}"></span></span>
        <span class="dur">${s.sec}<small>с</small></span><span class="go" aria-hidden="true">${ICON.play}</span></button>`;
    }).join("");
  }

  function selectShift(n, root = view, show) {
    $$(".tl-bar", root).forEach((b) => b.classList.toggle("on", +b.dataset.shift === n));
    $$(".shift", root).forEach((b) => b.classList.toggle("on", +b.dataset.row === n));
    const p = $("#picked", root);
    if (p) { p.innerHTML = pickedCard(n); p.animate?.([{ opacity: .4, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" }); }
    state.shift = n;
    if (show && p) { const r = p.getBoundingClientRect(); if (r.bottom > innerHeight - 90 || r.top < 70) p.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" }); }
  }

  /* ---------- состояние ---------- */
  const SCOPES = [["p1", "1-й период", "1-й"], ["p2", "2-й период", "2-й"], ["p3", "3-й период", "3-й"], ["game", "Вся игра", "Вся игра"]];
  const DRAFT = "scout.order.draft";
  const blank = { url: "", number: "", kit: "blue", team: "", howto: "", scope: "game", tg: "", who: "me", consent: false };
  const loadDraft = () => { try { return { ...blank, ...JSON.parse(sessionStorage.getItem(DRAFT) || "{}") }; } catch { return { ...blank }; } };
  const saveDraft = () => { try { sessionStorage.setItem(DRAFT, JSON.stringify(state.order)); } catch { /* без хранилища черновик живёт до перезагрузки */ } };
  const state = { shift: 2, order: loadDraft() };
  const RISK = ["Ничего не нужно делать", "Результат за сутки", "Оплата после результата", "Не нашли? Не платишь"];
  const riskList = (cls = "") => `<ul class="risk ${cls}">${RISK.map((r) => `<li>${ICON.check}<span>${r}</span></li>`).join("")}</ul>`;
  const pilot = OFFER.freeLeft > 0;
  const seats = () => `Осталось ${OFFER.freeLeft} ${plural(OFFER.freeLeft, "бесплатное место", "бесплатных места", "бесплатных мест")} из ${OFFER.freeTotal}`;
  const freePill = () => pilot ? `<p class="free"><i></i><span><b>${seats()}.</b> ${esc(OFFER.freeAsk)}.</span></p>` : "";
  const ctaText = () => pilot ? "Получить смены бесплатно" : `Получить смены за ${PRICES[0].price} ₽`;
  const tgLink = (text) => `https://t.me/${B.telegram}?text=${encodeURIComponent(text)}`;
  const TEAM_MSG = "Привет! Хочу смены для всей команды.\nКоманда: \nИгроков: \nСсылка на игру: ";

  /* ================= ЛЕНДИНГ ================= */
  function home() {
    const links = [2, 4, 7].map((n) => { const s = shiftBy(n); return `<a href="${yt(s.yt)}" target="_blank" rel="noopener"><b>${n}</b><span>${s.c0} по табло, трансляция на ${hms(s.yt)}</span><em>Открыть</em></a>`; }).join("");
    const steps = [
      ["Пришли ссылку и номер", "Трансляция с VK Видео, YouTube или Rutube, номер на спине и цвет формы. Сорок секунд."],
      ["ИИ находит каждую смену", "Он смотрит игру целиком и ищет тебя по номеру. Человек проверяет каждую смену."],
      ["Завтра всё в Telegram", "Ссылки на смены, цифры, видео и ролик. Платишь, только если увидел себя."],
    ].map(([h, p]) => `<div class="step"><div><h3 class="d3">${h}</h3><p>${p}</p></div></div>`).join("");
    const prices = PRICES.map((p) => `<article class="pcard${p.main ? " main" : ""}">
        <h3>${esc(p.title)}</h3>
        <p class="pcard-price"><span class="num">${rub(p.per)}</span><small>₽</small><em>${p.games > 1 ? "за игру" : "за одну игру"}</em></p>
        <p class="pcard-per">${p.games > 1 ? `${rub(p.price)} ₽ за пакет, выгода ${p.save}%` : "Без пакета и обязательств"}</p>
        <p class="pcard-note">${esc(p.note)}</p></article>`).join("");
    const vmax = Math.max(...VALUE.map((v) => v.price));
    const value = VALUE.map((v, i) => `<div class="vrow${v.us ? " us" : ""}" style="--i:${i}">
        <div class="vrow-head"><span>${esc(v.label)}</span><b>${esc(v.text || rub(v.price) + " ₽")}</b></div>
        <div class="vbar"><i style="--w:${Math.max(0.035, v.price / vmax).toFixed(3)}"></i></div>
        ${v.src ? `<small>${esc(v.src)}</small>` : ""}</div>`).join("");
    const half = PRICES[1].per < ICE.min / 2;   // фраза про половину выхода на лёд показывается, только пока это правда
    const faq = [
      ["А если найдёт не меня?", "Каждую игру после ИИ проверяет человек, смену за сменой. Если мы не уверены, что это ты, такой смены в результате не будет. Не нашли тебя совсем? Ничего не платишь."],
      ["Какие трансляции подходят?", "Запись игры на VK Видео, YouTube или Rutube, где на спине виден номер. Лига любая. Видео с телефона и файлы из облака пока не разбираем. Вставь ссылку в форму: она сразу скажет, подходит или нет."],
      ["Можно детскую игру?", "Да, с согласия родителей. Видео ребёнка видишь только ты по личной ссылке. Мы его никуда не публикуем."],
      ["Где мои данные?", `На серверах в России. Лица мы не распознаём: ищем по номеру и цвету формы. Удалим всё по первой просьбе. Подробно: <a class="link" href="#/privacy">что мы храним и зачем</a>.`],
      ["Как работает пакет?", `Берёшь 5 или 10 игр и присылаешь их, когда играешь. Пакет действует ${OFFER.packMonths} месяцев. Платишь после первого результата. Не нашли тебя в игре? Она не списывается.`],
    ].map(([q, a], i) => `<details class="faq-item"${i < 3 ? " open" : ""}><summary>${q}</summary><p>${a}</p></details>`).join("");

    return `<div class="wrap">
    <section class="hero">
      <div class="hero-copy">
        <h1 class="d1"><span>Все твои смены.</span><span>Без перемотки.</span></h1>
        <p class="lead rise" style="--d:1">Пришли ссылку на трансляцию игры и номер. Дальше ничего делать не нужно: завтра в Telegram каждая смена, время на льду и ролик.</p>
        <div class="hero-act rise" style="--d:3">
          ${freePill()}
          <div class="hero-cta"><a class="btn btn--accent btn--big" href="#/order">${ctaText()}</a><a class="link" href="#/result">Смотреть пример</a></div>
          ${riskList()}
          <p class="hero-parent">Играет ребёнок? Пришли его номер. Видео увидишь только ты.<br>Тренер или капитан? <a class="link" href="#/" data-jump="team">Разберём всю команду</a>.</p>
        </div>
      </div>
      <div class="hero-product rise" style="--d:2">
        <div class="hero-reelbox"><a class="reel hero-reel" href="#/result" aria-label="Открыть пример результата"><video src="${HERO.src}" poster="${HERO.poster}" autoplay muted loop playsinline preload="metadata" aria-label="Ролик без звука: камера ведёт за игроком №${O.number}, под ним зелёный эллипс"></video></a>
        <button class="reel-pause" id="hero-pause" type="button" aria-label="Поставить ролик на паузу" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-pause" d="M8 6v12M16 6v12"/><path class="i-play" d="M8 5.5v13l11-6.5z"/></svg></button></div>
        <div class="hero-stat">
          <span class="num" data-count="${T.toiSec}" data-fmt="clock">${T.toi}</span>
          <span class="cap">на льду за ${O.period}-й период</span>
          <div class="hero-mini"><div><b class="num" data-count="${T.shifts}">${T.shifts}</b><span>смен</span></div><div><b class="num">${T.avgSec}<small>с</small></b><span>средняя</span></div><div><b class="num"><span class="pm-plus">+${T.plus}</span><span class="pm-minus">−${T.minus}</span></b><span>голы при тебе</span></div></div>
        </div>
        <p class="hero-note">Настоящий заказ: №${O.number}, ${esc(O.team)} против ${esc(O.opp)}. Игра автора проекта.</p>
      </div>
    </section>

    <section class="teamband" id="team">
      <p><b>Тренер или капитан?</b> Разберём всю команду с одной записи: время на льду и смены каждого игрока. Цену посчитаем под вашу команду.</p>
      <a class="btn btn--small" href="${tgLink(TEAM_MSG)}" target="_blank" rel="noopener">${ICON.tg}Написать про команду</a>
    </section>

    <section class="sec try-sec" id="try">
      <div class="sec-head"><h2 class="d2">Нажми на любую смену</h2><p class="lead">Это настоящий период. Чёрные полосы показывают, когда №${O.number} был на льду. Нажми, и смена сразу играет.</p></div>
      <div class="try">
        <div class="try-screen" id="try-screen">
          <video id="try-video" muted playsinline loop preload="none" poster="${O.media.frame(TRY0)}" aria-label="Видео смены без звука. Игрок №${O.number} обведён в кадре, когда его видно"></video>
          <div class="try-label" id="try-label">${tryLabel(TRY0)}</div>
          <div class="try-hint" id="try-hint">${ICON.play}<span class="h-down">Нажми на полосу ниже</span><span class="h-side">Нажми на полосу справа</span></div>
        </div>
        <div class="try-tl">${timeline(TRY0, true)}</div>
      </div>
    </section>

    <section class="sec" id="incl">
      <div class="sec-head"><h2 class="d2">Что приходит после игры</h2><p class="lead">Четыре вещи. Всё на примере настоящего заказа.</p></div>
      <div class="incl">
        <div class="incl-item"><div><h3 class="d3">Ссылка на каждую смену</h3><p>Трансляция открывается ровно на начале смены. Перематывать не нужно.</p></div><div class="linkrow">${links}</div></div>
        <div class="incl-item"><div><h3 class="d3">Цифры игры</h3><p>Смены, время на льду, средняя смена и голы, пока ты был на площадке.</p></div>
          <div class="mini-stats"><div><span class="num" data-count="${T.shifts}">${T.shifts}</span><span class="cap">смен</span></div><div><span class="num" data-count="${T.toiSec}" data-fmt="clock">${T.toi}</span><span class="cap">на льду</span></div><div><span class="num">${T.avgSec}<small>с</small></span><span class="cap">средняя</span></div><div><span class="num"><span class="pm-plus">+${T.plus}</span> <span class="pm-minus">−${T.minus}</span></span><span class="cap">при голах</span></div></div></div>
        <div class="incl-item"><div><h3 class="d3">Ролик 9:16 с обводкой</h3><p>Кадр ведёт за тобой. Готов для сторис и чата команды.</p></div><a class="reel incl-reel" href="#/result" aria-label="Открыть ролик в примере"><img loading="lazy" src="${O.media.reelPoster}" alt="Кадр из ролика: игрок №19 в неоновой обводке"></a></div>
        <div class="incl-item"><div><h3 class="d3">Видео каждой смены</h3><p>Каждая смена отдельным файлом и все смены подряд одним видео.</p></div><div class="strip">${O.shifts.map((s) => `<button data-play="${s.n}" aria-label="Смена ${s.n}"><img loading="lazy" src="${O.media.frame(s.n)}" alt=""><b>${s.n}</b></button>`).join("")}</div></div>
      </div>
    </section>

    <section class="sec" id="how">
      <div class="sec-head"><h2 class="d2">Как это работает</h2><p class="lead">От тебя одна форма. Всю остальную работу делаем мы.</p></div>
      <div class="steps">${steps}</div>
    </section>

    <section class="sec" id="prices">
      <div class="sec-head"><h2 class="d2">Цены</h2><p class="lead">Платишь после того, как увидел свои смены.</p></div>
      ${freePill()}
      <div class="pcards">${prices}</div>
      <p class="pack-note">${esc(OFFER.packNote)}</p>
      <div class="value">
        <div class="value-say">
          <h3 class="d3">${PRICES[0].price} ₽ за игру. Дешевле, чем выход на лёд</h3>
          <p>${half ? `В пакете ${PRICES[1].per} ₽ за игру: меньше половины выхода на лёд. ` : ""}Ручной разбор у видеоаналитика стоит в 8–25 раз дороже.</p>
          <ul class="risk"><li>${ICON.check}<span>Платишь после результата</span></li><li>${ICON.check}<span>Не нашли? Не платишь</span></li></ul>
          <a class="btn btn--accent btn--big" href="#/order">${ctaText()}</a>
        </div>
        <div class="vrows" data-reveal>${value}</div>
      </div>
      <p class="team-note">Нужна вся команда? Для команды считаем отдельно, дешевле, чем каждому по игре. <a class="link" href="${tgLink(TEAM_MSG)}" target="_blank" rel="noopener">Напиши в Telegram</a></p>
    </section>

    <section class="sec" id="faq">
      <div class="sec-head"><h2 class="d2">Вопросы</h2><p class="lead">Коротко о том, что спрашивают чаще всего.</p></div>
      <div class="faq">${faq}</div>
    </section>

    <section class="final">
      <h2 class="d1"><span>Найди себя</span><span>на льду</span></h2>
      <div class="hero-cta"><a class="btn btn--accent btn--big" href="#/order">${ctaText()}</a><a class="link" href="https://t.me/${B.telegram}" target="_blank" rel="noopener">Написать в Telegram</a></div>
      ${riskList("risk--row")}
      <div class="foot"><span>Пример собран из настоящего заказа. Это игра автора проекта.</span><span>${esc(B.author)}, Telegram и Инстаграм @${esc(B.channel)}</span><span><a class="link" href="#/privacy">Данные</a> · <a class="link" href="#/terms">Условия</a></span></div>
    </section>
    </div>`;
  }

  /* ================= РЕЗУЛЬТАТ ================= */
  function result(_, q = "") {
    const n = state.shift, own = /(^|&)own\b/.test(q);
    const survey = `Привет! Отвечаю на три вопроса после бесплатной игры.\n1. Что из результата пригодилось: \n2. При какой цене это уже дорого: \n3. Прислать следующую игру за ${PRICES[0].price} ₽: да / нет`;
    return `<div class="wrap res">
      <div class="res-main">
        <div class="res-head rise">
          <div><p class="res-done">${ICON.check}${own ? "Готово. Каждую смену проверил человек" : "Все смены игрока из трансляции. Каждую проверил человек"}</p><h1>${esc(O.team)}</h1><p>против ${esc(O.opp)}, ${O.period}-й период<br>${esc(O.date)}</p></div>
          ${jersey(O.number, true)}
        </div>
        <div class="res-nums">
          <div class="stat-main rise" style="--d:1"><span class="num" data-count="${T.toiSec}" data-fmt="clock">${T.toi}</span><span class="cap">на льду</span></div>
          <div class="stat-row rise" style="--d:2">
            <div><span class="num" data-count="${T.shifts}">${T.shifts}</span><span class="cap">${plural(T.shifts, "смена", "смены", "смен")}</span></div>
            <div><span class="num"><span data-count="${T.avgSec}">${T.avgSec}</span><small>с</small></span><span class="cap">средняя смена</span></div>
            <div><span class="num"><span class="pm-plus">+${T.plus}</span> <span class="pm-minus">−${T.minus}</span></span><span class="cap">голы при тебе</span></div>
          </div>
        </div>
        <section class="res-block rise" style="--d:3"><div class="blk-head"><h2 class="d3">Период по секундам</h2><span class="cap">счёт ${O.scoreStart} → ${O.scoreEnd}</span></div>${timeline(n, true)}<div class="picked" id="picked">${pickedCard(n)}</div></section>
      </div>
      <aside class="res-side">
        <section class="res-block res-reel"><h2 class="d3">Ролик с обводкой</h2>
          <div class="reel" id="reel"><video src="${O.media.reel}" poster="${HERO.poster}" playsinline preload="none" aria-label="Ролик ${O.media.reelLen} секунд: камера ведёт за игроком №${O.number}, под ним зелёный эллипс"></video><button class="reel-play" aria-label="Включить ролик"><span>${ICON.play}</span></button></div>
          <span class="reel-mark"><i></i>Неоновая обводка, прожектор, ${O.media.reelLen} с</span>
          <div class="actions"><a class="btn" href="${O.media.reel}" download="smeny-${O.number}-rolik.mp4">${ICON.down}Скачать</a><button class="btn btn--ghost" data-share>${ICON.share}Поделиться</button></div>
        </section>
      </aside>
      <section class="res-block res-list"><h2 class="d3">Все смены</h2>
        <div class="shifts">${shiftRows(n)}</div>
        <button class="allrow" data-play="all"><span><b>Все смены подряд</b><span>Одно видео: смены целиком, вместе с остановками игры</span></span><span class="num">${mmss(O.media.allLen)}</span></button>
        <p class="res-foot">Время по табло. Если что-то не так, напиши в Telegram: переделаем бесплатно.</p>
      </section>
      ${own ? `${pilot ? `<section class="res-block res-ask" id="pilot-ask"><h2 class="d3">Три коротких вопроса</h2>
        <p>Эта игра была бесплатной. Взамен ответь на три вопроса, это минута.</p>
        <ol><li>Что из результата пригодилось?</li><li>При какой цене это уже дорого?</li><li>Прислать следующую игру за ${PRICES[0].price} ₽?</li></ol>
        <div class="actions"><a class="btn btn--accent" id="ask-go" href="${tgLink(survey)}" target="_blank" rel="noopener">${ICON.tg}Ответить в Telegram</a></div>
        <p class="cap">Откроется Telegram с готовым текстом, останется вписать ответы.</p>
      </section>` : ""}
      <section class="res-block res-next"><h2 class="d3">Следующая игра на этой неделе?</h2>
        <p>${PRICES[1].games} игр за ${rub(PRICES[1].price)} ₽, это ${PRICES[1].per} ₽ за игру. Платишь после результата, пакет действует ${OFFER.packMonths} месяцев.</p>
        <div class="actions"><a class="btn btn--accent" href="#/order">Прислать следующую игру</a><button class="btn btn--ghost" data-share>${ICON.share}Скинуть в чат команды</button></div>
      </section>` : `<section class="res-block res-guest" id="want"><h2 class="d2">Это смены №${O.number}. Хочешь так же про себя?</h2>
        <p class="lead">Пришли ссылку на трансляцию своей игры и номер. Завтра в Telegram получишь все свои смены, время на льду и ролик с обводкой. ${pilot ? `Первая игра бесплатно: ${seats().toLowerCase()}.` : `Игра стоит ${PRICES[0].price} ₽, платишь после результата.`}</p>
        <div class="hero-cta"><a class="btn btn--accent btn--big" id="want-go" href="#/order">${ctaText()}</a><a class="link" href="#/">Как это работает</a></div>
        ${riskList()}
      </section>`}
    </div>`;
  }

  /* ================= КАБИНЕТ ================= */
  function cabinet(arg) {
    if (arg === "empty") return `<div class="wrap cab"><div class="empty"><svg viewBox="0 0 150 60" aria-hidden="true"><ellipse cx="75" cy="30" rx="68" ry="22"/></svg><h1 class="d2">Здесь появятся твои игры</h1><p class="lead">Пришли первую игру. Завтра тут будут смены, время на льду и ролик.</p><a class="btn btn--accent btn--big" href="#/order">${ctaText()}</a></div></div>`;
    const games = D.games.map((g) => g.real ? { ...g, opp: O.opp, toiSec: T.toiSec, shifts: T.shifts, perToi: T.toiSec, perShifts: T.shifts, periods: 1 } : g);
    const last = games[games.length - 1], prev = games[games.length - 2];
    const dToi = last.perToi - prev.perToi, dSh = +(last.perShifts - prev.perShifts).toFixed(1);
    const bars = (key, fmt) => { const max = Math.max(...games.map((g) => g[key])); const min = Math.min(...games.map((g) => g[key])) * 0.82;
      return `<div class="bars">${games.map((g, i) => `<div class="${g.real ? "real" : ""}"><span>${fmt(g[key])}</span><i style="--h:${((g[key] - min) / (max - min)).toFixed(3)};--i:${i}"></i></div>`).join("")}</div><div class="bars-x">${games.map((g) => `<span>${g.date.replace(" января", " янв")}</span>`).join("")}</div>`; };
    const rows = [...games].reverse().map((g) => g.real
      ? `<a class="game" href="#/result"><h3>${esc(O.team)} – ${esc(g.opp)} <span class="tag tag--plus">настоящий заказ</span></h3><p>${g.date}, ${O.period}-й период</p><span class="num col2">${mmss(g.toiSec)}<small>на льду</small></span><span class="num col3">${g.shifts}<small>${plural(g.shifts, "смена", "смены", "смен")}</small></span></a>`
      : `<div class="game"><h3>${esc(O.team)} – ${esc(g.opp)}, ${g.score}</h3><p>${g.date}, вся игра</p><span class="num col2">${mmss(g.toiSec)}<small>на льду</small></span><span class="num col3">${g.shifts}<small>${plural(g.shifts, "смена", "смены", "смен")}</small></span></div>`).join("");
    const moments = [[2, "Гол 2:1, ты на льду"], [7, "Самая длинная смена"], [1, "Первая смена периода"], [11, "Концовка до сирены"]].map(([n, title]) => { const s = shiftBy(n);
      return `<button class="moment" data-play="${n}"><span class="thumb"><img loading="lazy" src="${O.media.frame(n)}" alt=""><span class="play">${ICON.play}Смотреть</span><span class="len">${mmss(s.len)}</span></span><h3>${title}</h3><p>Смена ${n}, ${s.sec} с, ${s.c0} по табло</p></button>`; }).join("");
    const delta = (v, f) => `<span class="delta">${v >= 0 ? "▲" : "▼"} ${f(Math.abs(v))}<i>к прошлой игре</i></span>`;
    const P = D.pack, left = P.size - P.used;
    const pucks = Array.from({ length: P.size }, (_, i) => `<i class="${i < P.used ? "used" : ""}" style="--i:${i}"></i>`).join("");
    return `<div class="wrap cab">
      <div class="cab-head rise"><div><h1>Мои игры</h1><p class="cap" style="margin-top:8px">№${O.number} ${esc(O.team)}, ${esc(D.month.toLowerCase())}</p><span class="demo-note"><i></i>${esc(D.note)}</span></div>${jersey(O.number, true)}</div>
      <div class="pack rise" style="--d:1">
        <div class="pack-l"><span class="num">${left}</span><div><b>${plural(left, "игра осталась", "игры осталось", "игр осталось")} из ${P.size}</b><span>Пакет действует до ${esc(P.until)}</span></div></div>
        <div class="pack-pucks" aria-hidden="true">${pucks}</div>
        <a class="btn btn--accent" href="#/order">${ICON.plus}Прислать игру</a>
      </div>
      <div class="charts">
        <div class="chart rise" style="--d:2"><h3>На льду за период, в среднем</h3><div class="kpi"><span class="num">${mmss(last.perToi)}</span>${delta(dToi, mmss)}</div>${bars("perToi", mmss)}</div>
        <div class="chart rise" style="--d:3"><h3>Смен за период, в среднем</h3><div class="kpi"><span class="num">${last.perShifts}</span>${delta(dSh, (v) => String(v).replace(".", ","))}</div>${bars("perShifts", (v) => String(v).replace(".", ","))}</div>
      </div>
      <section class="sec" style="padding-top:44px"><h2 class="d3" style="margin-bottom:16px">Лучшие моменты</h2><div class="moments">${moments}</div><p class="cap" style="margin-top:12px">Из игры 27 января, настоящие смены.</p></section>
      <section class="sec" style="padding-top:44px"><h2 class="d3" style="margin-bottom:16px">Игры</h2><div class="games">${rows}</div></section>
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

  function order() {
    const o = state.order;
    const kits = KITS.map((k) => `<button type="button" class="chip chip--dot" data-kit="${k.key}" aria-pressed="${o.kit === k.key}" aria-label="${k.title}" title="${k.title}" style="--c:${k.hex}"><i></i></button>`).join("");
    const scopes = SCOPES.map(([k, t, short]) => `<button type="button" data-scope="${k}" aria-pressed="${o.scope === k}" aria-label="${t}">${short}</button>`).join("");
    const who = [["me", "Я сам"], ["kid", "Мой ребёнок"]].map(([k, t]) => `<button type="button" data-who="${k}" aria-pressed="${o.who === k}">${t}</button>`).join("");
    return `<div class="wrap order">
      <form id="order-form" novalidate>
        <h1 class="d2 rise">Получить смены</h1>
        <p class="lead rise" style="--d:1">Сорок секунд. Дальше всё делаем мы, результат придёт в Telegram.</p>
        ${freePill()}
        <div class="form">
          <div class="field rise" style="--d:2"><label for="f-url">Ссылка на запись игры</label>
            <div class="input-wrap"><input class="input" id="f-url" name="url" type="url" inputmode="url" autocomplete="url" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="VK Видео, YouTube или Rutube" value="${esc(o.url)}" aria-describedby="url-note err-url"><span class="svc" id="svc"></span></div>
            <p class="url-note" id="url-note" role="status" hidden></p>
            <p class="err" id="err-url" role="alert" hidden>Нужна ссылка на запись игры: VK Видео, YouTube или Rutube.</p>
            <p class="hint">Нет ссылки под рукой? <button type="button" class="link" id="paste-demo">Заполнить примером</button></p></div>
          <div class="field rise" style="--d:3"><label for="f-num">Номер на спине и цвет формы</label>
            <div class="num-field"><input class="input num-input" id="f-num" name="number" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" enterkeyhint="next" placeholder="19" value="${esc(o.number)}" aria-describedby="err-num">
              <div class="preview" id="preview" aria-hidden="true"><div class="who"><span class="bub" id="pv-num">19</span><span class="fig"></span><span class="ell"></span></div></div></div>
            <p class="err" id="err-num" role="alert" hidden>Номер на спине: от 1 до 99.</p>
            <div class="chips kits" id="kits" role="group" aria-label="Цвет формы">${kits}</div>
            <p class="hint" id="kit-name" aria-live="polite"></p></div>
          <div class="field"><label for="f-team">За какую команду играет</label>
            <input class="input" id="f-team" name="team" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="next" maxlength="60" placeholder="Например, РМАТ" value="${esc(o.team)}" aria-describedby="err-team">
            <p class="err" id="err-team" role="alert" hidden>Напиши название команды, как на табло.</p></div>
          <div class="field"><label for="f-howto">Как узнать игрока <span class="opt">необязательно</span></label>
            <input class="input" id="f-howto" name="howto" autocomplete="off" enterkeyhint="next" maxlength="120" placeholder="Левша, белый шлем, капитанская «К»" value="${esc(o.howto)}"></div>
          <div class="field"><span class="lbl" id="lbl-scope">Период или вся игра</span><div class="seg" id="scopes" role="group" aria-labelledby="lbl-scope">${scopes}</div></div>
          <div class="field"><span class="lbl" id="lbl-who">Кто играет</span><div class="seg seg--2" id="who" role="group" aria-labelledby="lbl-who">${who}</div>
            <label class="check" id="consent-box" ${o.who === "kid" ? "" : "hidden"}><input type="checkbox" id="f-consent" ${o.consent ? "checked" : ""} aria-describedby="err-consent"><span>Я родитель или есть согласие родителей</span></label>
            <p class="err" id="err-consent" role="alert" hidden>Для детской игры нужно согласие родителей. Отметь галочку.</p></div>
          <div class="field"><label for="f-tg">Твой ник в Telegram <span class="opt">необязательно</span></label>
            <div class="input-wrap at"><span class="at-sign" aria-hidden="true">@</span><input class="input" id="f-tg" name="tg" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" maxlength="32" placeholder="ник без @" value="${esc(o.tg)}" aria-describedby="err-tg tg-hint"></div>
            <p class="err" id="err-tg" role="alert" hidden>Ник латиницей, 4–32 знака: буквы, цифры и «_». Или оставь поле пустым.</p>
            <p class="hint" id="tg-hint">Нет ника или не знаешь его? Оставь пустым: ответим на твоё сообщение в Telegram.</p></div>
        </div>
        <p class="cap order-privacy">${ICON.check}Видео видишь только ты, по личной ссылке. Ничего не публикуем, удалим по первой просьбе.</p>
        <div class="order-bar"><div class="ob-price"><span class="num">${pilot ? "0" : PRICES[0].price}<small>₽</small></span><span>${pilot ? "бесплатно, без карты" : "оплата после результата"}</span></div><button class="btn btn--accent" type="submit">Отправить заявку</button></div>
        <p class="cap order-legal">Отправляя заявку, соглашаешься с <a class="link" href="#/privacy">обработкой данных</a> и <a class="link" href="#/terms">условиями</a>.</p>
      </form>
      <aside class="order-aside"><div class="reel" style="max-width:340px"><video src="${HERO.src}" poster="${HERO.poster}" autoplay muted loop playsinline preload="metadata" aria-label="Пример ролика без звука: игрок №${O.number} в зелёной обводке"></video></div>
        <p class="cap" style="margin-top:14px;max-width:340px">Так выглядит ролик из настоящего заказа. Его и все смены пришлём завтра.</p>${riskList()}</aside>
    </div>`;
  }

  function orderMessage(o) {
    const sc = SCOPES.find((s) => s[0] === o.scope);
    return [`Привет! ${o.who === "kid" ? "Хочу смены ребёнка" : "Хочу свои смены"}. Заказ №${o.id}`, `Игра: ${o.url}`, `Номер: ${o.number}, форма ${kitBy(o.kit).title.toLowerCase()}`, `Играет за: ${o.team}`, o.howto ? `Как узнать: ${o.howto}` : "",
      `Разобрать: ${sc[1].toLowerCase()}`, o.who === "kid" ? "Игрок: ребёнок, согласие родителей есть" : "", o.tg ? `Ответить: @${o.tg}` : ""].filter(Boolean).join("\n");
  }

  function bindOrder() {
    const o = state.order, form = $("#order-form"), url = $("#f-url"), num = $("#f-num"), pv = $("#preview"), note = $("#url-note");
    const paint = () => {
      pv.style.setProperty("--mark", markerHex("neon")); pv.style.setProperty("--kit", kitBy(o.kit).hex);
      $("#pv-num").textContent = o.number || "19";
      $("#kit-name").textContent = `Форма: ${kitBy(o.kit).title.toLowerCase()}`;
      const c = checkUrl(o.url);
      $("#svc").innerHTML = c?.ok ? `<span class="tag">${c.svc}</span>` : "";
      note.hidden = !c; if (c) { note.textContent = c.text; note.className = `url-note ${c.ok ? "ok" : "no"}`; }
      saveDraft();
    };
    const setErr = (input, err, bad) => { input.classList.toggle("bad", bad); input.setAttribute("aria-invalid", String(bad)); $(err).hidden = !bad; };
    const numOk = () => /^\d{1,2}$/.test(o.number) && +o.number >= 1;
    const RULES = [[url, "#err-url", () => !!checkUrl(o.url)?.ok], [num, "#err-num", numOk], [$("#f-team"), "#err-team", () => o.team.length > 1], [$("#f-tg"), "#err-tg", () => !o.tg || /^[a-zA-Z0-9_]{4,32}$/.test(o.tg)]];
    const heal = (input) => { const r = RULES.find((x) => x[0] === input); if (r && input.classList.contains("bad") && r[2]()) setErr(input, r[1], false); };
    url.addEventListener("input", () => { o.url = url.value.trim(); heal(url); paint(); if (!$("#err-url").hidden) note.hidden = true; });
    num.addEventListener("input", () => { num.value = num.value.replace(/\D/g, "").slice(0, 3); o.number = num.value; if (num.value.length > 2) setErr(num, "#err-num", true); else heal(num); paint(); });
    $("#f-team").addEventListener("input", (e) => { o.team = e.target.value.trim(); heal(e.target); saveDraft(); });
    $("#f-howto").addEventListener("input", (e) => { o.howto = e.target.value.trim(); saveDraft(); });
    $("#f-tg").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/^.*t(elegram)?\.me\//i, "").replace(/^@+/, "").replace(/[\s/?#].*$/, ""); o.tg = e.target.value; heal(e.target); saveDraft(); });
    RULES.forEach(([input, err, ok]) => input.addEventListener("blur", () => { if (input.value && !ok()) { setErr(input, err, true); if (input === url) note.hidden = true; } }));
    /* Enter ведёт в следующее поле и отправляет только из последнего */
    const chain = [url, num, $("#f-team"), $("#f-howto"), $("#f-tg")];
    chain.forEach((input, i) => input.addEventListener("keydown", (e) => { if (e.key === "Enter" && i < chain.length - 1) { e.preventDefault(); chain[i + 1].focus(); } }));
    $("#f-consent").addEventListener("change", (e) => { o.consent = e.target.checked; $("#err-consent").hidden = true; saveDraft(); });
    const press = (box, attr, key) => $$("button", box).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === key)));
    $("#paste-demo").addEventListener("click", () => {
      Object.assign(o, { url: `https://www.youtube.com/watch?v=${O.youtube}`, number: "19", kit: "blue", team: O.team, scope: "p2", tg: "demo_player", who: "me", consent: false });
      url.value = o.url; num.value = o.number; $("#f-team").value = o.team; $("#f-tg").value = o.tg; $("#consent-box").hidden = true;
      $$("input", form).forEach((i) => { i.classList.remove("bad"); i.removeAttribute("aria-invalid"); }); $$(".err", form).forEach((e) => { e.hidden = true; });
      press($("#kits"), "kit", o.kit); press($("#scopes"), "scope", o.scope); press($("#who"), "who", o.who); paint();
    });
    $("#kits").addEventListener("click", (e) => { const b = e.target.closest("[data-kit]"); if (b) { o.kit = b.dataset.kit; press($("#kits"), "kit", o.kit); paint(); } });
    $("#scopes").addEventListener("click", (e) => { const b = e.target.closest("[data-scope]"); if (b) { o.scope = b.dataset.scope; press($("#scopes"), "scope", o.scope); saveDraft(); } });
    $("#who").addEventListener("click", (e) => { const b = e.target.closest("[data-who]"); if (!b) return; o.who = b.dataset.who; press($("#who"), "who", o.who); $("#consent-box").hidden = o.who !== "kid"; if (o.who !== "kid") $("#err-consent").hidden = true; saveDraft(); });
    /* липкая панель не должна закрывать поле, в которое человек пишет */
    form.addEventListener("focusin", (e) => {
      const bar = $(".order-bar"); if (!bar || getComputedStyle(bar).position !== "sticky" || e.target.closest(".order-bar")) return;
      requestAnimationFrame(() => { const r = (e.target.closest(".field") || e.target).getBoundingClientRect(), b = bar.getBoundingClientRect(); if (r.bottom > b.top - 12) window.scrollBy({ top: r.bottom - b.top + 28 }); });
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let first = null;
      for (const [input, err, ok] of RULES) { const good = ok(); setErr(input, err, !good); if (!good && !first) first = input; }
      const needConsent = o.who === "kid" && !o.consent; $("#err-consent").hidden = !needConsent;
      if (needConsent && !first) first = $("#f-consent");
      if ($("#err-url").hidden === false) note.hidden = true;   // одна подсказка у поля, не две
      if (first) { first.focus(); first.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" }); return; }
      openConfirm();
    });
    paint();
  }

  /* перед отправкой: готовое сообщение, которое уйдёт автору. Отправляет его сам человек */
  function openConfirm() {
    const o = { ...state.order, id: S.nextId() };
    const msg = orderMessage(o);
    openModal(`<div class="confirm">
      <div class="confirm-head"><h2 id="confirm-title">Проверь сообщение</h2><button class="icon-btn" type="button" data-close aria-label="Закрыть"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      <p class="cap">Нажми кнопку: откроется Telegram с этим текстом. Там нажми «Отправить». Больше ничего делать не нужно.</p>
      <pre class="msg">${esc(msg)}</pre>
      <div class="confirm-actions"><a class="btn btn--accent" id="send-order" href="${tgLink(msg)}" target="_blank" rel="noopener">${ICON.tg}Отправить в Telegram</a><button class="btn btn--ghost" data-close>Исправить</button></div>
      <p class="cap">Заявку получит Сергей, автор сервиса (@${esc(B.telegram)}). Видео нигде не публикуется.</p></div>`);
    $("#send-order").addEventListener("click", () => {
      S.add({ id: o.id, created: Date.now(), url: o.url, number: +o.number, kit: o.kit, team: o.team, howto: o.howto, scope: o.scope, tg: o.tg, who: o.who, msg,
        period: SCOPES.find((s) => s[0] === o.scope)[1], real: o.url.includes(O.youtube) ? "game" : "" });
      state.order = { ...blank }; saveDraft();
      closeSheet(true);
      setTimeout(() => { location.hash = `#/status/${o.id}`; }, 60);
    });
  }

  /* ================= СТАТУС ЗАКАЗА ================= */
  const STEPS = [["Заказ принят", "Ждём твоё сообщение в Telegram"], ["ИИ смотрит игру", "Ищет игрока по номеру на спине"], ["Проверяем каждую смену", "Человек смотрит смены перед отправкой"], ["Готово", "Пришлём ссылку в Telegram до 20:00"]];
  function findOrder(id) {
    const own = S.get(id);
    if (own) return { ...own, status: S.phase(own) };
    const demo = (window.ADMIN_DEMO?.orders || []).find((x) => String(x.id) === String(id));
    if (!demo) return null;
    return { ...demo, ...S.over(id), created: Date.now() - demo.createdMin * 60000 };
  }
  function status(id) {
    const o = findOrder(id);
    if (!o) return `<div class="wrap st"><div class="st-refuse">
        <h1 class="d2">Заказ №${esc(String(id || "").slice(0, 12))} не нашли</h1>
        <p class="lead">Проверь ссылку из сообщения. Если заказ был, напиши нам в Telegram: найдём по нику.</p>
        <div class="hero-cta"><a class="btn btn--accent btn--big" href="https://t.me/${B.telegram}" target="_blank" rel="noopener">${ICON.tg}Написать в Telegram</a><a class="link" href="#/order">Новый заказ</a></div></div></div>`;
    const map = { new: 0, ai: 1, help: 2, ready: 2, sent: 3 };
    if (o.status === "refused") {
      return `<div class="wrap st"><div class="st-refuse rise">
        <svg class="st-ico" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36"/><path d="M40 22v24M40 56v2"/></svg>
        <h1 class="d2">Эту игру не получится разобрать</h1>
        <p class="lead">Номер не виден в записи: камера далеко, цифры на спине не читаются. Ничего не платишь.</p>
        <p class="lead">Пришли другую игру: нужна запись трансляции, где камера ближе. Её разберём бесплатно.</p>
        <div class="hero-cta"><a class="btn btn--accent btn--big" href="#/order">Прислать другую игру</a><a class="link" href="https://t.me/${B.telegram}" target="_blank" rel="noopener">Написать в Telegram</a></div>
      </div></div>`;
    }
    const cur = map[o.status] ?? 0, isDone = cur === 3;
    const steps = STEPS.map(([h, p], i) => `<li class="${i < cur || isDone ? "is-done" : i === cur ? "is-now" : ""}" style="--i:${i}">
        <span class="st-dot"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7"/></svg></span>
        <div><b>${h}</b><span>${i === cur && !isDone ? p : i < cur || isDone ? (i === 3 ? "Ссылка на результат уже в Telegram" : i === 0 ? "Сообщение получили" : "Готово") : p}</span>${i === 0 && cur === 0 && o.msg ? `<a class="btn btn--small st-again" href="${tgLink(o.msg)}" target="_blank" rel="noopener">${ICON.tg}Открыть Telegram ещё раз</a>` : ""}</div></li>`).join("");
    const kit = kitBy(o.kit), tg = o.tg || o.client?.tg || "";
    return `<div class="wrap st">
      <div class="st-head rise">
        <p class="cap">Заказ №${esc(o.id)}</p>
        <h1 class="d2">${isDone ? "Твои смены готовы" : "Смены уже ищем"}</h1>
        <p class="lead">${isDone ? `Мы нашли все смены №${esc(o.number)} и проверили каждую.` : `Результат до завтра, 20:00. Пришлём в Telegram${tg ? ` @${esc(tg)}` : " ответом на твоё сообщение"}, страницу можно закрыть.`}</p>
        ${!isDone && o.msg && cur > 0 ? `<p class="cap st-resend">Сообщение в Telegram не отправилось? <a class="link" href="${tgLink(o.msg)}" target="_blank" rel="noopener">Открыть Telegram ещё раз</a></p>` : ""}
      </div>
      <div class="st-grid">
        <ol class="st-steps rise" style="--d:1" aria-live="polite">${steps}</ol>
        <div class="st-side rise" style="--d:2">
          ${isDone ? `<a class="st-result" href="#/result?own"><span class="num">${T.toi}</span><span>на льду, ${T.shifts} смен</span><span class="btn btn--accent">Открыть результат</span></a>` : `
          <div class="st-soon" aria-label="Пример того, что придёт">
            <div class="st-soon-reel"><img src="${HERO.poster}" alt="" loading="lazy"><svg viewBox="0 0 90 160" aria-hidden="true"><ellipse cx="45" cy="112" rx="24" ry="7"/></svg><b>№${esc(o.number)}</b></div>
            <div class="st-soon-txt"><b>Твой ролик появится здесь</b><span>И цифры игры: время на льду, смены, голы при тебе.</span>
              <div class="st-soon-nums" aria-hidden="true"><span><i data-v="0:00"></i>на льду</span><span><i data-v="00"></i>смен</span><span><i data-v="00 с"></i>средняя</span></div></div>
          </div>
          <div class="st-wait"><span class="st-tg" aria-hidden="true">${ICON.tg}</span><span>Ничего делать не нужно. Мы напишем, как только всё будет готово.</span></div>`}
          <div class="sum">
            <div><span>Игра</span><b>${esc(String(o.url).replace(/^https?:\/\/(www\.)?/, ""))}</b></div>
            <div><span>Игрок</span><b><i class="kit-dot" style="--c:${kit.hex}"></i>№${esc(o.number)}, ${esc(o.team)}</b></div>
            <div><span>Разобрать</span><b>${esc(String(o.period).toLowerCase())}</b></div>
          </div>
          ${isDone ? "" : `<button class="st-demo" id="st-demo" type="button">Демо: показать следующий шаг</button>`}
        </div>
      </div>
    </div>`;
  }
  let stopStatus = null;
  function bindStatus(id) {
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

  /* ================= ДАННЫЕ, УСЛОВИЯ, 404 ================= */
  const doc = (title, lead, blocks) => `<div class="wrap doc"><h1 class="d2">${title}</h1><p class="lead">${lead}</p>
      <p class="doc-draft">Черновик. Текст нужно уточнить у юриста до запуска.</p>
      ${blocks.map(([h, items]) => `<section><h2 class="d3">${h}</h2><ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul></section>`).join("")}
      <p class="cap">Вопросы: <a class="link" href="https://t.me/${B.telegram}" target="_blank" rel="noopener">@${esc(B.telegram)}</a> в Telegram. <a class="link" href="#/">На главную</a></p></div>`;
  function privacy() {
    return doc("Что мы храним и зачем", "Коротко и без мелкого шрифта.", [
      ["Что собираем", ["Ник в Telegram, чтобы прислать результат.", "Ссылку на запись игры, номер, цвет формы и название команды, чтобы найти игрока.", "Для детской игры отметку, что согласие родителей есть.", "Лица не распознаём. Игрока ищем по номеру на спине и цвету формы."]],
      ["Зачем", ["Найти смены в записи, собрать видео и ролик, прислать ссылку.", "Рекламу по этим данным не показываем и никому их не передаём."]],
      ["Кто видит видео", ["Ты, по личной ссылке. Ссылку можно переслать, тогда её увидит тот, кому ты её дал.", "Автор сервиса, когда проверяет смены перед отправкой.", "В соцсети и рилсы твоё видео не попадает без отдельного согласия."]],
      ["Сколько храним", [`Видео смен и ролик: ${OFFER.packMonths} месяцев. <i>Срок уточнить у юриста.</i>`, "Запись игры целиком удаляем после обработки.", "Заявку и ник: пока действует пакет или пока не попросишь удалить. <i>Уточнить у юриста.</i>"]],
      ["Как удалить", [`Напиши «удалите мои данные» в Telegram @${esc(B.telegram)}.`, "Удалим видео, ролик и заявку и подтвердим ответным сообщением. <i>Срок ответа уточнить у юриста.</i>"]],
      ["Кто отвечает за данные", [`${esc(B.author)}, автор сервиса. <i>Статус (самозанятый или ИП) и уведомление в Роскомнадзор уточнить у юриста.</i>`, "Данные лежат на серверах в России."]],
    ]);
  }
  function terms() {
    return doc("Условия", "Как мы работаем и за что ты платишь.", [
      ["Оплата", ["Платишь после результата: сначала смотришь свои смены, потом платишь.", "Карту заранее не просим и сами ничего не списываем. Реквизиты для перевода пришлём вместе с результатом. <i>Способ оплаты уточнить.</i>", `Игра стоит ${PRICES[0].price} ₽. Пакет ${PRICES[1].games} игр ${rub(PRICES[1].price)} ₽, пакет ${PRICES[2].games} игр ${rub(PRICES[2].price)} ₽.`, pilot ? `Первые ${OFFER.freeTotal} игроков получают одну игру бесплатно. Взамен три коротких вопроса.` : "Первая игра по обычной цене."]],
      ["Пакеты", [`Пакет действует ${OFFER.packMonths} месяцев с первой игры.`, "Игры из пакета присылаешь, когда удобно.", "Игра, в которой мы тебя не нашли, из пакета не списывается.", "Возврат за неиспользованные игры пакета. <i>Порядок уточнить у юриста.</i>"]],
      ["Если не нашли", ["Не нашли игрока в записи: ничего не платишь.", "Нашли не все смены или ошиблись: напиши, переделаем бесплатно."]],
      ["Сроки", ["Результат приходит в Telegram на следующий день до 20:00.", "Если запись не подходит, скажем об этом раньше."]],
      ["Какие записи подходят", ["Запись трансляции на VK Видео, YouTube или Rutube, где на спине виден номер.", "Видео с телефона и файлы из облака пока не разбираем."]],
      ["Чья запись", ["Права на трансляцию принадлежат организатору игры. Мы даём ссылки на моменты в записи и видео для личного просмотра. <i>Формулировку уточнить у юриста.</i>"]],
    ]);
  }
  function notFound() {
    return `<div class="wrap st"><div class="st-refuse"><span class="num nf-num" aria-hidden="true" data-v="404"></span>
      <h1 class="d2">Такой страницы нет</h1><p class="lead">Ссылка устарела или в ней опечатка. Вот куда можно пойти.</p>
      <div class="hero-cta"><a class="btn btn--accent btn--big" href="#/">На главную</a><a class="link" href="#/result">Смотреть пример</a><a class="link" href="https://t.me/${B.telegram}" target="_blank" rel="noopener">Написать в Telegram</a></div></div></div>`;
  }

  /* ================= МАРШРУТЫ ================= */
  const ROUTES = { "": home, home, result, cabinet, order, status, privacy, terms };
  const NAV = { "": "home", home: "home", result: "result", cabinet: "cabinet", order: "order", status: "order" };
  const TITLES = { home: "все смены из трансляции", result: `№${O.number} ${O.team}, ${T.toi} на льду`, cabinet: "мои игры", order: "получить смены", status: "статус заказа", privacy: "данные", terms: "условия", none: "страницы нет" };
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
      <svg class="gate-mark" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="11" r="6.5"/><ellipse cx="20" cy="28" rx="16" ry="6.5"/></svg>
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
      if (await pinOk(pin.value.trim())) { gateOk = true; try { sessionStorage.setItem(GATE, "1"); } catch { /* помним до перезагрузки */ } mount(); return; }
      err.hidden = false; pin.classList.add("bad"); pin.select();
    });
  }

  /* подгрузка по требованию: админка и демо-заказы нужны только своим экранам */
  const lazy = {};
  function need(src) {
    return lazy[src] ||= new Promise((done) => {
      const el = src.endsWith(".css") ? Object.assign(document.createElement("link"), { rel: "stylesheet", href: src }) : Object.assign(document.createElement("script"), { src });
      el.onload = done; el.onerror = done; document.head.appendChild(el);
    });
  }
  function mount() {
    stopStatus?.(); stopStatus = null; cancelAnimationFrame(tryRaf);
    const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
    const [route, ...rest] = path.replace(/\/$/, "").split("/");
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
    document.title = `${B.name} ${B.product}: ${TITLES[route] || TITLES[nav] || TITLES.none}`;
    const cta = $(".top-cta"); if (cta) cta.innerHTML = route === "result" && !/(^|&)own\b/.test(query) ? "Хочу так же" : `<span>Получить смены<span class="cta-tail">${esc(ctaText().replace("Получить смены", ""))}</span></span>`;
    if (jump) { const el = document.getElementById(jump); jump = null; window.scrollTo(0, 0); if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "start" })); }
    else window.scrollTo(0, 0);
    showDock(true);
    requestAnimationFrame(() => { view.classList.add("go-in"); reveal(); });
    if (route === "order") bindOrder();
    if (route === "status") bindStatus(rest[0]);
    if (fn === home) bindTry();
  }
  function go() {
    if (document.startViewTransition && !reduced && view.innerHTML) { const t = document.startViewTransition(mount); [t.ready, t.finished, t.updateCallbackDone].forEach((p) => p.catch(() => {})); } else mount();
  }

  /* ---------- появление: цифры докручиваются, бруски растут чуть раньше, чем блок доехал до экрана ---------- */
  let io = null;
  function countUp(el) {
    const to = +el.dataset.count, clock = el.dataset.fmt === "clock";
    if (reduced) return;
    const t0 = performance.now(), dur = clock ? 1300 : 900;
    const tick = (t) => { const k = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 3)));
      el.textContent = clock ? mmss(v) : v; if (k < 1) requestAnimationFrame(tick); };
    el.textContent = clock ? "0:00" : "0"; requestAnimationFrame(tick);
  }
  function reveal() {
    io?.disconnect();
    const targets = $$("[data-count], [data-tl], [data-reveal]", view);
    if (!("IntersectionObserver" in window)) { targets.forEach((el) => el.classList.add("play")); return; }
    io = new IntersectionObserver((ents) => ents.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target; io.unobserve(el);
      if (el.dataset.count) countUp(el); else el.classList.add("play");
    }), { rootMargin: "0px 0px 30% 0px", threshold: 0.01 });
    targets.forEach((el) => io.observe(el));
  }

  /* ---------- «вау» на лендинге: нажал на смену — она сразу играет, игрок в неоновом эллипсе ---------- */
  const TRY0 = 1;            // первая смена: игрок в кадре почти всё время
  let tryRaf = 0, tryN = TRY0;
  function tryLabel(n) { const s = shiftBy(n), g = goalOfShift(n); return `<b>Смена ${n}</b><span>${s.c0} – ${s.c1} по табло, ${s.sec} с на льду ${goalTag(g)}</span>`; }
  function loadMarks(cb) {
    if (window.TRY_MARKS) return cb();
    const sc = document.createElement("script"); sc.src = "data/try_marks.js"; sc.onload = cb; sc.onerror = cb; document.head.appendChild(sc);
  }
  function bindTry() {
    const v = $("#try-video"); if (!v) return;
    const start = () => { if (!v.getAttribute("src")) loadMarks(() => tryShift(TRY0, true)); };
    if ("IntersectionObserver" in window) {
      const o = new IntersectionObserver((e) => { if (e[0].isIntersecting) { start(); o.disconnect(); } }, { rootMargin: "0px 0px 20% 0px", threshold: 0.1 });
      o.observe(v);
    } else start();
  }
  function tryShift(n, quiet) {
    const v = $("#try-video"), s = shiftBy(n); if (!v || !s) return;
    tryN = n;
    $$("#try .tl-bar").forEach((b) => b.classList.toggle("on", +b.dataset.shift === n));
    const first = window.TRY_MARKS?.shifts?.[n]?.first ?? 2;
    v.src = O.media.shift(n); v.poster = O.media.frame(n);
    v.addEventListener("loadedmetadata", () => { v.currentTime = Math.max(0, first - 0.4); }, { once: true });
    v.play().catch(() => {});
    const lab = $("#try-label"); lab.innerHTML = tryLabel(n);
    lab.animate?.([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: "cubic-bezier(.2,.8,.2,1)" });
    if (!quiet) $("#try-hint")?.classList.add("gone");
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
    if (bar) { const n = +bar.dataset.shift; if (bar.closest("#try")) tryShift(n); else if ($("#picked")) selectShift(n, view, true); else openSheet(n); return; }
    const play = t.closest("[data-play]");
    if (play && !play.disabled) { e.preventDefault(); openSheet(play.dataset.play); return; }
    if (t.closest("[data-share]")) { share(); return; }
    const hp = t.closest("#hero-pause");
    if (hp) { const v = $(".hero-reel video"), off = v.paused; off ? v.play() : v.pause(); hp.setAttribute("aria-pressed", String(!off)); hp.setAttribute("aria-label", off ? "Поставить ролик на паузу" : "Включить ролик"); return; }
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
