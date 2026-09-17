import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-admin-section',
  standalone: true,
  templateUrl: './admin-section.component.html',
  styleUrl: './admin-section.component.css'
})
export class AdminSectionComponent {
  private readonly route = inject(ActivatedRoute);

  readonly heading = toSignal(
    this.route.data.pipe(map((data) => String(data['heading'] ?? ''))),
    { initialValue: '' }
  );
  readonly lead = toSignal(
    this.route.data.pipe(map((data) => String(data['lead'] ?? ''))),
    { initialValue: '' }
  );
}
