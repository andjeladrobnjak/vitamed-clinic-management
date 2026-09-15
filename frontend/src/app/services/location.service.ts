import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ClinicLocation {
  id: number;
  name: string;
  address: string;
  city: string;
  phone: string;
  workingHours: string;
  latitude: number;
  longitude: number;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly http = inject(HttpClient);
  private readonly locationsUrl = 'http://localhost:3000/api/locations';

  getLocations(): Observable<ClinicLocation[]> {
    return this.http.get<ClinicLocation[]>(this.locationsUrl);
  }
}
