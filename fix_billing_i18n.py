import json, os, re

LOCALES_DIR = r'C:\Projects\Claude\ezze-app\public\locales'

BILLING_KEYS = {
  'en': {
    'planLimits': 'Plan Limits',
    'limitHint': 'Disable the row if this limit is not needed.',
    'limitMetric': 'Metric',
    'limitClients': 'Clients',
    'limitServices': 'Services',
    'limitAppts': 'Appointments per month',
    'billing': {
      'planSection': 'Subscription Plans',
      'planSectionDesc': 'Configure prices and limits for each plan',
      'prices': 'Prices',
      'pricesHint': 'Monthly subscription cost (in UZS)',
      'on': 'On',
      'unlimitedNote': 'Empty field = unlimited',
      'providers': 'Payment Providers',
      'paymeDesc': 'Accept payments via Payme (paycom.uz)',
      'paymeMerchantId': 'Merchant ID',
      'paymeKey': 'Secret Key',
      'clickDesc': 'Accept payments via Click.uz',
      'clickServiceId': 'Service ID',
      'clickMerchantId': 'Merchant ID',
      'clickKey': 'Secret Key',
      'secretNote': 'not shown after saving',
      'keyPlaceholder': 'Enter key',
      'notSet': 'not set',
      'subsTitle': 'User Subscriptions',
      'noSubs': 'No active subscriptions',
      'colUser': 'User', 'colPlan': 'Plan', 'colProvider': 'Provider',
      'colAmount': 'Amount', 'colExpires': 'Expires', 'colStatus': 'Status',
      'saved': 'Settings saved', 'limitsSaved': 'Limits saved',
    }
  },
  'uz': {
    'planLimits': "Tarif limitlari",
    'limitHint': "Agar bu limit kerak bo'lmasa, qatorni o'chiring.",
    'limitMetric': "Ko'rsatkich",
    'limitClients': "Mijozlar",
    'limitServices': "Xizmatlar",
    'limitAppts': "Oylik yozuvlar",
    'billing': {
      'planSection': "Tarif rejalari",
      'planSectionDesc': "Har bir tarif uchun narxlar va limitlarni sozlash",
      'prices': "Narxlar",
      'pricesHint': "Oylik obuna narxi (so'mda)",
      'on': "Faol",
      'unlimitedNote': "Bo'sh maydon = cheksiz",
      'providers': "To'lov provayderlari",
      'paymeDesc': "Payme orqali to'lov qabul qilish",
      'paymeMerchantId': "Merchant ID",
      'paymeKey': "Maxfiy kalit",
      'clickDesc': "Click.uz orqali to'lov qabul qilish",
      'clickServiceId': "Xizmat ID",
      'clickMerchantId': "Merchant ID",
      'clickKey': "Maxfiy kalit",
      'secretNote': "saqlangandan keyin ko'rsatilmaydi",
      'keyPlaceholder': "Kalitni kiriting",
      'notSet': "belgilanmagan",
      'subsTitle': "Foydalanuvchi obunalari",
      'noSubs': "Faol obunalar yo'q",
      'colUser': "Foydalanuvchi", 'colPlan': "Tarif", 'colProvider': "Provayder",
      'colAmount': "Summa", 'colExpires': "Amal muddati", 'colStatus': "Holat",
      'saved': "Sozlamalar saqlandi", 'limitsSaved': "Limitlar saqlandi",
    }
  },
  'kz': {
    'planLimits': "Тариф лимиттері",
    'limitHint': "Бұл лимит қажет болмаса жолды өшіріңіз.",
    'limitMetric': "Метрика",
    'limitClients': "Клиенттер",
    'limitServices': "Қызметтер",
    'limitAppts': "Айлық жазбалар",
    'billing': {
      'planSection': "Тариф жоспарлары",
      'planSectionDesc': "Әр тариф үшін бағалар мен лимиттерді баптаңыз",
      'prices': "Бағалар",
      'pricesHint': "Ай сайынғы жазылым құны (сомда)",
      'on': "Қосу",
      'unlimitedNote': "Бос өріс = шексіз",
      'providers': "Төлем провайдерлері",
      'paymeDesc': "Payme арқылы төлем қабылдау",
      'paymeMerchantId': "Merchant ID",
      'paymeKey': "Құпия кілт",
      'clickDesc': "Click.uz арқылы төлем қабылдау",
      'clickServiceId': "Service ID",
      'clickMerchantId': "Merchant ID",
      'clickKey': "Құпия кілт",
      'secretNote': "сақтаудан кейін көрсетілмейді",
      'keyPlaceholder': "Кілтті енгізіңіз",
      'notSet': "орнатылмаған",
      'subsTitle': "Пайдаланушы жазылымдары",
      'noSubs': "Белсенді жазылымдар жоқ",
      'colUser': "Пайдаланушы", 'colPlan': "Тариф", 'colProvider': "Провайдер",
      'colAmount': "Сомасы", 'colExpires': "Мерзімі", 'colStatus': "Күйі",
      'saved': "Параметрлер сақталды", 'limitsSaved': "Лимиттер сақталды",
    }
  },
  'ky': {
    'planLimits': "Тариф лимиттери",
    'limitHint': "Бул лимит керек болбосо, катарды өчүрүңүз.",
    'limitMetric': "Метрика",
    'limitClients': "Кардарлар",
    'limitServices': "Кызматтар",
    'limitAppts': "Айлык жазуулар",
    'billing': {
      'planSection': "Тариф пландары",
      'planSectionDesc': "Ар бир тариф үчүн баалар жана лимиттерди орнотуу",
      'prices': "Баалар",
      'pricesHint': "Айлык жазылуу баасы (сомдо)",
      'on': "Кошуу",
      'unlimitedNote': "Бош талаа = чексиз",
      'providers': "Төлөм провайдерлери",
      'paymeDesc': "Payme аркылуу төлөм кабыл алуу",
      'paymeMerchantId': "Merchant ID",
      'paymeKey': "Купуя ачкыч",
      'clickDesc': "Click.uz аркылуу төлөм кабыл алуу",
      'clickServiceId': "Service ID",
      'clickMerchantId': "Merchant ID",
      'clickKey': "Купуя ачкыч",
      'secretNote': "сакталгандан кийин көрсөтүлбөйт",
      'keyPlaceholder': "Ачкычты киргизиңиз",
      'notSet': "белгиленген эмес",
      'subsTitle': "Колдонуучунун жазылуулары",
      'noSubs': "Активдүү жазылуулар жок",
      'colUser': "Колдонуучу", 'colPlan': "Тариф", 'colProvider': "Провайдер",
      'colAmount': "Суммасы", 'colExpires': "Мөөнөтү", 'colStatus': "Абалы",
      'saved': "Параметрлер сакталды", 'limitsSaved': "Лимиттер сакталды",
    }
  },
  'tg': {
    'planLimits': "Маҳдудиятҳои тариф",
    'limitHint': "Агар ин маҳдудият лозим набошад, сатрро ғайрифаъол кунед.",
    'limitMetric': "Метрика",
    'limitClients': "Мизоҷон",
    'limitServices': "Хизматҳо",
    'limitAppts': "Сабтҳои моҳона",
    'billing': {
      'planSection': "Нақшаҳои тариф",
      'planSectionDesc': "Танзими нархҳо ва маҳдудиятҳо барои ҳар нақша",
      'prices': "Нархҳо",
      'pricesHint': "Арзиши обунаи моҳона (дар сӯм)",
      'on': "Фаъол",
      'unlimitedNote': "Майдони холӣ = бемаҳдуд",
      'providers': "Провайдерҳои пардохт",
      'paymeDesc': "Қабули пардохт тавассути Payme",
      'paymeMerchantId': "Merchant ID",
      'paymeKey': "Калиди махфӣ",
      'clickDesc': "Қабули пардохт тавассути Click.uz",
      'clickServiceId': "Service ID",
      'clickMerchantId': "Merchant ID",
      'clickKey': "Калиди махфӣ",
      'secretNote': "пас аз захира нишон дода намешавад",
      'keyPlaceholder': "Калидро ворид кунед",
      'notSet': "муайян нашудааст",
      'subsTitle': "Обунаҳои корбарон",
      'noSubs': "Обунаҳои фаъол вуҷуд надорад",
      'colUser': "Корбар", 'colPlan': "Тариф", 'colProvider': "Провайдер",
      'colAmount': "Маблағ", 'colExpires': "Мӯҳлат", 'colStatus': "Ҳолат",
      'saved': "Танзимот захира шуд", 'limitsSaved': "Маҳдудиятҳо захира шуд",
    }
  },
  'by': {
    'planLimits': "Ліміты тарыфаў",
    'limitHint': "Адключыце радок, калі гэты ліміт не патрэбны.",
    'limitMetric': "Метрыка",
    'limitClients': "Кліенты",
    'limitServices': "Паслугі",
    'limitAppts': "Запісаў у месяц",
    'billing': {
      'planSection': "Тарыфныя планы",
      'planSectionDesc': "Настройка коштаў і лімітаў для кожнага тарыфу",
      'prices': "Кошты",
      'pricesHint': "Кошт падпіскі ў месяц (у сумах)",
      'on': "Укл",
      'unlimitedNote': "Пустое поле = беззмест",
      'providers': "Плацежныя правайдэры",
      'paymeDesc': "Прыём аплаты праз Payme",
      'paymeMerchantId': "Merchant ID",
      'paymeKey': "Сакрэтны ключ",
      'clickDesc': "Прыём аплаты праз Click.uz",
      'clickServiceId': "Service ID",
      'clickMerchantId': "Merchant ID",
      'clickKey': "Сакрэтны ключ",
      'secretNote': "не адлюстроўваецца пасля захавання",
      'keyPlaceholder': "Увядзіце ключ",
      'notSet': "не зададзены",
      'subsTitle': "Падпіскі карыстальнікаў",
      'noSubs': "Актыўных падпісак няма",
      'colUser': "Карыстальнік", 'colPlan': "Тарыф", 'colProvider': "Правайдэр",
      'colAmount': "Сума", 'colExpires': "Дзейнічае да", 'colStatus': "Статус",
      'saved': "Налады захаваны", 'limitsSaved': "Ліміты захаваны",
    }
  },
  'uk': {
    'planLimits': "Ліміти тарифів",
    'limitHint': "Вимкніть рядок, якщо цей ліміт не потрібен.",
    'limitMetric': "Метрика",
    'limitClients': "Клієнти",
    'limitServices': "Послуги",
    'limitAppts': "Записів на місяць",
    'billing': {
      'planSection': "Тарифні плани",
      'planSectionDesc': "Налаштування цін та лімітів для кожного тарифу",
      'prices': "Ціни",
      'pricesHint': "Вартість підписки на місяць (у сумах)",
      'on': "Увімк",
      'unlimitedNote': "Порожнє поле = безліміт",
      'providers': "Платіжні провайдери",
      'paymeDesc': "Прийом оплати через Payme",
      'paymeMerchantId': "Merchant ID",
      'paymeKey': "Секретний ключ",
      'clickDesc': "Прийом оплати через Click.uz",
      'clickServiceId': "Service ID",
      'clickMerchantId': "Merchant ID",
      'clickKey': "Секретний ключ",
      'secretNote': "не відображається після збереження",
      'keyPlaceholder': "Введіть ключ",
      'notSet': "не задано",
      'subsTitle': "Підписки користувачів",
      'noSubs': "Немає активних підписок",
      'colUser': "Користувач", 'colPlan': "Тариф", 'colProvider': "Провайдер",
      'colAmount': "Сума", 'colExpires': "Діє до", 'colStatus': "Статус",
      'saved': "Налаштування збережено", 'limitsSaved': "Ліміти збережено",
    }
  },
  'kaa': {
    'planLimits': "Tarif limitleri",
    'limitHint': "Bul limit kerek bolmasa, qatardı ósiriń.",
    'limitMetric': "Metrika",
    'limitClients': "Klientler",
    'limitServices': "Xizmetler",
    'limitAppts': "Aylıq jazıwlar",
    'billing': {
      'planSection': "Tarif planlari",
      'planSectionDesc': "Ar bir tarif ushın bahalardı ham limitlerdi sozlaw",
      'prices': "Bahalar",
      'pricesHint': "Aylıq jazılıw bahası (sumda)",
      'on': "Faol",
      'unlimitedNote': "Bos maydan = sheksiz",
      'providers': "Tolem provayderleri",
      'paymeDesc': "Payme arqalı tolem qabıllaw",
      'paymeMerchantId': "Merchant ID",
      'paymeKey': "Qupıya açqısh",
      'clickDesc': "Click.uz arqalı tolem qabıllaw",
      'clickServiceId': "Service ID",
      'clickMerchantId': "Merchant ID",
      'clickKey': "Qupıya açqısh",
      'secretNote': "saqlangannan keyin korsetilmeydi",
      'keyPlaceholder': "Açqıshtı kiriting",
      'notSet': "belgilengen emes",
      'subsTitle': "Paydalanıwshı jazılıwları",
      'noSubs': "Aktiv jazılıwlar joq",
      'colUser': "Paydalanıwshı", 'colPlan': "Tarif", 'colProvider': "Provayder",
      'colAmount': "Summa", 'colExpires': "Merzimi", 'colStatus': "Halı",
      'saved': "Sozlamalar saqlandı", 'limitsSaved': "Limitler saqlandı",
    }
  },
}

