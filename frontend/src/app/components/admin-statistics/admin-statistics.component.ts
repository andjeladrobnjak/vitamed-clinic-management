import { Component, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AdminPortalService,
  AdminStatistics,
  AdminStatisticsPeriod,
  AdminStatisticsPopularDoctor,
  AdminStatisticsPopularService
} from '../../services/admin-portal.service';
import { AdminChartComponent, AdminChartPoint } from './admin-chart.component';
import { VitamedSelectComponent } from '../vitamed-select/vitamed-select.component';

@Component({
  selector: 'app-admin-statistics',
  standalone: true,
  imports: [AdminChartComponent, VitamedSelectComponent],
  templateUrl: './admin-statistics.component.html',
  styleUrls: ['./admin-statistics.component.css', './admin-statistics-charts.css']
})
export class AdminStatisticsComponent implements OnInit {
  readonly periods: { value: AdminStatisticsPeriod; label: string }[] = [
    { value: 'thisMonth', label: 'Ovaj mesec' },
    { value: 'thisYear', label: 'Ova godina' },
    { value: 'last12months', label: 'Poslednjih 12 meseci' }
  ];

  selectedPeriod: AdminStatisticsPeriod = 'last12months';
  stats: AdminStatistics | null = null;
  isLoading = true;
  isRefreshingCharts = false;
  loadError = '';
  completedChart: AdminChartPoint[] = [];
  specialtyChart: AdminChartPoint[] = [];
  locationChart: AdminChartPoint[] = [];
  cancellationChart: AdminChartPoint[] = [];

  private readonly portalService = inject(AdminPortalService);

  ngOnInit(): void {
    this.loadStatistics();
  }

  onPeriodChange(value: string | number | boolean | null): void {
    const next = String(value || '') as AdminStatisticsPeriod;
    if (this.periods.every((period) => period.value !== next) || next === this.selectedPeriod) {
      return;
    }
    this.selectedPeriod = next;
    this.loadStatistics();
  }

  retryLoad(): void {
    this.loadStatistics();
  }

  doctorLabel(doctor: AdminStatisticsPopularDoctor): string {
    return `dr ${doctor.firstName} ${doctor.lastName}`.trim();
  }

  serviceLabel(service: AdminStatisticsPopularService): string {
    return service.name;
  }

  countLabel(count: number): string {
    return count === 1 ? '1 pregled' : `${count} pregleda`;
  }

  get completedDescription(): string {
    return this.selectedPeriod === 'thisMonth'
      ? 'Broj obavljenih pregleda po danima.'
      : 'Broj obavljenih pregleda po mesecima.';
  }

  get cancellationDescription(): string {
    return this.selectedPeriod === 'thisMonth'
      ? 'Procenat otkazanih termina po danima.'
      : 'Procenat otkazanih termina po mesecima.';
  }

  locationHasDemand(stats: AdminStatistics): boolean {
    return stats.locationDemand.some((item) => item.count > 0);
  }

  private pointTitle(key: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      const [year, month, day] = key.split('-');
      return `${day}.${month}.${year}`;
    }
    if (/^\d{4}-\d{2}$/.test(key)) {
      const year = key.slice(0, 4);
      const month = Number(key.slice(5, 7));
      const names = [
        'Januar',
        'Februar',
        'Mart',
        'April',
        'Maj',
        'Jun',
        'Jul',
        'Avgust',
        'Septembar',
        'Oktobar',
        'Novembar',
        'Decembar'
      ];
      return `${names[month - 1]} ${year}`;
    }
    return key;
  }

  private loadStatistics(): void {
    if (this.stats) {
      this.isRefreshingCharts = true;
      this.loadError = '';
    } else {
      this.isLoading = true;
      this.loadError = '';
    }

    this.portalService.getStatistics(this.selectedPeriod).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.completedChart = stats.completedTrend.points.map((point) => ({
          label: point.label,
          value: point.count,
          tooltipTitle: this.pointTitle(point.key)
        }));
        this.specialtyChart = stats.specialtyDemand.map((item) => ({
          label: item.name,
          value: item.count
        }));
        this.locationChart = stats.locationDemand
          .filter((item) => item.count > 0)
          .map((item) => ({
            label: item.name,
            value: item.count,
            count: item.count,
            percent: item.percent
          }));
        this.cancellationChart = stats.cancellationTrend.points.map((point) => ({
          label: point.label,
          value: point.percent,
          cancelled: point.cancelled,
          total: point.total,
          tooltipTitle: this.pointTitle(point.key)
        }));
        this.isLoading = false;
        this.isRefreshingCharts = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.isRefreshingCharts = false;
        this.loadError = error.error?.message || 'Trenutno nije moguće učitati statistiku.';
      }
    });
  }
}
