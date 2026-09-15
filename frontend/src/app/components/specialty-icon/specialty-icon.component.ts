import { Component, Input } from '@angular/core';

export type SpecialtyIconName =
  | 'cardiology'
  | 'pulmonology'
  | 'endocrinology'
  | 'ginecology'
  | 'pediatry'
  | 'oftalmology'
  | 'otorinolaringology'
  | 'hirurgy';

@Component({
  selector: 'app-specialty-icon',
  standalone: true,
  template: `
    <img
      class="specialty-icon-image"
      [src]="'/icons/specialties/' + name + '.png'"
      [style.width]="size"
      [style.height]="size"
      alt=""
    >
  `,
  styles: [`
    :host {
      display: block;
      line-height: 0;
    }

    .specialty-icon-image {
      display: block;
      width: 3.25rem;
      height: 3.25rem;
      object-fit: contain;
    }
  `]
})
export class SpecialtyIconComponent {
  @Input({ required: true }) name!: SpecialtyIconName;
  @Input() size = '3.25rem';
}