ANCHOR = '"notifyPerMasterDesc"'

for lang, keys in BILLING_KEYS.items():
    path = os.path.join(LOCALES_DIR, lang, 'translation.json')
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Remove old duplicate limitMetric + limitHint (standalone versions before emailDesc)
    text = re.sub(
        r'\n    "limitMetric": "[^"]*",\n    "limitHint": "[^"]*",\n    ("emailDesc":)',
        r'\n    \1',
        text
    )

    # Check if billing block already added (idempotent)
    if '"planLimits"' in text and '"billing"' in text and '"planSection"' in text:
        print(f"SKIP: {lang} already has billing keys")
        continue

    # Find anchor line and insert after it
    anchor_pos = text.find(ANCHOR)
    if anchor_pos == -1:
        print(f"WARN: anchor not found in {lang}")
        continue

    end_of_anchor_line = text.index('\n', anchor_pos) + 1

    # Build billing sub-object
    billing = keys['billing']
    billing_lines = ['    "billing": {']
    items = list(billing.items())
    for i, (k, v) in enumerate(items):
        comma = ',' if i < len(items) - 1 else ''
        billing_lines.append(f'      {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}{comma}')
    billing_lines.append('    },')
    billing_block = '\n'.join(billing_lines)

    insert = (
        f'    "planLimits": {json.dumps(keys["planLimits"], ensure_ascii=False)},\n'
        f'    "limitHint": {json.dumps(keys["limitHint"], ensure_ascii=False)},\n'
        f'    "limitMetric": {json.dumps(keys["limitMetric"], ensure_ascii=False)},\n'
        f'    "limitClients": {json.dumps(keys["limitClients"], ensure_ascii=False)},\n'
        f'    "limitServices": {json.dumps(keys["limitServices"], ensure_ascii=False)},\n'
        f'    "limitAppts": {json.dumps(keys["limitAppts"], ensure_ascii=False)},\n'
        f'{billing_block}\n'
    )

    text = text[:end_of_anchor_line] + insert + text[end_of_anchor_line:]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f"OK: {lang}")

print("Done")
