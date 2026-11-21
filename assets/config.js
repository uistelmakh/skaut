/* Единственное место, где живёт название. Поменял здесь — поменялось в прототипе,
   на обложках и в карусели (proto/reels/src/*.html читают этот же файл). */
window.BRAND = {
  name: "Скаут",              // запасной вариант названия: «Обводка», см. BRAND.md
  product: "Смены",
  telegram: "sergeistelmakh",        // личный Telegram для заявок
  channel: "sergeistelmakh_it",      // канал и Инстаграм
  author: "Сергей Стельмах",
};

/* Один продукт: смены игрока из трансляции. Ролик 9:16 — часть результата.
   ЦЕНЫ МЕНЯЮТСЯ ТОЛЬКО ЗДЕСЬ: сайт, админка, сообщения клиенту, обложки и карусель читают этот файл.
   Цена за игру в пакете и выгода считаются сами. Экономика цен: founder/PRICES_V3.md. */
window.PRICES = [
  { key: "one",  games: 1,  price: 490,  title: "Игра", note: "Вся игра, все периоды: смены со ссылками, цифры, видео каждой смены и ролик 9:16" },
  { key: "five", games: 5,  price: 1990, title: "5 игр", note: "Хватит на месяц-полтора, если играешь раз в неделю", main: true },
  { key: "ten",  games: 10, price: 3490, title: "10 игр", note: "Тем, кто играет каждую неделю, и родителям" },
].map((p, i, all) => ({ ...p, per: Math.round(p.price / p.games), save: Math.round((1 - p.price / p.games / all[0].price) * 100) }));
window.OFFER = {
  freeTotal: 10,               // пилот: первые 10 игроков бесплатно
  freeLeft: 10,                // сколько мест осталось. Меняется здесь вручную, когда место занято
  freeAsk: "Взамен три коротких вопроса после результата",
  packMonths: 6,
  packNote: "Пакет действует 6 месяцев. Оплата после результата.",
};

/* Сравнение «ценность против цены». Только цифры с источником из founder/research_raw/03 (путь не показываем клиенту) */
window.ICE = { min: 875, max: 1280 };   // один выход на лёд в любительской лиге Москвы, доля игрока
window.VALUE = [
  { label: "Скаут: вся игра, все смены", price: window.PRICES[0].price, us: true },
  { label: "Один выход на лёд в любительской лиге Москвы", price: window.ICE.max, text: "875–1 280 ₽", src: "взносы НХЛ, ЛХЛ-77, «Трудовых резервов» и МосЛиги, sports.ru, 2024–2025" },
  { label: "Разбор матча у видеоаналитика", price: 12500, text: "4 100–12 500 ₽", src: "ICETIGERS и SPORTS LAB, цены на сайтах, ноябрь 2026" },
];

/* Цвета обводки в ролике (по умолчанию неоновый) */
window.MARKERS = [
  { key: "neon",   title: "Неоновый",  hex: "#3DFF2E" },
  { key: "orange", title: "Оранжевый", hex: "#FF8A1F" },
  { key: "cyan",   title: "Бирюзовый", hex: "#19E0D0" },
  { key: "pink",   title: "Розовый",   hex: "#FF4FA3" },
  { key: "yellow", title: "Жёлтый",    hex: "#FFD60A" },
  { key: "red",    title: "Красный",   hex: "#FF3B2F" },
  { key: "white",  title: "Белый",     hex: "#FFFFFF" },
];

/* Цвета формы в заказе */
window.KITS = [
  { key: "blue",   title: "Синяя",    hex: "#1F46C7" },
  { key: "white",  title: "Белая",    hex: "#F4F4F4" },
  { key: "red",    title: "Красная",  hex: "#D5262B" },
  { key: "black",  title: "Чёрная",   hex: "#18181A" },
  { key: "yellow", title: "Жёлтая",   hex: "#F5C400" },
  { key: "green",  title: "Зелёная",  hex: "#178A4C" },
  { key: "orange", title: "Оранжевая", hex: "#F26A1B" },
  { key: "claret", title: "Бордовая", hex: "#7A1430" },
];

/* Облачная функция заказов (Yandex Cloud Functions, исходник в proto/cloud/orders). Работает на сайте
   uistelmakh.github.io; локально включается через localStorage["scout.cloud"] = "1". Пустая строка — только браузер. */
window.ORDERS_API = "https://functions.yandexcloud.net/d4emb3fkt70rfn5ki4fq";

/* Расчёт матча на видеокарте (функция rink-launch, tools/gpu.py setup-launcher, GPU.md). Запускает только браузер,
   где введён ключ видеокарты (админка → карточка заказа → «Видеокарта»). Пустая строка — кнопки нет. */
window.GPU_API = "https://functions.yandexcloud.net/d4ecoq7u5tt1nnmgb287";
