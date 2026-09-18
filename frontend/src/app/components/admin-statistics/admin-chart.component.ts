import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type ChartType
} from 'chart.js';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
);

export interface AdminChartPoint {
  label: string;
  value: number;
  count?: number;
  cancelled?: number;
  total?: number;
  percent?: number;
  tooltipTitle?: string;
}

export type AdminChartKind = 'completed' | 'cancellation' | 'specialty' | 'location';

const PETROL = '#17343a';
const BURGUNDY = '#7a3f46';
const MUTED = '#5c6564';
const LOCATION_COLORS = ['#17343a', '#3d5c61', '#7a3f46'];
const FONT = { family: '"Source Sans 3", "Segoe UI", sans-serif', size: 11 };

@Component({
  selector: 'app-admin-chart',
  standalone: true,
  template: '<canvas #canvas aria-hidden="true"></canvas>',
  styles: [
    `
      :host {
        display: block;
        position: relative;
        width: 100%;
        height: 100%;
      }
      canvas {
        display: block;
      }
    `
  ]
})
export class AdminChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) type!: Extract<ChartType, 'line' | 'bar' | 'doughnut'>;
  @Input({ required: true }) kind!: AdminChartKind;
  @Input() points: AdminChartPoint[] = [];

  @ViewChild('canvas', { static: true }) private canvas?: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) {
      return;
    }
    if (changes['points'] || changes['type'] || changes['kind']) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  private render(): void {
    const canvas = this.canvas?.nativeElement;
    if (!canvas || this.points.length === 0) {
      this.destroyChart();
      return;
    }

    this.destroyChart();
    Chart.getChart(canvas)?.destroy();
    this.chart = new Chart(canvas, this.config());
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private config(): ChartConfiguration {
    if (this.type === 'doughnut') {
      return this.doughnutConfig();
    }
    if (this.type === 'bar') {
      return this.barConfig();
    }
    return this.lineConfig();
  }

  private doughnutConfig(): ChartConfiguration {
    return {
      type: 'doughnut',
      data: {
        labels: this.points.map((point) => point.label),
        datasets: [
          {
            data: this.points.map((point) => point.value),
            backgroundColor: LOCATION_COLORS.slice(0, this.points.length),
            borderColor: '#f5f3ee',
            borderWidth: 2,
            hoverOffset: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        radius: '68%',
        cutout: '64%',
        layout: {
          padding: { top: 4, bottom: 4, left: 12, right: 12 }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              color: PETROL,
              font: FONT,
              padding: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            callbacks: {
              title: (items) => this.points[items[0]?.dataIndex ?? 0]?.label ?? '',
              label: (item) => {
                const point = this.points[item.dataIndex];
                return ` ${this.countLabel(point.count ?? point.value)}`;
              },
              afterLabel: (item) => this.percentLabel(this.points[item.dataIndex].percent ?? 0)
            }
          }
        }
      }
    } as ChartConfiguration;
  }

  private barConfig(): ChartConfiguration {
    return {
      type: 'bar',
      data: {
        labels: this.points.map((point) => point.label),
        datasets: [
          {
            data: this.points.map((point) => point.value),
            backgroundColor: PETROL,
            borderWidth: 0,
            borderRadius: 2,
            maxBarThickness: 16,
            categoryPercentage: 0.62,
            barPercentage: 0.72
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        indexAxis: 'y',
        layout: {
          padding: { top: 4, right: 8, bottom: 0, left: 0 }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => this.points[items[0]?.dataIndex ?? 0]?.label ?? '',
              label: (item) => ` ${this.countLabel(this.points[item.dataIndex].value)}`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ...this.countScaleRange(),
            ticks: {
              color: MUTED,
              font: FONT,
              ...this.integerTicks()
            },
            afterBuildTicks: (scale) => {
              scale.ticks = scale.ticks.filter((tick) => Number.isInteger(tick.value));
            },
            grid: { color: 'rgba(217, 214, 207, 0.7)' },
            border: { display: false }
          },
          y: {
            ticks: {
              color: PETROL,
              font: FONT,
              autoSkip: false,
              crossAlign: 'far'
            },
            grid: { display: false },
            border: { display: false }
          }
        }
      }
    };
  }

  private lineConfig(): ChartConfiguration {
    const isRate = this.kind === 'cancellation';
    return {
      type: 'line',
      data: {
        labels: this.points.map((point) => point.label),
        datasets: [
          {
            data: this.points.map((point) => point.value),
            borderColor: isRate ? BURGUNDY : PETROL,
            backgroundColor: isRate ? 'rgba(122, 63, 70, 0.05)' : 'rgba(23, 52, 58, 0.05)',
            fill: true,
            tension: 0.2,
            pointRadius: 2.2,
            pointHoverRadius: 3.5,
            pointBackgroundColor: isRate ? BURGUNDY : PETROL,
            pointBorderWidth: 0,
            borderWidth: 1.7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        layout: {
          padding: { top: 8, right: 8, bottom: 2, left: 2 }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const point = this.points[items[0]?.dataIndex ?? 0];
                return point?.tooltipTitle || point?.label || '';
              },
              label: (item) => {
                const point = this.points[item.dataIndex];
                if (isRate) {
                  return ` ${this.percentLabel(point.value)}`;
                }
                return ` ${this.countLabel(point.value)}`;
              },
              afterLabel: (item) => {
                if (!isRate) {
                  return '';
                }
                const point = this.points[item.dataIndex];
                if (!point.total) {
                  return 'nema termina';
                }
                return this.cancelledContext(point.cancelled ?? 0, point.total);
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: MUTED,
              font: FONT,
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              autoSkipPadding: 10,
              maxTicksLimit: 8
            },
            grid: { display: false },
            border: { color: 'rgba(217, 214, 207, 0.9)' }
          },
          y: isRate
            ? {
                min: 0,
                max: 100,
                ticks: {
                  color: MUTED,
                  font: FONT,
                  stepSize: 20,
                  callback: (value) => `${value}%`
                },
                grid: { color: 'rgba(217, 214, 207, 0.7)' },
                border: { display: false }
              }
            : {
                beginAtZero: true,
                ...this.countScaleRange(),
                ticks: {
                  color: MUTED,
                  font: FONT,
                  ...this.integerTicks()
                },
                afterBuildTicks: (scale) => {
                  scale.ticks = scale.ticks.filter((tick) => Number.isInteger(tick.value));
                },
                grid: { color: 'rgba(217, 214, 207, 0.7)' },
                border: { display: false }
              }
        }
      }
    };
  }

  private countScaleRange(): { suggestedMax: number } {
    const max = Math.max(0, ...this.points.map((point) => point.value));
    return { suggestedMax: Math.max(1, max) };
  }

  private integerTicks(): {
    stepSize: number;
    precision: number;
    callback: (value: string | number) => string | null;
  } {
    return {
      stepSize: 1,
      precision: 0,
      callback: (value) => {
        const numeric = Number(value);
        return Number.isInteger(numeric) ? String(numeric) : null;
      }
    };
  }

  private countLabel(count: number): string {
    return count === 1 ? '1 pregled' : `${count} pregleda`;
  }

  private percentLabel(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return `${new Intl.NumberFormat('sr-Latn-RS', {
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
      maximumFractionDigits: 1
    }).format(rounded)}%`;
  }

  private cancelledContext(cancelled: number, total: number): string {
    const cancelledLabel = cancelled === 1 ? '1 otkazan' : `${cancelled} otkazanih`;
    const totalLabel = total === 1 ? '1 termina' : `${total} termina`;
    return `${cancelledLabel} od ${totalLabel}`;
  }
}
