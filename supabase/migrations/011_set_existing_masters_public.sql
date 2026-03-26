-- Делаем публичными всех мастеров, которые завершили онбординг (есть booking_slug)
-- Нужно для мастеров, зарегистрированных до добавления is_public = true в OnboardingWizard

UPDATE public.master_profiles
SET is_public = true
WHERE booking_slug IS NOT NULL
  AND (is_public IS NULL OR is_public = false);
