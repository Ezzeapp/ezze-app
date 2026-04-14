-- 040_clinic_icd10.sql — МКБ-10 справочник
CREATE TABLE IF NOT EXISTS clinic_icd10_codes (
  code TEXT PRIMARY KEY,
  name_ru TEXT NOT NULL,
  name_en TEXT,
  parent_code TEXT,
  chapter TEXT
);

CREATE INDEX idx_icd10_code_pattern ON clinic_icd10_codes(code text_pattern_ops);
CREATE INDEX idx_icd10_name_ru ON clinic_icd10_codes(name_ru);

ALTER TABLE clinic_icd10_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "icd10_read" ON clinic_icd10_codes FOR SELECT TO authenticated USING (true);

-- Seed: chapters + common codes
INSERT INTO clinic_icd10_codes (code, name_ru, name_en, chapter) VALUES
-- Chapter I: Инфекционные
('A00-B99', 'Некоторые инфекционные и паразитарные болезни', 'Infectious diseases', 'I'),
('A09', 'Диарея и гастроэнтерит инфекционного происхождения', 'Infectious diarrhoea', 'I'),
('A15', 'Туберкулёз органов дыхания', 'Respiratory tuberculosis', 'I'),
('A46', 'Рожа', 'Erysipelas', 'I'),
('B18', 'Хронический вирусный гепатит', 'Chronic viral hepatitis', 'I'),
('B34', 'Вирусная инфекция неуточнённая', 'Viral infection, unspecified', 'I'),

-- Chapter II: Новообразования
('C00-D48', 'Новообразования', 'Neoplasms', 'II'),
('C34', 'Злокачественное новообразование бронхов и лёгкого', 'Lung cancer', 'II'),
('C50', 'Злокачественное новообразование молочной железы', 'Breast cancer', 'II'),
('D25', 'Лейомиома матки', 'Uterine leiomyoma', 'II'),

-- Chapter III: Болезни крови
('D50-D89', 'Болезни крови и кроветворных органов', 'Blood diseases', 'III'),
('D50', 'Железодефицитная анемия', 'Iron deficiency anaemia', 'III'),
('D56', 'Талассемия', 'Thalassaemia', 'III'),

-- Chapter IV: Эндокринная система
('E00-E90', 'Болезни эндокринной системы', 'Endocrine diseases', 'IV'),
('E10', 'Сахарный диабет I типа', 'Type 1 diabetes', 'IV'),
('E11', 'Сахарный диабет II типа', 'Type 2 diabetes', 'IV'),
('E03', 'Гипотиреоз', 'Hypothyroidism', 'IV'),
('E05', 'Тиреотоксикоз', 'Thyrotoxicosis', 'IV'),
('E66', 'Ожирение', 'Obesity', 'IV'),
('E78', 'Нарушения обмена липопротеинов', 'Lipoprotein disorders', 'IV'),

-- Chapter V: Психические расстройства
('F00-F99', 'Психические расстройства', 'Mental disorders', 'V'),
('F32', 'Депрессивный эпизод', 'Depressive episode', 'V'),
('F41', 'Тревожные расстройства', 'Anxiety disorders', 'V'),
('F43', 'Реакция на стресс и нарушение адаптации', 'Stress reaction', 'V'),

-- Chapter VI: Нервная система
('G00-G99', 'Болезни нервной системы', 'Nervous system diseases', 'VI'),
('G43', 'Мигрень', 'Migraine', 'VI'),
('G44', 'Другие синдромы головной боли', 'Headache syndromes', 'VI'),
('G47', 'Расстройства сна', 'Sleep disorders', 'VI'),
('G54', 'Поражения нервных корешков', 'Nerve root disorders', 'VI'),

-- Chapter VII: Глаз
('H00-H59', 'Болезни глаза', 'Eye diseases', 'VII'),
('H10', 'Конъюнктивит', 'Conjunctivitis', 'VII'),
('H25', 'Старческая катаракта', 'Senile cataract', 'VII'),
('H40', 'Глаукома', 'Glaucoma', 'VII'),
('H52', 'Нарушения рефракции', 'Refractive disorders', 'VII'),

