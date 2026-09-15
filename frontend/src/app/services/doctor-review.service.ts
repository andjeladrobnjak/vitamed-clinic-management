import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DoctorReview {
  id: number;
  appointmentId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class DoctorReviewApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api/doctor-reviews';

  createReview(payload: {
    appointmentId: number;
    rating: number;
    comment?: string | null;
  }): Observable<DoctorReview> {
    return this.http.post<DoctorReview>(this.baseUrl, payload);
  }

  updateReview(
    id: number,
    payload: { rating: number; comment: string | null }
  ): Observable<DoctorReview> {
    return this.http.patch<DoctorReview>(`${this.baseUrl}/${id}`, payload);
  }
}
