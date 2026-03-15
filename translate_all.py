import json

# Translations for all missing keys per locale
# Format: { "section.key": { "lang": "translation" } }

TRANSLATIONS = {
  # ── nav ──────────────────────────────────────────────────────────────────────
  "nav.newAppointment": {
    "uz": "Yangi yozuv", "kz": "Жаңа жазба", "ky": "Жаңы жазуу",
    "tg": "Сабти нав", "by": "Новы запіс", "uk": "Новий запис", "kaa": "Жаңа жазыу"
  },
  "nav.groupMain": {
    "uz": "Asosiy", "kz": "Негізгі", "ky": "Негизги",
    "tg": "Асосӣ", "by": "Асноўнае", "uk": "Основне", "kaa": "Тийкарғы"
  },
  "nav.groupCatalog": {
    "uz": "Katalog", "kz": "Каталог", "ky": "Каталог",
    "tg": "Каталог", "by": "Каталог", "uk": "Каталог", "kaa": "Каталог"
  },
  "nav.groupMarketing": {
    "uz": "Marketing", "kz": "Маркетинг", "ky": "Маркетинг",
    "tg": "Маркетинг", "by": "Маркетынг", "uk": "Маркетинг", "kaa": "Маркетинг"
  },
  "nav.groupTeam": {
    "uz": "Jamoa", "kz": "Команда", "ky": "Команда",
    "tg": "Даста", "by": "Каманда", "uk": "Команда", "kaa": "Команда"
  },
  "nav.promoCodes": {
    "kz": "Промокодтар", "ky": "Промокодтор", "tg": "Промокодҳо",
    "by": "Прамакоды", "uk": "Промокоди"
  },
  "nav.reviews": {
    "kz": "Пікірлер", "ky": "Сын-пикирлер", "tg": "Шарҳҳо",
    "by": "Водгукі", "uk": "Відгуки"
  },
  "nav.newAppointmentKz": None,  # skip marker

  # ── auth ─────────────────────────────────────────────────────────────────────
  "auth.accountDisabled": {
    "uz": "Hisobingiz bloklangan. Administrator bilan bog'laning.",
    "kz": "Аккаунтыңыз бұғатталған. Әкімшіге хабарласыңыз.",
    "ky": "Аккаунтуңуз бөгөттөлгөн. Администратор менен байланышыңыз.",
    "tg": "Ҳисоби шумо манъ шудааст. Бо маъмур тамос гиред.",
    "by": "Ваш акаўнт заблакаваны. Звярніцеся да адміністратара.",
    "uk": "Ваш акаунт заблокований. Зверніться до адміністратора.",
    "kaa": "Аккаунтыңыз бөгелген. Администраторға хабарласың."
  },

  # ── settings ──────────────────────────────────────────────────────────────────
  "settings.tabAppearance": {
    "kz": "Интерфейс", "ky": "Интерфейс", "tg": "Интерфейс",
    "by": "Інтэрфейс", "uk": "Інтерфейс"
  },

  # ── appointments ─────────────────────────────────────────────────────────────
  "appointments.selectTimeFirst": {
    "uz": "Avval vaqtni tanlang", "kz": "Алдымен уақытты таңдаңыз",
    "ky": "Адегенде убакытты тандаңыз", "tg": "Аввал вақтро интихоб кунед",
    "by": "Спачатку выберыце час", "uk": "Спочатку оберіть час", "kaa": "Aldı waqıttı tańlań"
  },
  "appointments.tabDetails": {
    "uz": "Tafsilotlar", "kz": "Толығырақ", "ky": "Чоо-жайы",
    "tg": "Тафсилот", "by": "Падрабязнасці", "uk": "Деталі", "kaa": "Tolıqlaw"
  },

  # ── services ─────────────────────────────────────────────────────────────────
  "services.categoryDeleteConfirm": {
    "uz": "Kategoriyani o'chirish kerakmi?", "kz": "Санатты жою керек пе?",
    "ky": "Категорияны жоюу керекпи?", "tg": "Категорияро нест кунед?",
    "by": "Выдаліць катэгорыю?", "uk": "Видалити категорію?", "kaa": "Kategoriyani joywqerek pe?"
  },
  "services.search": {
    "uz": "Xizmatlar bo'yicha qidirish...", "kz": "Қызметтер бойынша іздеу...",
    "ky": "Кызматтар боюнча издөө...", "tg": "Ҷустуҷӯ аз рӯи хидматҳо...",
    "by": "Пошук па паслугах...", "uk": "Пошук за послугами...", "kaa": "Xizmetler boyınsha qıdırıw..."
  },
  "services.notFound": {
    "uz": "Xizmat topilmadi", "kz": "Қызмет табылмады", "ky": "Кызмат табылган жок",
    "tg": "Хидмат ёфт нашуд", "by": "Паслуга не знойдзена", "uk": "Послугу не знайдено", "kaa": "Xizmet tabılmadı"
  },
  "services.status": {
    "uz": "Holat", "kz": "Күй", "ky": "Абал", "tg": "Вазъият",
    "by": "Статус", "uk": "Статус", "kaa": "Jaǵday"
  },
  "services.sortBy.name": {
    "uz": "Nom bo'yicha", "kz": "Атауы бойынша", "ky": "Аты боюнча",
    "tg": "Аз рӯи ном", "by": "Па назве", "uk": "За назвою", "kaa": "Atı boyınsha"
  },
  "services.sortBy.price": {
    "uz": "Narx bo'yicha", "kz": "Баға бойынша", "ky": "Баасы боюнча",
    "tg": "Аз рӯи нарх", "by": "Па цане", "uk": "За ціною", "kaa": "Bahası boyınsha"
  },
  "services.sortBy.duration": {
    "uz": "Davomiylik bo'yicha", "kz": "Ұзақтығы бойынша", "ky": "Узактыгы боюнча",
    "tg": "Аз рӯи давомнокӣ", "by": "Па працягласці", "uk": "За тривалістю", "kaa": "Uzaqlıǵı boyınsha"
  },

  # ── calendar ─────────────────────────────────────────────────────────────────
  "calendar.list": {
    "uz": "Ro'yxat", "kz": "Тізім", "ky": "Тизме",
    "tg": "Рӯйхат", "by": "Спіс", "uk": "Список", "kaa": "Dizim"
  },
  "calendar.listSearch": {
    "uz": "Mijoz, xizmat bo'yicha qidirish...", "kz": "Клиент, қызмет бойынша іздеу...",
    "ky": "Кардар, кызмат боюнча издөө...", "tg": "Ҷустуҷӯи муштарӣ, хидмат...",
    "by": "Пошук па кліенце, паслузе...", "uk": "Пошук за клієнтом, послугою...", "kaa": "Mijoz, xizmet boyınsha qıdırıw..."
  },
  "calendar.allStatuses": {
    "uz": "Barcha holatlar", "kz": "Барлық күйлер", "ky": "Бардык абалдар",
    "tg": "Ҳамаи ҳолатҳо", "by": "Усе статусы", "uk": "Всі статуси", "kaa": "Barlıq jaǵdaylar"
  },
  "calendar.dateFrom": {
    "uz": "Sanadan", "kz": "Мерзімінен", "ky": "Датадан",
    "tg": "Аз санаи", "by": "З даты", "uk": "З дати", "kaa": "Sanadan"
  },
  "calendar.dateTo": {
    "uz": "Sanagacha", "kz": "Мерзіміне дейін", "ky": "Датага чейин",
    "tg": "То санаи", "by": "Па дату", "uk": "По дату", "kaa": "Sanağa shekem"
  },
  "calendar.listCount": {
    "uz": "Yozuvlar: {{count}}", "kz": "Жазбалар: {{count}}", "ky": "Жазуулар: {{count}}",
    "tg": "Сабтҳо: {{count}}", "by": "Запісаў: {{count}}", "uk": "Записів: {{count}}", "kaa": "Jazıwlar: {{count}}"
  },
  "calendar.selectedCount": {
    "uz": "Tanlangan: {{count}}", "kz": "Таңдалған: {{count}}", "ky": "Тандалган: {{count}}",
    "tg": "Интихобшуда: {{count}}", "by": "Абраных: {{count}}", "uk": "Вибрано: {{count}}", "kaa": "Tańlanǵan: {{count}}"
  },
  "calendar.deleteSelected": {
    "uz": "Tanlanganlarni o'chirish", "kz": "Таңдалғандарды жою", "ky": "Тандалгандарды жою",
    "tg": "Нест кардани интихобшудагон", "by": "Выдаліць абраныя", "uk": "Видалити вибрані", "kaa": "Tańlanǵanlardı joyw"
  },
  "calendar.deleteSelectedConfirm": {
    "uz": "{{count}} ta yozuvni o'chirish kerakmi?", "kz": "{{count}} жазбаны жою керек пе?",
    "ky": "{{count}} жазууну жоюу керекпи?", "tg": "{{count}} сабтро нест кунем?",
    "by": "Выдаліць {{count}} запісаў?", "uk": "Видалити {{count}} записів?", "kaa": "{{count}} jazıwdı joyw kerek pe?"
  },
  "calendar.deletedCount": {
    "uz": "{{count}} ta yozuv o'chirildi", "kz": "{{count}} жазба жойылды",
    "ky": "{{count}} жазуу жойулду", "tg": "{{count}} сабт нест шуд",
    "by": "Выдалена {{count}} запісаў", "uk": "Видалено {{count}} записів", "kaa": "{{count}} jazıw joyıldı"
  },

  # ── dashboard ─────────────────────────────────────────────────────────────────
  "dashboard.weekRevenue": {
    "uz": "Haftalik daromad", "kz": "Апталық табыс", "ky": "Жумалык киреше",
    "tg": "Даромади ҳафта", "by": "Выручка за тыдзень", "uk": "Виручка за тиждень", "kaa": "Aptalıq daromat"
  },
  "dashboard.monthRevenue": {
    "uz": "Oylik daromad", "kz": "Айлық табыс", "ky": "Айлык киреше",
    "tg": "Даромади моҳ", "by": "Выручка за месяц", "uk": "Виручка за місяць", "kaa": "Aylıq daromat"
  },
  "dashboard.onlineBookings": {
    "uz": "Onlayn yozuvlar", "kz": "Онлайн-жазбалар", "ky": "Онлайн-жазуулар",
    "tg": "Сабтҳои онлайн", "by": "Анлайн-запісы", "uk": "Онлайн-записи", "kaa": "Onlayn jazıwlar"
  },
  "dashboard.thisMonth": {
    "uz": "bu oyda", "kz": "осы айда", "ky": "бул айда",
    "tg": "ин моҳ", "by": "у гэтым месяцы", "uk": "у цьому місяці", "kaa": "bul ayda"
  },
  "dashboard.positions": {
    "uz": "ta", "kz": "позиция", "ky": "позиция",
    "tg": "мавқеъ", "by": "пазіцый", "uk": "позицій", "kaa": "pozitsiya"
  },
  "dashboard.times": {
    "uz": "marta", "kz": "рет", "ky": "жолу",
    "tg": "маротиба", "by": "разоў", "uk": "разів", "kaa": "marte"
  },
  "dashboard.weekChart": {
    "uz": "Hafta kunlari bo'yicha band bo'lish", "kz": "Апта күндері бойынша жүктеме",
    "ky": "Жума күндөрү боюнча жүктөмө", "tg": "Банд будан аз рӯи рӯзҳои ҳафта",
    "by": "Занятасць па днях тыдня", "uk": "Зайнятість по днях тижня", "kaa": "Apta künleri boyınsha jükteme"
  },
  "dashboard.upcoming": {
    "uz": "Yaqin yozuvlar", "kz": "Жақын жазбалар", "ky": "Жакынкы жазуулар",
    "tg": "Сабтҳои наздик", "by": "Бліжэйшыя запісы", "uk": "Найближчі записи", "kaa": "Jaqın jazıwlar"
  },
  "dashboard.allAppointments": {
    "uz": "Barcha yozuvlar", "kz": "Барлық жазбалар", "ky": "Бардык жазуулар",
    "tg": "Ҳамаи сабтҳо", "by": "Усе запісы", "uk": "Всі записи", "kaa": "Barlıq jazıwlar"
  },
  "dashboard.noUpcoming": {
    "uz": "Yaqin yozuvlar yo'q", "kz": "Жақын жазба жоқ", "ky": "Жакынкы жазуу жок",
    "tg": "Сабтҳои наздик нест", "by": "Няма бліжэйшых запісаў", "uk": "Немає найближчих записів", "kaa": "Jaqın jazıw joq"
  },
  "dashboard.topServices": {
    "uz": "Top xizmatlar", "kz": "Үздік қызметтер", "ky": "Мыктуу кызматтар",
    "tg": "Хидматҳои беҳтарин", "by": "Топ паслуг", "uk": "Топ послуг", "kaa": "Top xizmetler"
  },
  "dashboard.noData": {
    "uz": "Ma'lumot yo'q", "kz": "Деректер жоқ", "ky": "Маалымат жок",
    "tg": "Маълумот нест", "by": "Дадзеных пакуль няма", "uk": "Даних поки немає", "kaa": "Málimet joq"
  },
  "dashboard.showAll": {
    "uz": "Barchasini ko'rsatish", "kz": "Барлығын көрсету", "ky": "Баарын көрсөтүү",
    "tg": "Ҳамаро нишон диҳед", "by": "Паказаць усё", "uk": "Показати все", "kaa": "Barsın kórsetiw"
  },
  "dashboard.viewTeam": {
    "uz": "Jamoa", "kz": "Команда", "ky": "Команда",
    "tg": "Даста", "by": "Каманда", "uk": "Команда", "kaa": "Komanda"
  },

  # ── booking ──────────────────────────────────────────────────────────────────
  "booking.cancelTitle": {
    "uz": "Yozuvni bekor qilish", "kz": "Жазбаны бас тарту", "ky": "Жазууну жокко чыгаруу",
    "tg": "Бекор кардани сабт", "by": "Адмена запісу", "uk": "Скасування запису", "kaa": "Jazıwdı bekar qılıw"
  },
  "booking.cancelConfirmDesc": {
    "uz": "Yozuvni bekor qilmoqchimisiz?", "kz": "Жазбаны бас тартқыңыз келе ме?",
    "ky": "Жазууну жокко чыгаргыңыз келеби?", "tg": "Оё мехоҳед сабтро бекор кунед?",
    "by": "Вы ўпэўненыя, што хочаце адмяніць запіс?", "uk": "Ви впевнені, що хочете скасувати запис?",
    "kaa": "Jazıwdı bekar qılıwǵa isenim bar ma?"
  },
  "booking.keepBooking": {
    "uz": "Yozuvni saqlash", "kz": "Жазбаны қалдыру", "ky": "Жазууну калтыруу",
    "tg": "Сабтро нигоҳ дор", "by": "Пакінуць запіс", "uk": "Залишити запис", "kaa": "Jazıwdı saqlap qalıw"
  },
  "booking.confirmCancel": {
    "uz": "Ha, bekor qilish", "kz": "Иә, бас тарту", "ky": "Ооба, жокко чыгаруу",
    "tg": "Бале, бекор кун", "by": "Так, адмяніць", "uk": "Так, скасувати", "kaa": "Ha, bekar qılıw"
  },
  "booking.cancelledTitle": {
    "uz": "Yozuv bekor qilindi", "kz": "Жазба бас тартылды", "ky": "Жазуу жокко чыгарылды",
    "tg": "Сабт бекор карда шуд", "by": "Запіс адменены", "uk": "Запис скасовано", "kaa": "Jazıw bekar qılındı"
  },
  "booking.cancelledDesc": {
    "uz": "Yozuvingiz muvaffaqiyatli bekor qilindi. Yana kutamiz!",
    "kz": "Жазбаңыз сәтті бас тартылды. Сізді қайта күтеміз!",
    "ky": "Жазууңуз ийгиликтүү жокко чыгарылды. Кайра күтөбүз!",
    "tg": "Сабти шумо бо муваффақият бекор карда шуд. Шуморо дубора интизор мешавем!",
    "by": "Ваш запіс паспяхова адменены. Чакаем вас зноў!",
    "uk": "Ваш запис успішно скасовано. Чекаємо вас знову!",
    "kaa": "Jazıwıńız wáde bekar qılındı. Sizi qayta kütip qalamız!"
  },
  "booking.alreadyCancelled": {
    "uz": "Yozuv allaqachon bekor qilingan", "kz": "Жазба бұрын бас тартылған",
    "ky": "Жазуу мурунтан жокко чыгарылган", "tg": "Сабт аллакай бекор карда шудааст",
    "by": "Запіс ужо адменены", "uk": "Запис вже скасовано", "kaa": "Jazıw buwın bekar qılınǵan"
  },
  "booking.alreadyCancelledDesc": {
    "uz": "Bu yozuv avval bekor qilingan.", "kz": "Бұл жазба бұрын бас тартылған.",
    "ky": "Бул жазуу мурун жокко чыгарылган.", "tg": "Ин сабт пештар бекор карда шудааст.",
    "by": "Гэты запіс быў адменены раней.", "uk": "Цей запис був скасований раніше.",
    "kaa": "Bul jazıw burın bekar qılınǵan."
  },
  "booking.cancelError": {
    "uz": "Havola yaroqsiz", "kz": "Сілтеме жарамсыз", "ky": "Шилтеме жараксыз",
    "tg": "Пайванд нодуруст", "by": "Спасылка несапраўдная", "uk": "Посилання недійсне", "kaa": "Shola járamdas emes"
  },
  "booking.cancelErrorDesc": {
    "uz": "Yozuv topilmadi yoki havola eskirgan.", "kz": "Жазба табылмады немесе сілтеме ескірген.",
    "ky": "Жазуу табылган жок же шилтеме эскирген.", "tg": "Сабт ёфт нашуд ё пайванд кӯҳна шудааст.",
    "by": "Запіс не знойдзены або спасылка ўстарэла.", "uk": "Запис не знайдено або посилання застаріло.",
    "kaa": "Jazıw tabılmadı yáki shola eski."
  },
  "booking.clientTelegram": {
    "uz": "Sizning Telegram (ixtiyoriy)", "kz": "Сіздің Telegram (міндетті емес)",
    "ky": "Сиздин Telegram (милдеттүү эмес)", "tg": "Telegram-и шумо (ихтиёрӣ)",
    "by": "Ваш Telegram (неабавязкова)", "uk": "Ваш Telegram (необов'язково)", "kaa": "Sizin Telegram (ixtiyariy)"
  },
  "booking.clientTelegramHint": {
    "uz": "Tasdiqlash va eslatma olish uchun", "kz": "Растау және еске салу алу үшін",
    "ky": "Ырастоо жана эскертүү алуу үчүн", "tg": "Барои гирифтани тасдиқ ва ёддошт",
    "by": "Для атрымання пацверджання і напаміну", "uk": "Для отримання підтвердження та нагадування",
    "kaa": "Tastıyıqlama hám eslatpa alıw ushın"
  },
  "booking.masterContacts": {
    "uz": "Usta kontaktlari", "kz": "Шебер байланыстары", "ky": "Чебердин байланыштары",
    "tg": "Тамосҳои устод", "by": "Кантакты майстра", "uk": "Контакти майстра", "kaa": "Sheber baylanısları"
  },
  "booking.telegramConfirmSent": {
    "uz": "✅ Tasdiqlash Telegram-ga yuborildi", "kz": "✅ Растау Telegram-ға жіберілді",
    "ky": "✅ Ырастоо Telegram-га жөнөтүлдү", "tg": "✅ Тасдиқ ба Telegram фиристода шуд",
    "by": "✅ Пацверджанне адпраўлена ў Telegram", "uk": "✅ Підтвердження надіслано у Telegram",
    "kaa": "✅ Tastıyıqlama Telegram-ǵa jiberildi"
  },

  # ── profile ───────────────────────────────────────────────────────────────────
  "profile.telegramNotifications": {
    "uz": "Telegram bildirishnomalar", "kz": "Telegram хабарландырулары",
    "ky": "Telegram билдирүүлөр", "tg": "Огоҳиҳои Telegram",
    "by": "Паведамленні Telegram", "uk": "Сповіщення Telegram", "kaa": "Telegram xabarlawlar"
  },
  "profile.telegramConnected": {
    "uz": "Telegram ulangan", "kz": "Telegram қосылды",
    "ky": "Telegram туташты", "tg": "Telegram пайваст аст",
    "by": "Telegram падключаны", "uk": "Telegram підключено", "kaa": "Telegram ullandı"
  },
  "profile.telegramConnectedDesc": {
    "uz": "Yangi yozuvlar haqida bildirishnomalar olasiz", "kz": "Жаңа жазбалар туралы хабарландыру аласыз",
    "ky": "Жаңы жазуулар жөнүндө билдирүүлөрдү аласыз", "tg": "Огоҳиҳо дар бораи сабтҳои нав мегиред",
    "by": "Вы будзеце атрымліваць паведамленні аб новых запісах", "uk": "Ви отримуватимете сповіщення про нові записи",
    "kaa": "Jańa jazıwlar haqqında xabarlar alasız"
  },
  "profile.telegramNotConnected": {
    "uz": "Telegram ulanmagan", "kz": "Telegram қосылмаған",
    "ky": "Telegram туташпаган", "tg": "Telegram пайваст нашудааст",
    "by": "Telegram не падключаны", "uk": "Telegram не підключено", "kaa": "Telegram ullanbaǵan"
  },
  "profile.telegramNotConnectedDesc": {
    "uz": "Yangi yozuvlar haqida bildirishnoma olish uchun botni ulang",
    "kz": "Жаңа жазбалар туралы хабарландыру алу үшін ботты қосыңыз",
    "ky": "Жаңы жазуулар жөнүндө кабар алуу үчүн ботту туташтырыңыз",
    "tg": "Барои гирифтани огоҳиҳо дар бораи сабтҳои нав ботро пайваст кунед",
    "by": "Падключыце бота для атрымання апавяшчэнняў аб новых запісах",
    "uk": "Підключіть бота для отримання сповіщень про нові записи",
    "kaa": "Jańa jazıwlar haqqında xabar alıw ushın bottı ulaŋ"
  },
  "profile.telegramConnect": {
    "uz": "Telegram botini ulash", "kz": "Telegram ботын қосу",
    "ky": "Telegram ботун туташтыруу", "tg": "Боти Telegram-ро пайваст кунед",
    "by": "Падключыць Telegram бота", "uk": "Підключити Telegram бот", "kaa": "Telegram botti ulaw"
  },
  "profile.telegramReconnect": {
    "uz": "Botni qayta ulash", "kz": "Ботты қайта қосу",
    "ky": "Ботту кайра туташтыруу", "tg": "Боти дубора пайваст кунед",
    "by": "Перападключыць бота", "uk": "Перепідключити бота", "kaa": "Bottı qayta ulaw"
  },
  "profile.telegramHint": {
    "uz": "Tugmani bosing → Telegram ochiladi → Start bosing",
    "kz": "Батырманы басыңыз → Telegram ашылады → Start басыңыз",
    "ky": "Баскычты басыңыз → Telegram ачылат → Start басыңыз",
    "tg": "Тугмаро пахш кунед → Telegram кушода мешавад → Start пахш кунед",
    "by": "Націсніце кнопку → адкрыецца Telegram → націсніце Start",
    "uk": "Натисніть кнопку → відкриється Telegram → натисніть Start",
    "kaa": "Batırmanı basıń → Telegram ашılAdı → Start basıń"
  },
  "profile.reminders": {
    "uz": "Eslatmalar", "kz": "Еске салулар", "ky": "Эскертүүлөр",
    "tg": "Ёддоштҳо", "by": "Напаміны", "uk": "Нагадування", "kaa": "Eslatpalar"
  },
  "profile.remindersDesc": {
    "uz": "Telegram orqali kelgusi yozuvlar haqida avtomatik eslatmalar",
    "kz": "Telegram арқылы алдағы жазбалар туралы автоматты еске салулар",
    "ky": "Telegram аркылуу келерки жазуулар жөнүндө автоматтык эскертүүлөр",
    "tg": "Ёддоштҳои автоматӣ дар бораи сабтҳои наздик тавассути Telegram",
    "by": "Аўтаматычныя напаміны аб бліжэйшых запісах праз Telegram",
    "uk": "Автоматичні нагадування про майбутні записи через Telegram",
    "kaa": "Telegram arqalı keleshek jazıwlar haqqında avtomatik eslatpalar"
  },
  "profile.remindMaster": {
    "uz": "Ustaga eslatma", "kz": "Шеберге еске салу", "ky": "Чеберге эскертүү",
    "tg": "Ёддошт ба устод", "by": "Напамін майстру", "uk": "Нагадування майстру", "kaa": "Sheberge eslatpa"
  },
  "profile.remindClient": {
    "uz": "Mijozga eslatma", "kz": "Клиентке еске салу", "ky": "Кардарга эскертүү",
    "tg": "Ёддошт ба муштарӣ", "by": "Напамін кліенту", "uk": "Нагадування клієнту", "kaa": "Mijoǵa eslatpa"
  },
  "profile.remindClientHint": {
    "uz": "Agar mijoz yozilishda Telegram ko'rsatgan bo'lsa bildirishnoma oladi",
    "kz": "Клиент жазылу кезінде Telegram көрсеткен болса хабарландыру алады",
    "ky": "Кардар жазылуу учурунда Telegram көрсөткөн болсо кабарланат",
    "tg": "Муштарӣ агар ҳангоми сабт Telegram нишон дода бошад огоҳӣ мегирад",
    "by": "Кліент атрымае паведамленне, калі ўказаў Telegram пры запісе",
    "uk": "Клієнт отримає сповіщення, якщо вказав Telegram при записі",
    "kaa": "Mijoz jazılıwda Telegram kórsatse xabar alAdı"
  },
  "profile.remindOff": {
    "uz": "O'chirilgan", "kz": "Өшірілген", "ky": "Өчүрүлгөн",
    "tg": "Хомӯш", "by": "Адключана", "uk": "Вимкнено", "kaa": "Ósiriw"
  },
  "profile.remindBefore": {
    "uz": "{{n}} {{unit}} oldin", "kz": "{{n}} {{unit}} бұрын", "ky": "{{n}} {{unit}} мурун",
    "tg": "{{n}} {{unit}} пеш", "by": "За {{n}} {{unit}}", "uk": "За {{n}} {{unit}}", "kaa": "{{n}} {{unit}} aldın"
  },
  "profile.remindHour": {
    "uz": "soat", "kz": "сағат", "ky": "саат", "tg": "соат", "by": "гадзіна", "uk": "годину", "kaa": "saat"
  },
  "profile.remindHours2": {
    "uz": "soat", "kz": "сағат", "ky": "саат", "tg": "соат", "by": "гадзіны", "uk": "години", "kaa": "saat"
  },
  "profile.remindDay": {
    "uz": "kun", "kz": "күн", "ky": "күн", "tg": "рӯз", "by": "дзень", "uk": "день", "kaa": "kün"
  },
  "profile.remindDays2": {
    "uz": "kun", "kz": "күн", "ky": "күн", "tg": "рӯз", "by": "дні", "uk": "дні", "kaa": "kün"
  },

  # ── team ──────────────────────────────────────────────────────────────────────
  "team.createTeamHint": {
    "uz": "Masterlarni bitta brend ostida birlashtiring", "kz": "Шеберлерді бір бренд астында біріктіріңіз",
    "ky": "Чеберлерди бир бренд алдында бириктириңиз", "tg": "Усторонро зери як бренд муттаҳид кунед",
    "by": "Аб'яднайце майстроў пад адным брэндам", "uk": "Об'єднайте майстрів під одним брендом",
    "kaa": "Sheberledi bir brand astında birlestiriń"
  },
  "team.joinTeamHint": {
    "uz": "Taklif kodi orqali qo'shiling", "kz": "Шақыру коды арқылы кіріңіз",
    "ky": "Чакыруу коду аркылуу кириңиз", "tg": "Тавассути рамзи даъват пайванд шавед",
    "by": "Далучайцеся па кодзе запрашэння", "uk": "Приєднайтесь за кодом запрошення",
    "kaa": "Shaqırıw kodi arqalı kirińiz"
  },
  "team.inviteExpiredLabel": {
    "uz": "Muddati o'tgan", "kz": "Мерзімі өткен", "ky": "Мөөнөтү өткөн",
    "tg": "Муддат гузаштааст", "by": "Тэрмін мінуў", "uk": "Термін сплив", "kaa": "Merzimi ótken"
  },
  "team.inviteContactPlaceholder": {
    "uz": "Email, telefon yoki @telegram (ixtiyoriy)", "kz": "Email, телефон немесе @telegram (міндетті емес)",
    "ky": "Email, телефон же @telegram (милдеттүү эмес)", "tg": "Email, телефон ё @telegram (ихтиёрӣ)",
    "by": "Email, тэлефон або @telegram (неабавязкова)", "uk": "Email, телефон або @telegram (необов'язково)",
    "kaa": "Email, telefon yáki @telegram (ixtiyariy)"
  },
  "team.deleteTeam": {
    "uz": "Jamoani o'chirish", "kz": "Команданы жою", "ky": "Команданы жою",
    "tg": "Дастаро нест кунед", "by": "Выдаліць каманду", "uk": "Видалити команду", "kaa": "Komandanı joyw"
  },
  "team.deleteTeamConfirm": {
    "uz": "Jamoani o'chirish kerakmi? Barcha a'zolar uziladi. Bu amalni qaytarib bo'lmaydi.",
    "kz": "Команданы жою керек пе? Барлық мүшелер ажыратылады. Бұл амалды кері қайтаруға болмайды.",
    "ky": "Команданы жоюу керекпи? Бардык мүчөлөр ажыратылат. Бул аракетти кайтарып болбойт.",
    "tg": "Дастаро нест кунем? Ҳамаи аъзоён қатъ мешаванд. Ин амалро бозгардонидан мумкин нест.",
    "by": "Выдаліць каманду? Усе ўдзельнікі будуць адключаны. Гэта дзеянне немагчыма адмяніць.",
    "uk": "Видалити команду? Усі учасники будуть від'єднані. Цю дію неможливо скасувати.",
    "kaa": "Komandanı joyw kerek pe? Barlik azalar ajıratıladı. Bul amaldı qaytarıp bolmadı."
  },
  "team.deleteSuccess": {
    "uz": "Jamoa o'chirildi", "kz": "Команда жойылды", "ky": "Команда жойулду",
    "tg": "Даста нест шуд", "by": "Каманда выдалена", "uk": "Команду видалено", "kaa": "Komanda joyıldı"
  },
  "team.settings.general": {
    "uz": "Umumiy", "kz": "Жалпы", "ky": "Жалпы", "tg": "Умумӣ",
    "by": "Агульныя", "uk": "Загальні", "kaa": "Ulıwma"
  },
  "team.settings.logo": {
    "uz": "Logotip", "kz": "Логотип", "ky": "Логотип", "tg": "Логотип",
    "by": "Лагатып", "uk": "Логотип", "kaa": "Logotip"
  },
  "team.settings.booking": {
    "uz": "Bron qilish", "kz": "Брондау", "ky": "Брондоо", "tg": "Бронкунӣ",
    "by": "Бранiраванне", "uk": "Бронювання", "kaa": "Bronlaw"
  },
  "team.settings.notifications": {
    "uz": "Bildirishnomalar", "kz": "Хабарландырулар", "ky": "Билдирүүлөр", "tg": "Огоҳиҳо",
    "by": "Апавяшчэнні", "uk": "Сповіщення", "kaa": "Xabarlawlar"
  },
  "team.settings.danger": {
    "uz": "Xavfli zona", "kz": "Қауіпті аймақ", "ky": "Коркунучтуу зона", "tg": "Зонаи хавфнок",
    "by": "Небяспечная зона", "uk": "Небезпечна зона", "kaa": "Qáwipli zona"
  },
  "team.settingsTitle": {
    "uz": "Jamoa sozlamalari", "kz": "Команда параметрлері", "ky": "Команданын жөндөөлөрү", "tg": "Танзимоти даста",
    "by": "Налады каманды", "uk": "Налаштування команди", "kaa": "Komanda sazlamaları"
  },
  "team.noTeamYet": {
    "uz": "Hali jamoa yo'q", "kz": "Әлі команда жоқ", "ky": "Азырынча команда жок", "tg": "Ҳанӯз дастае нест",
    "by": "Пакуль каманды няма", "uk": "Команди поки немає", "kaa": "Áli komanda joq"
  },
  "team.createOrJoin": {
    "uz": "Jamoa yarating yoki qo'shiling", "kz": "Команда жасаңыз немесе қосылыңыз",
    "ky": "Команда түзүңүз же кириңиз", "tg": "Даста созед ё пайванд шавед",
    "by": "Стварыце або далучыцеся да каманды", "uk": "Створіть або приєднайтесь до команди",
    "kaa": "Komanda jasań yáki qosılıń"
  },
  "team.leave": {
    "uz": "Jamoani tark etish", "kz": "Командадан шығу", "ky": "Командадан чыгуу", "tg": "Аз даста хориҷ шавед",
    "by": "Пакінуць каманду", "uk": "Покинути команду", "kaa": "Komandadan shıǵıw"
  },
  "team.leaveConfirm": {
    "uz": "Jamoani tark etmoqchimisiz?", "kz": "Командадан шығасыз ба?",
    "ky": "Командадан чыгасызбы?", "tg": "Мехоҳед аз даста хориҷ шавед?",
    "by": "Вы хочаце пакінуць каманду?", "uk": "Ви хочете покинути команду?",
    "kaa": "Komandadan shıǵıwǵa isenim bar ma?"
  },
  "team.leaveSuccess": {
    "uz": "Jamoani tark etdingiz", "kz": "Командадан шықтыңыз",
    "ky": "Командадан чыктыңыз", "tg": "Шумо аз даста хориҷ шудед",
    "by": "Вы пакінулі каманду", "uk": "Ви покинули команду",
    "kaa": "Komandadan shıqtıńız"
  },
  "team.slugHint": {
    "uz": "Lotin harflari, raqamlar va chiziqcha", "kz": "Латын әріптері, сандар және сызықша",
    "ky": "Латын тамгалары, сандар жана сызыкча", "tg": "Ҳарфҳои лотинӣ, рақамҳо ва тире",
    "by": "Лацінскія літары, лічбы і злучок", "uk": "Латинські літери, цифри та дефіс",
    "kaa": "Latın háripleri, sanlar hám sızıqsha"
  },
  "team.inviteTitle": {
    "uz": "Takliflar", "kz": "Шақырулар", "ky": "Чакырылар", "tg": "Даъватҳо",
    "by": "Запрашэнні", "uk": "Запрошення", "kaa": "Shaqırıwlar"
  },
  "team.inviteCreate": {
    "uz": "Taklif yaratish", "kz": "Шақыру жасау", "ky": "Чакыруу түзүү", "tg": "Даъват созед",
    "by": "Стварыць запрашэнне", "uk": "Створити запрошення", "kaa": "Shaqırıw jasaw"
  },
  "team.inviteLink": {
    "uz": "Taklif havolasi", "kz": "Шақыру сілтемесі", "ky": "Чакыруу шилтемеси", "tg": "Пайванди даъват",
    "by": "Спасылка запрашэння", "uk": "Посилання запрошення", "kaa": "Shaqırıw shola"
  },
  "team.inviteCopied": {
    "uz": "Havola nusxalandi", "kz": "Сілтеме нусқаланды", "ky": "Шилтеме көчүрүлдү", "tg": "Пайванд нусха бардошта шуд",
    "by": "Спасылка скапіравана", "uk": "Посилання скопійовано", "kaa": "Shola nusqalandı"
  },
  "team.inviteUsed": {
    "uz": "Ishlatildi", "kz": "Пайдаланылды", "ky": "Колдонулду", "tg": "Истифода шуд",
    "by": "Выкарыстаны", "uk": "Використано", "kaa": "Isletildi"
  },
  "team.inviteRevoke": {
    "uz": "Bekor qilish", "kz": "Қайтарып алу", "ky": "Кайтаруу", "tg": "Бозпас гирифтан",
    "by": "Адклікаць", "uk": "Відкликати", "kaa": "Bekar qılıw"
  },
  "team.memberCount": {
    "uz": "{{count}} ta a'zo", "kz": "{{count}} мүше", "ky": "{{count}} мүчө", "tg": "{{count}} аъзо",
    "by": "{{count}} удзельнікаў", "uk": "{{count}} учасників", "kaa": "{{count}} aza"
  },
  "team.noMembers": {
    "uz": "Hali a'zolar yo'q", "kz": "Әлі мүшелер жоқ", "ky": "Азырынча мүчөлөр жок",
    "tg": "Ҳанӯз аъзо нест", "by": "Удзельнікаў пакуль няма", "uk": "Учасників поки немає",
    "kaa": "Azalar áli joq"
  },
  "team.removeMember": {
    "uz": "A'zoni o'chirish", "kz": "Мүшені жою", "ky": "Мүчөнү жою",
    "tg": "Аъзоро нест кунед", "by": "Выдаліць удзельніка", "uk": "Видалити учасника",
    "kaa": "Azanı joyw"
  },
  "team.removeMemberConfirm": {
    "uz": "A'zoni jamoadan chiqarish kerakmi?", "kz": "Мүшені командадан шығару керек пе?",
    "ky": "Мүчөнү командадан чыгаруу керекпи?", "tg": "Аъзоро аз даста хориҷ кунем?",
    "by": "Выдаліць удзельніка з каманды?", "uk": "Видалити учасника з команди?",
    "kaa": "Azanı komandadan shıǵarıw kerek pe?"
  },
  "team.removedSuccess": {
    "uz": "A'zo o'chirildi", "kz": "Мүше жойылды", "ky": "Мүчө жойулду",
    "tg": "Аъзо нест шуд", "by": "Удзельнік выдалены", "uk": "Учасника видалено",
    "kaa": "Aza joyıldı"
  },
  "team.joinCode": {
    "uz": "Qo'shilish kodi", "kz": "Кіру коды", "ky": "Кирүү коду",
    "tg": "Рамзи дохилшавӣ", "by": "Код уваходу", "uk": "Код входу",
    "kaa": "Kirisiw kodi"
  },
  "team.joinCodePlaceholder": {
    "uz": "Kodni kiriting...", "kz": "Кодты енгізіңіз...", "ky": "Кодду киргизиңиз...",
    "tg": "Рамзро ворид кунед...", "by": "Увядзіце код...", "uk": "Введіть код...",
    "kaa": "Kodtı kirisiń..."
  },
  "team.join": {
    "uz": "Qo'shilish", "kz": "Кіру", "ky": "Кирүү",
    "tg": "Дохил шавед", "by": "Далучыцца", "uk": "Приєднатися",
    "kaa": "Kirisiw"
  },
  "team.joinSuccess": {
    "uz": "Jamoaga qo'shildingiz", "kz": "Командаға кірдіңіз", "ky": "Командага кирдиңиз",
    "tg": "Шумо ба даста пайваст шудед", "by": "Вы далучыліся да каманды", "uk": "Ви приєднались до команди",
    "kaa": "Komandaǵa kirdińiz"
  },
  "team.joinError": {
    "uz": "Noto'g'ri yoki eskirgan kod", "kz": "Қате немесе ескірген код",
    "ky": "Туура эмес же эскирген код", "tg": "Рамзи нодуруст ё кӯҳна",
    "by": "Няправільны або ўстарэлы код", "uk": "Неправильний або застарілий код",
    "kaa": "Náwrıs yáki eski kod"
  },
  "team.analytics.revenue": {
    "uz": "Daromad", "kz": "Табыс", "ky": "Киреше",
    "tg": "Даромад", "by": "Выручка", "uk": "Виручка", "kaa": "Daromat"
  },
  "team.analytics.appointments": {
    "uz": "Yozuvlar", "kz": "Жазбалар", "ky": "Жазуулар",
    "tg": "Сабтҳо", "by": "Запісы", "uk": "Записи", "kaa": "Jazıwlar"
  },
  "team.analytics.clients": {
    "uz": "Mijozlar", "kz": "Клиенттер", "ky": "Кардарлар",
    "tg": "Муштариён", "by": "Кліенты", "uk": "Клієнти", "kaa": "Mijozlar"
  },
  "team.analytics.perMaster": {
    "uz": "Har bir master bo'yicha", "kz": "Шебер бойынша", "ky": "Чебер боюнча",
    "tg": "Аз рӯи устод", "by": "Па майстру", "uk": "По майстру", "kaa": "Sheber boyınsha"
  },
  "team.analytics.noData": {
    "uz": "Ma'lumot yo'q", "kz": "Деректер жоқ", "ky": "Маалымат жок",
    "tg": "Маълумот нест", "by": "Дадзеных няма", "uk": "Даних немає", "kaa": "Málimet joq"
  },
  "team.analytics.totalRevenue": {
    "uz": "Jami daromad", "kz": "Жалпы табыс", "ky": "Жалпы киреше",
    "tg": "Даромади умумӣ", "by": "Агульная выручка", "uk": "Загальна виручка", "kaa": "Ulıwma daromat"
  },
  "team.analytics.totalAppointments": {
    "uz": "Jami yozuvlar", "kz": "Барлық жазбалар", "ky": "Бардык жазуулар",
    "tg": "Ҳамаи сабтҳо", "by": "Усе запісы", "uk": "Всі записи", "kaa": "Barlıq jazıwlar"
  },
  "team.analytics.activeMembers": {
    "uz": "Faol a'zolar", "kz": "Белсенді мүшелер", "ky": "Активдүү мүчөлөр",
    "tg": "Аъзоёни фаъол", "by": "Актыўныя ўдзельнікі", "uk": "Активні учасники", "kaa": "Aktiv azalar"
  },

  # ── admin (most visible) ──────────────────────────────────────────────────────
  "admin.searchUsers": {
    "uz": "Ism yoki email bo'yicha qidirish...", "kz": "Аты немесе email бойынша іздеу...",
    "ky": "Аты же email боюнча издөө...", "tg": "Ҷустуҷӯ аз рӯи ном ё email...",
    "by": "Пошук па імені або email...", "uk": "Пошук за ім'ям або email...",
    "kaa": "Atı yáki email boyınsha qıdırıw..."
  },
  "admin.usersNotFound": {
    "uz": "Foydalanuvchilar topilmadi", "kz": "Пайдаланушылар табылмады",
    "ky": "Колдонуучулар табылган жок", "tg": "Корбарон ёфт нашуданд",
    "by": "Карыстальнікі не знойдзены", "uk": "Користувачів не знайдено",
    "kaa": "Paydalanıwshılar tabılmadı"
  },
  "admin.disableUser": {
    "uz": "Foydalanuvchini o'chirish", "kz": "Пайдаланушыны өшіру",
    "ky": "Колдонуучуну өчүрүү", "tg": "Корбарро ғайрифаъол кунед",
    "by": "Адключыць карыстальніка", "uk": "Вимкнути користувача",
    "kaa": "Paydalanıwshını ósiriw"
  },
  "admin.enableUser": {
    "uz": "Foydalanuvchini yoqish", "kz": "Пайдаланушыны қосу",
    "ky": "Колдонуучуну күйгүзүү", "tg": "Корбарро фаъол кунед",
    "by": "Уключыць карыстальніка", "uk": "Увімкнути користувача",
    "kaa": "Paydalanıwshını yaqlaw"
  },
  "admin.userDisabled": {
    "uz": "Foydalanuvchi o'chirildi", "kz": "Пайдаланушы өшірілді",
    "ky": "Колдонуучу өчүрүлдү", "tg": "Корбар ғайрифаъол шуд",
    "by": "Карыстальнік адключаны", "uk": "Користувача вимкнено",
    "kaa": "Paydalanıwshı ósiriw"
  },
  "admin.userEnabled": {
    "uz": "Foydalanuvchi yoqildi", "kz": "Пайдаланушы қосылды",
    "ky": "Колдонуучу күйгүзүлдү", "tg": "Корбар фаъол шуд",
    "by": "Карыстальнік уключаны", "uk": "Користувача увімкнено",
    "kaa": "Paydalanıwshı yaqlawdı"
  },
  "admin.disabled": {
    "uz": "Bloklangan", "kz": "Бұғатталған", "ky": "Бөгөттөлгөн",
    "tg": "Манъшуда", "by": "Заблакаваны", "uk": "Заблокований", "kaa": "Bógeliw"
  },
  "admin.active": {
    "uz": "Faol", "kz": "Белсенді", "ky": "Активдүү",
    "tg": "Фаъол", "by": "Актыўны", "uk": "Активний", "kaa": "Aktiv"
  },
  "admin.userIsDisabled": {
    "uz": "Kirish bloklangan — foydalanuvchi kira olmaydi", "kz": "Кіру бұғатталған — пайдаланушы кіре алмайды",
    "ky": "Кирүү бөгөттөлгөн — колдонуучу кире албайт", "tg": "Дастрасӣ манъ шудааст — корбар ворид шуда наметавонад",
    "by": "Доступ заблакаваны — карыстальнік не можа ўвайсці", "uk": "Доступ заблоковано — користувач не може увійти",
    "kaa": "Kirisiw bógelgen — paydalanıwshı kire almadı"
  },
  "admin.exportCSV": {
    "uz": "CSV ga eksport", "kz": "CSV-ке экспорт", "ky": "CSV-ке экспорт",
    "tg": "Содир ба CSV", "by": "Экспарт у CSV", "uk": "Експорт у CSV", "kaa": "CSV-ke eksport"
  },
  "admin.exportDone": {
    "uz": "Eksport yakunlandi", "kz": "Экспорт аяқталды", "ky": "Экспорт аяктады",
    "tg": "Содир анҷом ёфт", "by": "Экспарт завершаны", "uk": "Експорт завершено", "kaa": "Eksport amaqlastı"
  },
  "admin.statsTotal": {
    "uz": "Jami", "kz": "Барлығы", "ky": "Бардыгы",
    "tg": "Ҳамаи", "by": "Усяго", "uk": "Всього", "kaa": "Barlıǵı"
  },
  "admin.statsNewMonth": {
    "uz": "Oyda yangi", "kz": "Айда жаңа", "ky": "Айда жаңы",
    "tg": "Нав дар моҳ", "by": "Новых за месяц", "uk": "Нових за місяць", "kaa": "Ayda jańa"
  },
  "admin.statsPaid": {
    "uz": "Pullik", "kz": "Ақылы", "ky": "Акылуу",
    "tg": "Пардохтшуда", "by": "Платных", "uk": "Платних", "kaa": "Aqılı"
  },
  "admin.statsDisabled": {
    "uz": "O'chirilgan", "kz": "Өшірілген", "ky": "Өчүрүлгөн",
    "tg": "Ғайрифаъол", "by": "Адключаных", "uk": "Вимкнених", "kaa": "Ósiriw"
  },
  "admin.colUser": {
    "uz": "Foydalanuvchi", "kz": "Пайдаланушы", "ky": "Колдонуучу",
    "tg": "Корбар", "by": "Карыстальнік", "uk": "Користувач", "kaa": "Paydalanıwshı"
  },
  "admin.colPlan": {
    "uz": "Tarif", "kz": "Жоспар", "ky": "План",
    "tg": "Нақша", "by": "Тарыф", "uk": "Тариф", "kaa": "Tarif"
  },
  "admin.colAdmin": {
    "uz": "Admin", "kz": "Әкімші", "ky": "Администратор",
    "tg": "Маъмур", "by": "Адмін", "uk": "Адмін", "kaa": "Admin"
  },
  "admin.colStatus": {
    "uz": "Holat", "kz": "Күй", "ky": "Абал",
    "tg": "Вазъият", "by": "Статус", "uk": "Статус", "kaa": "Jaǵday"
  },
  "admin.limitMetric": {
    "uz": "Ko'rsatkich", "kz": "Метрика", "ky": "Метрика",
    "tg": "Метрика", "by": "Метрыка", "uk": "Метрика", "kaa": "Metrika"
  },
  "admin.limitHint": {
    "uz": "Agar bu limit kerak bo'lmasa, qatorni o'chiring.",
    "kz": "Бұл шектеу қажет болмаса жолды өшіріңіз.",
    "ky": "Эгер бул чек керек болбосо, сапты өчүрүңүз.",
    "tg": "Агар ин маҳдудият лозим набошад, сатрро ғайрифаъол кунед.",
    "by": "Адключыце радок, калі гэты ліміт не патрэбны.",
    "uk": "Вимкніть рядок, якщо цей ліміт не потрібен.",
    "kaa": "Bul limit kerek bolmasa, qatardı ósiriń."
  },
}


def set_nested(obj, key_path, value):
    keys = key_path.split('.')
    d = obj
    for k in keys[:-1]:
        if k in d and not isinstance(d[k], dict):
            # Intermediate key is a non-dict (e.g. string) — can't nest under it
            return False
        d = d.setdefault(k, {})
    d[keys[-1]] = value
    return True


langs = ['uz', 'kz', 'ky', 'tg', 'by', 'uk', 'kaa']
counts = {l: 0 for l in langs}

for lang in langs:
    path = f'public/locales/{lang}/translation.json'
    with open(path, 'r', encoding='utf-8') as f:
        loc = json.load(f)

    for key, translations in TRANSLATIONS.items():
        if translations is None:
            continue
        if lang not in translations:
            continue
        # Check if already set
        keys = key.split('.')
        d = loc
        missing = False
        for k in keys:
            if not isinstance(d, dict) or k not in d:
                missing = True
                break
            d = d[k]
        if missing:
            set_nested(loc, key, translations[lang])
            counts[lang] += 1

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(loc, f, ensure_ascii=False, indent=2)

for lang, count in counts.items():
    print(f'{lang}: added {count} translations')
