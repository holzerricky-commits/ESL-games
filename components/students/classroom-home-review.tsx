import type { ClassroomHomeReview } from '@/lib/students/classroom-home-review'

export function ClassroomHomeReviewCard({ review }: { review: ClassroomHomeReview }) {
  const classBits = [review.durationLabel, review.contextLine].filter(Boolean)
  const practicedText = review.practiced.map((line) => line.text).join(' · ')

  return (
    <section className="book-launch-review" aria-label="Today's class">
      {classBits.length > 0 ? (
        <p className="book-launch-review__row">
          <span>Today</span>
          {classBits.join(' · ')}
        </p>
      ) : null}
      {practicedText ? (
        <p className="book-launch-review__row">
          <span>You practiced</span>
          {practicedText}
        </p>
      ) : null}
      {review.learnedWords.length > 0 ? (
        <p className="book-launch-review__row">
          <span>You learned</span>
          {review.learnedWords.join(', ')}
        </p>
      ) : null}
      {review.answersLabel ? (
        <p className="book-launch-review__row">
          <span>Your answers</span>
          {review.answersLabel}
        </p>
      ) : null}
      {review.reviewWords.length > 0 ? (
        <p className="book-launch-review__row">
          <span>Review</span>
          {review.reviewWords.join(', ')}
        </p>
      ) : null}
    </section>
  )
}
