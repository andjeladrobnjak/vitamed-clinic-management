import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { LucideBaby, LucideEar, LucideEye, LucideVenus } from '@lucide/angular';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  readonly venusIcon = LucideVenus.icon.node;
  readonly babyIcon = LucideBaby.icon.node;
  readonly eyeIcon = LucideEye.icon.node;
  readonly earIcon = LucideEar.icon.node;
  @ViewChild('diagnosticsCollage') diagnosticsCollage?: ElementRef<HTMLElement>;
  @ViewChild('servicesCta') servicesCta?: ElementRef<HTMLElement>;

  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    const targets = [this.diagnosticsCollage?.nativeElement, this.servicesCta?.nativeElement]
      .filter((element): element is HTMLElement => Boolean(element));

    if (!targets.length) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        entry.target.classList.add('is-visible');
        this.observer?.unobserve(entry.target);
      }
    }, {
      threshold: 0.2
    });

    targets.forEach((element) => this.observer?.observe(element));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
