import { Component, input } from '@angular/core';
import { LucideStar } from '@lucide/angular';
import { formatReviewCountLabel } from '../../utils/format-review-count';

@Component({
  selector: 'app-doctor-rating',
  standalone: true,
  templateUrl: './doctor-rating.component.html',
  styleUrl: './doctor-rating.component.css',
  host: {
    '[class.compact]': 'compact()'
  }
})
export class DoctorRatingComponent {
  readonly starIcon = LucideStar.icon.node;
  readonly averageRating = input<number | null>(null);
  readonly reviewCount = input(0);
  readonly showCount = input(false);
  readonly integerRating = input(false);
  readonly compact = input(false);

  get hasRating(): boolean {
    return this.reviewCount() > 0 && this.averageRating() !== null;
  }

  get ratingLabel(): string {
    const average = this.averageRating();
    if (average === null) {
      return '';
    }
    if (this.integerRating()) {
      return `${Math.round(average)}/5`;
    }
    return `${average.toFixed(1)}/5`;
  }

  get countLabel(): string {
    return formatReviewCountLabel(this.reviewCount());
  }

  get accessibleLabel(): string {
    if (!this.hasRating) {
      return 'Još nema ocena';
    }
    if (this.showCount()) {
      return `${this.ratingLabel} · ${this.countLabel}`;
    }
    return this.ratingLabel;
  }
}
