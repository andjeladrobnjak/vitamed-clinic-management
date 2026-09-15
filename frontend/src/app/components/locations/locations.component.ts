import {
  AfterViewChecked,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  ViewChild,
  inject
} from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideClock, LucideLocate, LucideMapPin, LucidePhone } from '@lucide/angular';
import { take } from 'rxjs/operators';
import * as L from 'leaflet';
import { ClinicLocation, LocationService } from '../../services/location.service';
import { haversineKm } from '../../utils/haversine';
import { OpeningStatus, getOpeningStatus } from '../../utils/working-hours';
import { SiteHeaderComponent } from '../site-header/site-header.component';

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, SiteHeaderComponent],
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.css'
})
export class LocationsComponent implements AfterViewChecked, OnDestroy {
  readonly pinIcon = LucideMapPin.icon.node;
  readonly phoneIcon = LucidePhone.icon.node;
  readonly clockIcon = LucideClock.icon.node;
  readonly locateIcon = LucideLocate.icon.node;

  locations: ClinicLocation[] = [];
  displayedLocations: ClinicLocation[] = [];
  selectedId: number | null = null;
  nearestId: number | null = null;
  distancesKm: Record<number, number> = {};
  isLoading = true;
  loadError = '';
  geoMessage = '';
  geoLoading = false;

  private map?: L.Map;
  private readonly markers = new Map<number, L.Marker>();
  private userMarker?: L.Marker;
  private userPosition: { latitude: number; longitude: number } | null = null;
  private mapInitialized = false;
  private readonly locationService = inject(LocationService);
  private readonly ngZone = inject(NgZone);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly urlLocation = inject(Location);
  private readonly subscriptions = new Subscription();

  @ViewChild('mapContainer') private mapContainer?: ElementRef<HTMLElement>;

  constructor() {
    this.subscriptions.add(
      this.route.queryParamMap.subscribe((params) => {
        this.applyLocationQuery(params.get('location'));
      })
    );
    this.loadLocations();
  }

  ngAfterViewChecked(): void {
    if (this.mapInitialized || !this.mapContainer || this.locations.length === 0) {
      return;
    }

    this.initMap(this.mapContainer.nativeElement);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.map?.remove();
    this.map = undefined;
    this.markers.clear();
    this.userMarker = undefined;
    this.userPosition = null;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.map?.invalidateSize();
  }

  retryLoad(): void {
    this.map?.remove();
    this.map = undefined;
    this.markers.clear();
    this.userMarker = undefined;
    this.userPosition = null;
    this.mapInitialized = false;
    this.locations = [];
    this.displayedLocations = [];
    this.selectedId = null;
    this.nearestId = null;
    this.distancesKm = {};
    this.geoMessage = '';
    this.geoLoading = false;
    this.loadError = '';
    this.isLoading = true;
    this.loadLocations();
  }

  selectLocation(locationId: number, panToMarker = true, syncUrl = true): void {
    this.selectedId = locationId;
    if (syncUrl) {
      this.syncLocationQuery(locationId);
    }

    const marker = this.markers.get(locationId);
    const location = this.locations.find((item) => item.id === locationId);
    if (!marker || !location || !this.map) {
      return;
    }

    marker.openPopup();
    if (panToMarker) {
      const currentZoom = this.map.getZoom();
      const zoom = Number.isFinite(currentZoom) ? Math.max(currentZoom, 14) : 14;
      this.map.flyTo([location.latitude, location.longitude], zoom, {
        duration: 0.55
      });
    }
  }

  formatDistance(locationId: number): string | null {
    const distance = this.distancesKm[locationId];
    if (distance === undefined) {
      return null;
    }

    return `${new Intl.NumberFormat('sr-RS', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(distance)} km od vas`;
  }

  openingStatus(workingHours: string): OpeningStatus {
    return getOpeningStatus(workingHours);
  }

