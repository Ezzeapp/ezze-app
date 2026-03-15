#!/usr/bin/env python3
"""Add inventory stat keys + support section to all 9 locale files."""
import json, os

BASE = r'C:\Projects\Claude\ezze-app\public\locales'

# ── translations per locale ────────────────────────────────────────────────

INV_STATS = {
    'ru':  { 'statTotal': 'Всего позиций', 'statCategories': 'Категорий', 'statLowStock': 'Заканчивается', 'statOutOfStock': 'На нуле', 'statCostValue': 'Закупочная стоимость', 'statSellValue': 'Продажная стоимость', 'statMargin': 'Потенциальная прибыль' },
    'en':  { 'statTotal': 'Total items', 'statCategories': 'Categories', 'statLowStock': 'Low stock', 'statOutOfStock': 'Out of stock', 'statCostValue': 'Cost value', 'statSellValue': 'Sell value', 'statMargin': 'Potential profit' },
    'uz':  { 'statTotal': 'Jami mahsulotlar', 'statCategories': 'Kategoriyalar', 'statLowStock': 'Kamaymoqda', 'statOutOfStock': 'Tugagan', 'statCostValue': 'Xarid qiymati', 'statSellValue': 'Sotish qiymati', 'statMargin': 'Potensial foyda' },
    'kz':  { 'statTotal': 'Барлық позициялар', 'statCategories': 'Санаттар', 'statLowStock': 'Азайып барады', 'statOutOfStock': 'Таусылған', 'statCostValue': 'Сатып алу құны', 'statSellValue': 'Сату құны', 'statMargin': 'Ықтимал пайда' },
    'ky':  { 'statTotal': 'Бардык позициялар', 'statCategories': 'Категориялар', 'statLowStock': 'Азайып жатат', 'statOutOfStock': 'Бүткөн', 'statCostValue': 'Сатып алуу наркы', 'statSellValue': 'Сатуу наркы', 'statMargin': 'Потенциалдуу пайда' },
    'tg':  { 'statTotal': 'Ҳамаи мавқеъҳо', 'statCategories': 'Категорияҳо', 'statLowStock': 'Кам мешавад', 'statOutOfStock': 'Тамомшуда', 'statCostValue': 'Арзиши харид', 'statSellValue': 'Арзиши фурӯш', 'statMargin': 'Фоидаи имконпазир' },
    'by':  { 'statTotal': 'Усяго пазіцый', 'statCategories': 'Катэгорый', 'statLowStock': 'Заканчваецца', 'statOutOfStock': 'На нулі', 'statCostValue': 'Закупачная кошт', 'statSellValue': 'Прадажная кошт', 'statMargin': 'Патэнцыйны прыбытак' },
    'uk':  { 'statTotal': 'Всього позицій', 'statCategories': 'Категорій', 'statLowStock': 'Закінчується', 'statOutOfStock': 'На нулі', 'statCostValue': 'Закупівельна вартість', 'statSellValue': 'Продажна вартість', 'statMargin': 'Потенційний прибуток' },
    'kaa': { 'statTotal': 'Барлық позициялар', 'statCategories': 'Категориялар', 'statLowStock': 'Азайып барады', 'statOutOfStock': 'Таусылған', 'statCostValue': 'Сатып алыў баҳасы', 'statSellValue': 'Сатыў баҳасы', 'statMargin': 'Потенциал пайда' },
}

