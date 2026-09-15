import { Component, input } from '@angular/core';
import { LucideStar } from '@lucide/angular';

@Component({
  selector: 'app-doctor-rating',
  standalone: true,
  templateUrl: './doctor-rating.component.html',
  styleUrl: './doctor-rating.component.css'
})
export class DoctorRatingComponent {
  readonly starIcon = LucideStar.icon.node;
  readonly averageRating = input<number | null>(null);
  readonly reviewCount = input(0);

  get hasRating(): boolean {
    return this.reviewCount() > 0 && this.averageRating() !== null;
  }

  get ratingLabel(): string {
    const average = this.averageRating();
    if (average === null) {
      return '';
    }
    return `${average.toFixed(1)}/5`;
  }
}