  findNearest(): void {
    if (this.geoLoading) {
      return;
    }

    this.geoMessage = '';
    if (!navigator.geolocation) {
      this.geoMessage =
        'Nismo uspeli da pristupimo vašoj lokaciji. Lokacije možete pregledati na mapi i izabrati ručno.';
      return;
    }

    this.geoLoading = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.ngZone.run(() => {
          this.geoLoading = false;
          this.applyUserPosition(position.coords.latitude, position.coords.longitude);
        });
      },
      () => {
        this.ngZone.run(() => {
          this.geoLoading = false;
          this.geoMessage =
            'Nismo uspeli da pristupimo vašoj lokaciji. Lokacije možete pregledati na mapi i izabrati ručno.';
        });
      },
      {
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  private loadLocations(): void {
    this.locationService.getLocations().subscribe({
      next: (locations) => {
        this.locations = locations;
        this.displayedLocations = [...locations];
        this.isLoading = false;
        this.applyLocationQuery(this.route.snapshot.queryParamMap.get('location'));
      },
      error: (error: HttpErrorResponse) => {
        console.error('Greška pri učitavanju lokacija:', error);
        this.isLoading = false;
        this.loadError = 'Lokacije trenutno nisu dostupne. Pokušajte ponovo kasnije.';
      }
    });
  }

  private applyLocationQuery(raw: string | null): void {
    if (this.locations.length === 0) {
      return;
    }

    const requestedId = Number(raw);
    const isValid =
      raw !== null &&
      raw !== '' &&
      Number.isInteger(requestedId) &&
      requestedId > 0 &&
      this.locations.some((location) => location.id === requestedId);

    if (isValid) {
      if (this.selectedId !== requestedId && this.mapInitialized) {
        this.selectLocation(requestedId, true, false);
        return;
      }

      this.selectedId = requestedId;
      return;
    }

    if (this.selectedId === null || !this.locations.some((location) => location.id === this.selectedId)) {
      this.selectedId = this.locations[0].id;
    }
  }

  private hasValidLocationQuery(): boolean {
    const requestedId = Number(this.route.snapshot.queryParamMap.get('location'));
    return (
      Number.isInteger(requestedId) &&
      requestedId > 0 &&
      this.selectedId === requestedId &&
      this.locations.some((location) => location.id === requestedId)
    );
  }

  private syncLocationQuery(locationId: number): void {
    const urlTree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: { location: locationId },
      queryParamsHandling: 'merge'
    });
    const serialized = this.router.serializeUrl(urlTree);
    const queryIndex = serialized.indexOf('?');
    const path = queryIndex === -1 ? serialized : serialized.slice(0, queryIndex);
    const query = queryIndex === -1 ? '' : serialized.slice(queryIndex + 1);

    if (this.router.url === serialized) {
      return;
    }

    this.urlLocation.replaceState(path, query);
  }

  private applyUserPosition(latitude: number, longitude: number): void {
    this.userPosition = { latitude, longitude };

    const distances: Record<number, number> = {};
    this.displayedLocations = [...this.locations]
      .map((location) => {
        distances[location.id] = haversineKm(
          latitude,
          longitude,
          location.latitude,
          location.longitude
        );
        return location;
      })
      .sort((a, b) => distances[a.id] - distances[b.id]);

    this.distancesKm = distances;
    this.nearestId = this.displayedLocations[0]?.id ?? null;
    this.selectedId = this.nearestId;
    this.addUserMarker(latitude, longitude);

    if (this.map) {
      this.map.invalidateSize();
      this.fitAllBounds(latitude, longitude);
      this.userMarker?.openPopup();
    }
  }

  private initMap(container: HTMLElement): void {
    this.mapInitialized = true;
    const clinicIcon = L.divIcon({
      className: 'vitamed-marker',
      html: '<span class="vitamed-marker-pin"></span>',
      iconSize: [22, 22],
      iconAnchor: [11, 22],
      popupAnchor: [0, -18]
    });

    this.map = L.map(container, {
      scrollWheelZoom: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.map);

    for (const location of this.locations) {
      const marker = L.marker([location.latitude, location.longitude], {
        icon: clinicIcon
      }).bindPopup(() => this.locationPopupHtml(location));

      marker.on('click', () => {
        this.ngZone.run(() => this.selectLocation(location.id, false));
      });

      marker.addTo(this.map);
      this.markers.set(location.id, marker);
    }

    this.ngZone.onStable.pipe(take(1)).subscribe(() => {
      requestAnimationFrame(() => this.applyMapViewport());
    });
  }

  private applyMapViewport(): void {
    if (!this.map) {
      return;
    }

    this.map.invalidateSize();
    this.fitClinicBounds();

    if (this.hasValidLocationQuery() && this.selectedId !== null) {
      this.selectLocation(this.selectedId, true, false);
      return;
    }

    if (this.selectedId !== null) {
      this.markers.get(this.selectedId)?.openPopup();
    }
  }

  private fitClinicBounds(): void {
    if (!this.map || this.markers.size === 0) {
      return;
    }

    const bounds = L.latLngBounds(
      [...this.markers.values()].map((marker) => marker.getLatLng())
    );

    this.map.fitBounds(bounds, {
      padding: [36, 36],
      maxZoom: 13
    });
  }

  private addUserMarker(latitude: number, longitude: number): void {
    if (!this.map) {
      return;
    }

    this.userMarker?.remove();
    const userIcon = L.divIcon({
      className: 'user-marker',
      html: '<span class="user-marker-dot"></span>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -10]
    });

    this.userMarker = L.marker([latitude, longitude], { icon: userIcon })
      .bindPopup('Vaša lokacija')
      .addTo(this.map);
  }

  private locationPopupHtml(location: ClinicLocation): string {
    const status = getOpeningStatus(location.workingHours);
    return [
      `<strong>${location.name}</strong>`,
      `<span class="popup-hours-status is-${status.state}">${status.label}</span>`,
      `${location.address}, ${location.city}`,
      location.phone
    ].join('<br>');
  }

  private fitAllBounds(userLatitude: number, userLongitude: number): void {
    if (!this.map) {
      return;
    }

    const bounds = L.latLngBounds([[userLatitude, userLongitude]]);
    for (const location of this.locations) {
      bounds.extend([location.latitude, location.longitude]);
    }

    this.map.fitBounds(bounds, {
      padding: [36, 36],
      maxZoom: 13
    });
  }
}