SUPPORT = {
    'ru':  { 'title': 'Тех. поддержка', 'newTicket': 'Новое обращение', 'type': 'Тип обращения', 'typeBug': 'Ошибка / проблема', 'typeFeature': 'Новый функционал', 'typeQuestion': 'Вопрос', 'typeOther': 'Другое', 'titleField': 'Заголовок', 'titlePlaceholder': 'Кратко опишите', 'message': 'Описание', 'messagePlaceholder': 'Опишите подробнее...', 'submit': 'Отправить', 'submitted': 'Обращение отправлено', 'noTickets': 'Обращений пока нет', 'statusNew': 'Новое', 'statusInProgress': 'В работе', 'statusResolved': 'Решено', 'statusClosed': 'Закрыто' },
    'en':  { 'title': 'Support', 'newTicket': 'New ticket', 'type': 'Type', 'typeBug': 'Bug / issue', 'typeFeature': 'Feature request', 'typeQuestion': 'Question', 'typeOther': 'Other', 'titleField': 'Subject', 'titlePlaceholder': 'Brief description', 'message': 'Message', 'messagePlaceholder': 'Describe in detail...', 'submit': 'Submit', 'submitted': 'Ticket submitted', 'noTickets': 'No tickets yet', 'statusNew': 'New', 'statusInProgress': 'In progress', 'statusResolved': 'Resolved', 'statusClosed': 'Closed' },
    'uz':  { 'title': 'Texnik yordam', 'newTicket': 'Yangi murojaat', 'type': 'Murojaat turi', 'typeBug': 'Xatolik / muammo', 'typeFeature': 'Yangi funksiya', 'typeQuestion': 'Savol', 'typeOther': 'Boshqa', 'titleField': 'Sarlavha', 'titlePlaceholder': 'Qisqacha tasvirlab bering', 'message': 'Tavsif', 'messagePlaceholder': 'Batafsilroq tasvirlab bering...', 'submit': 'Yuborish', 'submitted': 'Murojaat yuborildi', 'noTickets': 'Murojaatlar yo\'q', 'statusNew': 'Yangi', 'statusInProgress': 'Ishlanmoqda', 'statusResolved': 'Hal qilindi', 'statusClosed': 'Yopildi' },
    'kz':  { 'title': 'Техникалық қолдау', 'newTicket': 'Жаңа өтініш', 'type': 'Өтініш түрі', 'typeBug': 'Қате / мәселе', 'typeFeature': 'Жаңа функционал', 'typeQuestion': 'Сұрақ', 'typeOther': 'Басқа', 'titleField': 'Тақырып', 'titlePlaceholder': 'Қысқаша сипаттаңыз', 'message': 'Сипаттама', 'messagePlaceholder': 'Толығырақ сипаттаңыз...', 'submit': 'Жіберу', 'submitted': 'Өтініш жіберілді', 'noTickets': 'Өтініштер жоқ', 'statusNew': 'Жаңа', 'statusInProgress': 'Жұмыста', 'statusResolved': 'Шешілді', 'statusClosed': 'Жабылды' },
    'ky':  { 'title': 'Техникалык колдоо', 'newTicket': 'Жаңы кайрылуу', 'type': 'Кайрылуу түрү', 'typeBug': 'Ката / маселе', 'typeFeature': 'Жаңы функционал', 'typeQuestion': 'Суроо', 'typeOther': 'Башка', 'titleField': 'Тема', 'titlePlaceholder': 'Кыскача сүрөттөңүз', 'message': 'Сүрөттөмө', 'messagePlaceholder': 'Толугураак сүрөттөңүз...', 'submit': 'Жөнөтүү', 'submitted': 'Кайрылуу жөнөтүлдү', 'noTickets': 'Кайрылуулар жок', 'statusNew': 'Жаңы', 'statusInProgress': 'Иштелүүдө', 'statusResolved': 'Чечилди', 'statusClosed': 'Жабылды' },
    'tg':  { 'title': 'Дастгирии техникӣ', 'newTicket': 'Муроҷиати нав', 'type': 'Навъи муроҷиат', 'typeBug': 'Хато / мушкилот', 'typeFeature': 'Функсияи нав', 'typeQuestion': 'Савол', 'typeOther': 'Дигар', 'titleField': 'Сарлавҳа', 'titlePlaceholder': 'Мухтасар тавсиф диҳед', 'message': 'Тавсиф', 'messagePlaceholder': 'Муфассалтар тавсиф диҳед...', 'submit': 'Фиристодан', 'submitted': 'Муроҷиат фиристода шуд', 'noTickets': 'Ҳоло муроҷиате нест', 'statusNew': 'Нав', 'statusInProgress': 'Дар кор', 'statusResolved': 'Ҳал шуд', 'statusClosed': 'Баста шуд' },
    'by':  { 'title': 'Тэхнічная падтрымка', 'newTicket': 'Новы зварот', 'type': 'Тып звароту', 'typeBug': 'Памылка / праблема', 'typeFeature': 'Новы функцыянал', 'typeQuestion': 'Пытанне', 'typeOther': 'Іншае', 'titleField': 'Загаловак', 'titlePlaceholder': 'Кратка апішыце', 'message': 'Апісанне', 'messagePlaceholder': 'Апішыце падрабязней...', 'submit': 'Адправіць', 'submitted': 'Зварот адпраўлены', 'noTickets': 'Зваротаў пакуль няма', 'statusNew': 'Новы', 'statusInProgress': 'У рабоце', 'statusResolved': 'Вырашана', 'statusClosed': 'Закрыта' },
    'uk':  { 'title': 'Технічна підтримка', 'newTicket': 'Нове звернення', 'type': 'Тип звернення', 'typeBug': 'Помилка / проблема', 'typeFeature': 'Новий функціонал', 'typeQuestion': 'Питання', 'typeOther': 'Інше', 'titleField': 'Заголовок', 'titlePlaceholder': 'Коротко опишіть', 'message': 'Опис', 'messagePlaceholder': 'Опишіть детальніше...', 'submit': 'Надіслати', 'submitted': 'Звернення надіслано', 'noTickets': 'Звернень поки немає', 'statusNew': 'Нове', 'statusInProgress': 'В роботі', 'statusResolved': 'Вирішено', 'statusClosed': 'Закрито' },
    'kaa': { 'title': 'Техникалық қоллав', 'newTicket': 'Жаңа мүрәжат', 'type': 'Мүрәжат түри', 'typeBug': 'Қәтелик / мәсле', 'typeFeature': 'Жаңа функционал', 'typeQuestion': 'Соraw', 'typeOther': 'Басқа', 'titleField': 'Тема', 'titlePlaceholder': 'Қысқаша сүwретлеңиз', 'message': 'Сүwретлеме', 'messagePlaceholder': 'Толығырақ сүwретлеңиз...', 'submit': 'Жибериw', 'submitted': 'Мүрәжат жиберилди', 'noTickets': 'Мүрәжатлар жоқ', 'statusNew': 'Жаңа', 'statusInProgress': 'Ислениwде', 'statusResolved': 'Шешилdi', 'statusClosed': 'Жабылды' },
}

NAV_SUPPORT = {
    'ru': 'Поддержка', 'en': 'Support', 'uz': 'Yordam', 'kz': 'Қолдау',
    'ky': 'Колдоо', 'tg': 'Дастгирӣ', 'by': 'Падтрымка', 'uk': 'Підтримка', 'kaa': 'Қоллав',
}

LOCALES = ['ru', 'en', 'uz', 'kz', 'ky', 'tg', 'by', 'uk', 'kaa']

for lng in LOCALES:
    path = os.path.join(BASE, lng, 'translation.json')
    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    # 1. Add nav.support
    if 'nav' in data:
        data['nav']['support'] = NAV_SUPPORT[lng]

    # 2. Add inventory stat keys
    if 'inventory' in data:
        data['inventory'].update(INV_STATS[lng])

    # 3. Add support section (top-level)
    data['support'] = SUPPORT[lng]

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'OK {lng}')

print('Done.')
