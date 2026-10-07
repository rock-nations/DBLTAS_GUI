import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { ApiError, TecWatchStatus, TraceAnalysis } from '../models/trace-analysis';

@Injectable({
  providedIn: 'root'
})
export class TecWatchApiService {
  readonly baseUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  getStatus(deviceId?: string): Observable<TecWatchStatus> {
    let params = new HttpParams();
    if (deviceId) {
      params = params.set('device_id', deviceId);
    }
    return this.http
      .get<TecWatchStatus>(`${this.baseUrl}/status`, { params })
      .pipe(catchError(err => this.toApiError(err)));
  }

  /** The backend reads the analysis report file, validates it and returns it unchanged. */
  getAnalysis(): Observable<TraceAnalysis> {
    return this.http
      .get<TraceAnalysis>(`${this.baseUrl}/analysis`)
      .pipe(catchError(err => this.toApiError(err)));
  }

  private toApiError(err: HttpErrorResponse): Observable<never> {
    const body = err.error;
    const apiError: ApiError =
      err.status === 0
        ? {
            status: 0,
            error: 'Backend Unreachable',
            detail: `No response from the tecWatch API at ${this.baseUrl}.`,
            validation_errors: []
          }
        : {
            status: err.status,
            error: body?.error ?? `HTTP ${err.status}`,
            detail: typeof body?.detail === 'string' ? body.detail : err.message,
            validation_errors: Array.isArray(body?.validation_errors) ? body.validation_errors : []
          };
    console.warn(`tecWatch API request failed (${err.url ?? this.baseUrl}):`, apiError);
    return throwError(() => apiError);
  }
}
