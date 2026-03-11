import {
  Scissors, Sparkles, Dumbbell, BookOpen, Camera, Music, Palette,
  ChefHat, Heart, Stethoscope, Wrench, Briefcase, Flower2, Baby,
  Shirt, PawPrint, type LucideIcon,
} from 'lucide-react'

/**
 * Маппинг ключевых слов профессии → иконка Lucide.
 * Используется для динамической замены иконки ножниц по всему приложению.
 */
const PROFESSION_ICON_MAP: Array<{ keywords: string[]; icon: LucideIcon }> = [
  // Парикмахер / барбер
  { keywords: ['парикмахер', 'стриж', 'прич', 'барбер', 'hair', 'barber', 'coif', 'salon'], icon: Scissors },
  // Маникюр / педикюр / ногти
  { keywords: ['маникюр', 'педикюр', 'ногт', 'nail'], icon: Sparkles },
  // Косметолог / брови / ресницы / макияж
  { keywords: ['косметолог', 'эстетист', 'косметик', 'бров', 'ресниц', 'lash', 'brow', 'cosmet', 'make', 'макия', 'визаж', 'beauty'], icon: Flower2 },
  // Фитнес / тренер / спорт
  { keywords: ['тренер', 'фитнес', 'спорт', 'gym', 'fitness', 'trainer', 'coach', 'йога', 'yoga', 'пилат', 'crossfit', 'бокс', 'единоборств', 'танц', 'dance'], icon: Dumbbell },
  // Репетитор / учитель / образование
  { keywords: ['репетитор', 'учитель', 'преподаватель', 'tutor', 'teacher', 'образовани', 'обучени', 'education', 'mentor', 'коуч', 'психолог'], icon: BookOpen },
  // Фотограф / видеограф
  { keywords: ['фотограф', 'видеограф', 'photo', 'camera', 'videograph', 'фото', 'видео'], icon: Camera },
  // Музыкант / вокал
  { keywords: ['музык', 'вокал', 'vocal', 'пианист', 'гитар', 'music', 'singer', 'певец'], icon: Music },
  // Дизайнер / художник
  { keywords: ['дизайн', 'худож', 'artist', 'illust', 'граф', 'design', 'architect', 'архитект', 'декоратор'], icon: Palette },
  // Повар / кондитер
  { keywords: ['повар', 'cook', 'кулинар', 'chef', 'кондитер', 'confection', 'торт', 'bak', 'пекар'], icon: ChefHat },
  // Массаж / SPA / мануальная терапия
  { keywords: ['массаж', 'massage', 'spa', 'остеопат', 'мануаль', 'рефлексо', 'релакс'], icon: Heart },
  // Врач / медицина / стоматолог
  { keywords: ['врач', 'доктор', 'медик', 'doctor', 'medical', 'health', 'терапевт', 'стоматолог', 'dent', 'psycho', 'психиатр', 'нутрицио'], icon: Stethoscope },
  // Ремонт / строительство / мастер
  { keywords: ['ремонт', 'сантех', 'электр', 'строит', 'repair', 'handyman', 'плотник', 'сварщик', 'plumb', 'electr', 'build', 'монтаж', 'отделк'], icon: Wrench },
  // Портной / стилист / мода
  { keywords: ['портной', 'швея', 'мода', 'стилист', 'fashion', 'style', 'tailor', 'одежд'], icon: Shirt },
  // Дети / няня / педагог
  { keywords: ['няня', 'нянь', 'ребенок', 'дети', 'baby', 'child', 'nanny', 'детск'], icon: Baby },
  // Животные / ветеринар / груминг
  { keywords: ['ветерин', 'зоогрум', 'груминг', 'pet', 'dog', 'собак', 'кошк', 'животн', 'питомц'], icon: PawPrint },
]

/**
 * Возвращает Lucide-иконку по тексту профессии/специальности.
 * Если совпадений нет — возвращает универсальный Briefcase.
 */
export function getProfessionIcon(profession?: string): LucideIcon {
  if (!profession) return Briefcase
  const text = profession.toLowerCase()
  for (const { keywords, icon } of PROFESSION_ICON_MAP) {
    if (keywords.some(kw => text.includes(kw))) return icon
  }
  return Briefcase
}