-- Chapter VIII: Ухо
('H60-H95', 'Болезни уха', 'Ear diseases', 'VIII'),
('H60', 'Наружный отит', 'External otitis', 'VIII'),
('H66', 'Средний отит гнойный', 'Suppurative otitis media', 'VIII'),

-- Chapter IX: Система кровообращения
('I00-I99', 'Болезни системы кровообращения', 'Circulatory diseases', 'IX'),
('I10', 'Эссенциальная гипертензия', 'Essential hypertension', 'IX'),
('I11', 'Гипертензивная болезнь сердца', 'Hypertensive heart disease', 'IX'),
('I20', 'Стенокардия', 'Angina pectoris', 'IX'),
('I21', 'Острый инфаркт миокарда', 'Acute myocardial infarction', 'IX'),
('I25', 'Хроническая ишемическая болезнь сердца', 'Chronic IHD', 'IX'),
('I48', 'Фибрилляция предсердий', 'Atrial fibrillation', 'IX'),
('I50', 'Сердечная недостаточность', 'Heart failure', 'IX'),
('I63', 'Инфаркт мозга', 'Cerebral infarction', 'IX'),
('I67', 'Другие цереброваскулярные болезни', 'Cerebrovascular diseases', 'IX'),
('I83', 'Варикозное расширение вен нижних конечностей', 'Varicose veins', 'IX'),

-- Chapter X: Органы дыхания
('J00-J99', 'Болезни органов дыхания', 'Respiratory diseases', 'X'),
('J00', 'Острый назофарингит (насморк)', 'Common cold', 'X'),
('J02', 'Острый фарингит', 'Acute pharyngitis', 'X'),
('J03', 'Острый тонзиллит', 'Acute tonsillitis', 'X'),
('J06', 'ОРВИ верхних дыхательных путей', 'Acute URTI', 'X'),
('J10', 'Грипп', 'Influenza', 'X'),
('J18', 'Пневмония', 'Pneumonia', 'X'),
('J20', 'Острый бронхит', 'Acute bronchitis', 'X'),
('J35', 'Хронические болезни миндалин и аденоидов', 'Chronic tonsillar disease', 'X'),
('J44', 'ХОБЛ', 'COPD', 'X'),
('J45', 'Астма', 'Asthma', 'X'),

-- Chapter XI: Органы пищеварения
('K00-K93', 'Болезни органов пищеварения', 'Digestive diseases', 'XI'),
('K02', 'Кариес зубов', 'Dental caries', 'XI'),
('K04', 'Болезни пульпы и периапикальных тканей', 'Pulp diseases', 'XI'),
('K05', 'Гингивит и пародонтоз', 'Gingivitis and periodontal', 'XI'),
('K21', 'Гастроэзофагеальная рефлюксная болезнь', 'GERD', 'XI'),
('K25', 'Язва желудка', 'Gastric ulcer', 'XI'),
('K26', 'Язва двенадцатиперстной кишки', 'Duodenal ulcer', 'XI'),
('K29', 'Гастрит и дуоденит', 'Gastritis and duodenitis', 'XI'),
('K35', 'Острый аппендицит', 'Acute appendicitis', 'XI'),
('K40', 'Паховая грыжа', 'Inguinal hernia', 'XI'),
('K80', 'Желчнокаменная болезнь', 'Cholelithiasis', 'XI'),
('K81', 'Холецистит', 'Cholecystitis', 'XI'),

-- Chapter XII: Кожа
('L00-L99', 'Болезни кожи', 'Skin diseases', 'XII'),
('L20', 'Атопический дерматит', 'Atopic dermatitis', 'XII'),
('L40', 'Псориаз', 'Psoriasis', 'XII'),
('L50', 'Крапивница', 'Urticaria', 'XII'),

