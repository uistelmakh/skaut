/* РЕАЛЬНЫЙ ЗАКАЗ. Цифры не менять.
   Источник: deliver/shl_p2_19/message.txt (смены, таймкоды, сводка)
   и out/shl_p2/player.json (голы периода по табло трансляции), data/orders/1.json (дата, цвета).
   Игра: РМАТ — КГУ, 27.01.2024, 2-й период, трансляция на YouTube. Игрок №19, синяя форма. */
window.ORDER = {
  real: true,
  number: 19,
  team: "РМАТ",
  opp: "КГУ",
  period: 2,
  date: "27 января",
  jersey: "синяя форма",
  marker: "neon",
  youtube: "tCeRunyacEA",
  periodSec: 1200,                 // период 20:00, часы идут вниз
  scoreStart: "1:1",
  scoreEnd: "4:3",
  totals: { shifts: 11, toiSec: 528, toi: "8:48", avgSec: 48, plus: 2, minus: 1 },
  /* c0, c1: время по табло; sec: игровых секунд; yt: секунда трансляции; len: длина видеофайла смены, с */
  shifts: [
    { n: 1,  c0: "19:06", c1: "18:37", sec: 29,  yt: 3873, len: 53 },
    { n: 2,  c0: "18:01", c1: "16:35", sec: 86,  yt: 3993, len: 190, goal: "2:1" },
    { n: 3,  c0: "14:11", c1: "14:03", sec: 7,   yt: 4391, len: 25 },
    { n: 4,  c0: "14:02", c1: "12:56", sec: 66,  yt: 4424, len: 94,  goal: "2:2" },
    { n: 5,  c0: "11:21", c1: "10:46", sec: 35,  yt: 4665, len: 59 },
    { n: 6,  c0: "10:20", c1: "9:15",  sec: 64,  yt: 4747, len: 69 },
    { n: 7,  c0: "5:43",  c1: "3:49",  sec: 114, yt: 5201, len: 132 },
    { n: 8,  c0: "3:22",  c1: "2:26",  sec: 56,  yt: 5410, len: 77 },
    { n: 9,  c0: "1:34",  c1: "1:20",  sec: 14,  yt: 5597, len: 50 },
    { n: 10, c0: "1:18",  c1: "1:09",  sec: 9,   yt: 5646, len: 13 },
    { n: 11, c0: "0:47",  c1: "0:00",  sec: 48,  yt: 5704, len: 60 },
  ],
  /* Все голы периода по табло. mine: гол своей команды. onIce: игрок был на льду (в сводке это +2 / −1). */
  goals: [
    { clock: "17:43", score: "2:1", mine: true,  onIce: true,  shift: 2 },
    { clock: "12:56", score: "2:2", mine: false, onIce: true,  shift: 4 },
    { clock: "12:24", score: "2:3", mine: false, onIce: false },
    { clock: "7:24",  score: "3:3", mine: true,  onIce: false },
    { clock: "2:05",  score: "4:3", mine: true,  onIce: true },
  ],
  media: {
    reel: "media/reel_neon.mp4",
    reelPoster: "media/frames/reel_poster.jpg",
    reelLen: 25,
    all: "media/all_shifts.mp4",
    allLen: 1009,
    shift: (n) => `media/shifts/shift_${String(n).padStart(2, "0")}.mp4`,
    frame: (n) => `media/frames/shift_${String(n).padStart(2, "0")}.jpg`,
  },
};
