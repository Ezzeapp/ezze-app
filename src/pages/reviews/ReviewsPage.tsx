import { useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { Star, Trash2, Eye, EyeOff } from 'lucide-react'
import { useFeature } from '@/hooks/useFeatureFlags'
import dayjs from 'dayjs'
import { useReviews, useToggleReviewVisibility, useDeleteReview } from '@/hooks/useReviews'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  )
}

export function ReviewsPage() {
  const hasReviews = useFeature('reviews')
  const { data: reviews, isLoading } = useReviews()

  if (!hasReviews) return <Navigate to="/billing" replace />
  const toggleVisibility = useToggleReviewVisibility()
  const deleteReview = useDeleteReview()

  const stats = useMemo(() => {
    if (!reviews || reviews.length === 0) return null
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    const visible = reviews.filter(r => r.is_visible).length
    const hidden = reviews.length - visible
    const dist = [5, 4, 3, 2, 1].map(star => ({
      star,
      count: reviews.filter(r => r.rating === star).length,
    }))
    return { avg: avg.toFixed(1), visible, hidden, dist, total: reviews.length }
  }, [reviews])

  return (
    <div className="space-y-6">
      <PageHeader title="Отзывы" description="Отзывы клиентов о вашей работе">
        {stats && (
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span>{stats.avg}</span>
            <span className="text-muted-foreground">({stats.total})</span>
          </div>
        )}
      </PageHeader>

      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-muted/40 rounded-xl p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">Средний рейтинг</p>
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400 shrink-0" />
              <span className="text-2xl font-bold">{stats.avg}</span>
            </div>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">Всего отзывов</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">Опубликовано</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.visible}</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">Скрыто</p>
            <p className="text-2xl font-bold text-muted-foreground">{stats.hidden}</p>
          </div>
          {/* Распределение по звёздам */}
          <div className="col-span-2 sm:col-span-4 bg-muted/40 rounded-xl p-3 space-y-1.5">
            <p className="text-xs text-muted-foreground mb-2">Распределение оценок</p>
            {stats.dist.map(({ star, count }) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-3 shrink-0">{star}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: stats.total > 0 ? `${(count / stats.total) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Загрузка...</p>
      ) : !reviews || reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Star className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Нет отзывов</p>
            <p className="text-sm text-muted-foreground">
              Отзывы появятся здесь после того, как клиенты оставят их через форму бронирования
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id} className={!review.is_visible ? 'opacity-60' : ''}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-sm">
                        {review.client_name ? review.client_name.charAt(0).toUpperCase() : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{review.client_name || 'Клиент'}</p>
                      {review.created && <p className="text-xs text-muted-foreground">{dayjs(review.created).format('D MMM YYYY')}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!review.is_visible && <Badge variant="outline" className="text-xs">Скрыт</Badge>}
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => toggleVisibility.mutateAsync({ id: review.id, is_visible: !review.is_visible })}
                      title={review.is_visible ? 'Скрыть отзыв' : 'Показать отзыв'}
                    >
                      {review.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => deleteReview.mutateAsync(review.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <StarRating rating={review.rating} />

                {review.comment && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