-- Chapter XIII: Костно-мышечная
('M00-M99', 'Болезни костно-мышечной системы', 'Musculoskeletal diseases', 'XIII'),
('M15', 'Полиартроз', 'Polyarthrosis', 'XIII'),
('M17', 'Гонартроз', 'Gonarthrosis', 'XIII'),
('M42', 'Остеохондроз позвоночника', 'Spinal osteochondrosis', 'XIII'),
('M47', 'Спондилёз', 'Spondylosis', 'XIII'),
('M54', 'Дорсалгия', 'Dorsalgia', 'XIII'),
('M75', 'Поражения плеча', 'Shoulder lesions', 'XIII'),
('M79', 'Другие болезни мягких тканей', 'Soft tissue disorders', 'XIII'),

-- Chapter XIV: Мочеполовая
('N00-N99', 'Болезни мочеполовой системы', 'Genitourinary diseases', 'XIV'),
('N10', 'Острый пиелонефрит', 'Acute pyelonephritis', 'XIV'),
('N20', 'Мочекаменная болезнь', 'Urolithiasis', 'XIV'),
('N30', 'Цистит', 'Cystitis', 'XIV'),
('N39', 'Другие болезни мочевой системы', 'Urinary disorders', 'XIV'),
('N40', 'Гиперплазия предстательной железы', 'Prostatic hyperplasia', 'XIV'),
('N76', 'Вагинит', 'Vaginitis', 'XIV'),
('N80', 'Эндометриоз', 'Endometriosis', 'XIV'),

-- Chapter XV: Беременность
('O00-O99', 'Беременность, роды и послеродовой период', 'Pregnancy and childbirth', 'XV'),
('O80', 'Роды одноплодные, самопроизвольные', 'Single spontaneous delivery', 'XV'),

-- Chapter XVI: Перинатальные
('P00-P96', 'Отдельные состояния перинатального периода', 'Perinatal conditions', 'XVI'),

-- Chapter XVII: Врождённые
('Q00-Q99', 'Врождённые аномалии', 'Congenital malformations', 'XVII'),

-- Chapter XVIII: Симптомы
('R00-R99', 'Симптомы, признаки и отклонения', 'Symptoms and signs', 'XVIII'),
('R05', 'Кашель', 'Cough', 'XVIII'),
('R10', 'Боли в области живота', 'Abdominal pain', 'XVIII'),
('R50', 'Лихорадка неясного генеза', 'Fever of unknown origin', 'XVIII'),
('R51', 'Головная боль', 'Headache', 'XVIII'),

-- Chapter XIX: Травмы
('S00-T98', 'Травмы и отравления', 'Injuries and poisoning', 'XIX'),
('S52', 'Перелом костей предплечья', 'Forearm fracture', 'XIX'),
('S62', 'Перелом на уровне запястья и кисти', 'Wrist/hand fracture', 'XIX'),
('S82', 'Перелом голени', 'Lower leg fracture', 'XIX'),
('S93', 'Вывих и растяжение голеностопного сустава', 'Ankle sprain', 'XIX'),
('T78', 'Аллергическая реакция неуточнённая', 'Allergic reaction NOS', 'XIX'),

-- Chapter XX: Внешние причины
('V01-Y98', 'Внешние причины заболеваемости', 'External causes', 'XX'),

-- Chapter XXI: Факторы здоровья
('Z00-Z99', 'Факторы, влияющие на состояние здоровья', 'Health status factors', 'XXI'),
('Z00', 'Общий осмотр и обследование', 'General examination', 'XXI'),
('Z01', 'Другие специальные осмотры', 'Special examinations', 'XXI'),
('Z03', 'Медицинское наблюдение', 'Medical observation', 'XXI'),
('Z34', 'Наблюдение за нормальной беременностью', 'Normal pregnancy supervision', 'XXI'),
('Z76', 'Обращение в учреждение здравоохранения', 'Healthcare encounter', 'XXI')
ON CONFLICT (code) DO NOTHING;
