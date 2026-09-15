import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SpecialtyIconComponent, SpecialtyIconName } from '../specialty-icon/specialty-icon.component';
import { SiteHeaderComponent } from '../site-header/site-header.component';

type HomeSpecialtyCard = {
  title: string;
  description: string;
  icon: SpecialtyIconName;
  slug: string;
  alternate: boolean;
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, SpecialtyIconComponent, SiteHeaderComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  readonly specialistServices: HomeSpecialtyCard[] = [
    {
      title: 'Ginekologija',
      description: 'Preventivni pregledi, ultrazvučna dijagnostika i praćenje zdravlja žena.',
      icon: 'ginecology',
      slug: 'ginekologija',
      alternate: false
    },
    {
      title: 'Pedijatrija',
      description: 'Preventivni i specijalistički pregledi dece i adolescenata.',
      icon: 'pediatry',
      slug: 'pedijatrija',
      alternate: true
    },
    {
      title: 'Oftalmologija',
      description: 'Pregledi vida, dijagnostika i praćenje oboljenja oka.',
      icon: 'oftalmology',
      slug: 'oftalmologija',
      alternate: false
    },
    {
      title: 'ORL',
      description: 'Dijagnostika i lečenje oboljenja uha, grla i nosa.',
      icon: 'otorinolaringology',
      slug: 'otorinolaringologija',
      alternate: true
    }
  ];

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
