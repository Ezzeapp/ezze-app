import json

REVIEWS = {
    "ru": {
        "subtitle": "Отзывы клиентов о вашей работе",
        "avgRating": "Средний рейтинг",
        "total": "Всего отзывов",
        "visible": "Опубликовано",
        "hidden": "Скрыто",
        "distribution": "Распределение оценок",
        "empty": "Нет отзывов",
        "emptyHint": "Отзывы появятся здесь после того, как клиенты оставят их через форму бронирования",
        "client": "Клиент",
        "hiddenBadge": "Скрыт",
        "hide": "Скрыть отзыв",
        "show": "Показать отзыв",
        "rateLabel": "Оцените мастера",
        "commentPlaceholder": "Ваш комментарий (необязательно)",
        "submitButton": "Оставить отзыв",
        "submitSuccess": "✅ Спасибо за отзыв!"
    },
    "en": {
        "subtitle": "Client reviews about your work",
        "avgRating": "Average rating",
        "total": "Total reviews",
        "visible": "Published",
        "hidden": "Hidden",
        "distribution": "Rating distribution",
        "empty": "No reviews",
        "emptyHint": "Reviews will appear here after clients leave them via the booking form",
        "client": "Client",
        "hiddenBadge": "Hidden",
        "hide": "Hide review",
        "show": "Show review",
        "rateLabel": "Rate the master",
        "commentPlaceholder": "Your comment (optional)",
        "submitButton": "Leave a review",
        "submitSuccess": "✅ Thank you for your review!"
    },
    "uz": {
        "subtitle": "Mijozlarning siz haqingizda fikrlari",
        "avgRating": "O'rtacha reyting",
        "total": "Jami sharhlar",
        "visible": "Nashr etilgan",
        "hidden": "Yashirilgan",
        "distribution": "Baholash taqsimoti",
        "empty": "Sharhlar yo'q",
        "emptyHint": "Mijozlar bron forma orqali sharh qoldirgandan so'ng bu yerda ko'rinadi",
        "client": "Mijoz",
        "hiddenBadge": "Yashirilgan",
        "hide": "Sharhni yashirish",
        "show": "Sharhni ko'rsatish",
        "rateLabel": "Ustani baholang",
        "commentPlaceholder": "Izohingiz (ixtiyoriy)",
        "submitButton": "Sharh qoldirish",
        "submitSuccess": "✅ Sharh uchun rahmat!"
    },
    "kz": {
        "subtitle": "Клиенттердің жұмысыңыз туралы пікірлері",
        "avgRating": "Орташа рейтинг",
        "total": "Барлық пікірлер",
        "visible": "Жарияланған",
        "hidden": "Жасырылған",
        "distribution": "Бағалардың бөлінуі",
        "empty": "Пікірлер жоқ",
        "emptyHint": "Клиенттер брондау формасы арқылы пікір қалдырғаннан кейін мұнда пайда болады",
        "client": "Клиент",
        "hiddenBadge": "Жасырылған",
        "hide": "Пікірді жасыру",
        "show": "Пікірді көрсету",
        "rateLabel": "Шеберді бағалаңыз",
        "commentPlaceholder": "Пікіріңіз (міндетті емес)",
        "submitButton": "Пікір қалдыру",
        "submitSuccess": "✅ Пікіріңіз үшін рахмет!"
    },
    "ky": {
        "subtitle": "Кардарлардын сиздин иш жөнүндөгү пикирлери",
        "avgRating": "Орточо рейтинг",
        "total": "Бардык пикирлер",
        "visible": "Жарыяланган",
        "hidden": "Жашырылган",
        "distribution": "Баалардын бөлүштүрүлүшү",
        "empty": "Пикирлер жок",
        "emptyHint": "Кардарлар брондоо формасы аркылуу пикир калтыргандан кийин бул жерде пайда болот",
        "client": "Кардар",
        "hiddenBadge": "Жашырылган",
        "hide": "Пикирди жашыруу",
        "show": "Пикирди көрсөтүү",
        "rateLabel": "Чеберди баалаңыз",
        "commentPlaceholder": "Комментарийиңиз (милдеттүү эмес)",
        "submitButton": "Пикир калтыруу",
        "submitSuccess": "✅ Пикириңиз үчүн рахмат!"
    },
    "tg": {
        "subtitle": "Назари муштариён дар бораи кори шумо",
        "avgRating": "Рейтинги миёна",
        "total": "Ҳамаи шарҳҳо",
        "visible": "Нашршуда",
        "hidden": "Пинҳоншуда",
        "distribution": "Тақсимоти баҳоҳо",
        "empty": "Шарҳҳо нест",
        "emptyHint": "Шарҳҳо пас аз он пайдо мешаванд, ки муштариён онҳоро тавассути шакли банд кардан гузоранд",
        "client": "Муштарӣ",
        "hiddenBadge": "Пинҳон",
        "hide": "Шарҳро пинҳон кунед",
        "show": "Шарҳро нишон диҳед",
        "rateLabel": "Устодро баҳо диҳед",
        "commentPlaceholder": "Шарҳи шумо (ихтиёрӣ)",
        "submitButton": "Шарҳ гузоштан",
        "submitSuccess": "✅ Барои шарҳ ташаккур!"
    },
    "by": {
        "subtitle": "Водгукі кліентаў аб вашай рабоце",
        "avgRating": "Сярэдні рэйтынг",
        "total": "Усяго водгукаў",
        "visible": "Апублікавана",
        "hidden": "Схавана",
        "distribution": "Размеркаванне ацэнак",
        "empty": "Водгукаў няма",
        "emptyHint": "Водгукі з'явяцца тут пасля таго, як кліенты пакінуць іх праз форму браніравання",
        "client": "Кліент",
        "hiddenBadge": "Схаваны",
        "hide": "Схаваць водгук",
        "show": "Паказаць водгук",
        "rateLabel": "Ацаніце майстра",
        "commentPlaceholder": "Ваш каментарый (неабавязкова)",
        "submitButton": "Пакінуць водгук",
        "submitSuccess": "✅ Дзякуй за водгук!"
    },
    "uk": {
        "subtitle": "Відгуки клієнтів про вашу роботу",
        "avgRating": "Середній рейтинг",
        "total": "Всього відгуків",
        "visible": "Опубліковано",
        "hidden": "Приховано",
        "distribution": "Розподіл оцінок",
        "empty": "Відгуків немає",
        "emptyHint": "Відгуки з'являться тут після того, як клієнти залишать їх через форму бронювання",
        "client": "Клієнт",
        "hiddenBadge": "Прихований",
        "hide": "Приховати відгук",
        "show": "Показати відгук",
        "rateLabel": "Оцініть майстра",
        "commentPlaceholder": "Ваш коментар (необов'язково)",
        "submitButton": "Залишити відгук",
        "submitSuccess": "✅ Дякуємо за відгук!"
    },
    "kaa": {
        "subtitle": "Mijozlardıń sizin jumısıńız haqqındaǵı pikirler",
        "avgRating": "Orta reytinг",
        "total": "Barlıq pikirler",
        "visible": "Járiyalanǵan",
        "hidden": "Jasırılǵan",
        "distribution": "Bahalardıń taqsimlanıwı",
        "empty": "Pikirler joq",
        "emptyHint": "Pikirler mijozlar bronlaw forması arqalı pikirlerin qaldırǵannan keyin kórinedi",
        "client": "Mijoz",
        "hiddenBadge": "Jasırılǵan",
        "hide": "Pikirdı jasırıw",
        "show": "Pikirdı kórsetiw",
        "rateLabel": "Sheberdı bahalay",
        "commentPlaceholder": "Pikiriñiz (ixtiyariy)",
        "submitButton": "Pikir qaldırıw",
        "submitSuccess": "✅ Pikiriñiz ushın rahmet!"
    }
}

langs = list(REVIEWS.keys())

for lang in langs:
    path = f'public/locales/{lang}/translation.json'
    with open(path, 'r', encoding='utf-8') as f:
        loc = json.load(f)

    loc['reviews'] = REVIEWS[lang]

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(loc, f, ensure_ascii=False, indent=2)
    print(f'{lang}: reviews section updated ({len(REVIEWS[lang])} keys)')
