import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { TecWatchStatus, TraceAnalysis } from '../models/trace-analysis';

@Injectable({
  providedIn: 'root'
})
export class TecWatchApiService {
  private baseUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  getStatus(deviceId?: string): Observable<TecWatchStatus> {
    let params = new HttpParams();
    if (deviceId) {
      params = params.set('device_id', deviceId);
    }
    return this.http.get<TecWatchStatus>(`${this.baseUrl}/status`, { params }).pipe(
      catchError(err => {
        console.warn('API /api/status offline or error, using fallback status:', err);
        return of({
          device_id: deviceId || 'TW-MOCK-STANDALONE',
          status: 'STANDBY',
          battery_level: 89.0,
          uptime_seconds: 42000,
          temperature: 26.5,
          timestamp: new Date().toISOString(),
          active_alerts: ['Running in Local Standalone Mode']
        });
      })
    );
  }

  getAnalyses(filters?: {
    result_status?: string;
    device_id?: string;
    protocol?: string;
    search?: string;
  }): Observable<TraceAnalysis[]> {
    let params = new HttpParams();
    if (filters?.result_status && filters.result_status !== 'ALL') {
      params = params.set('result_status', filters.result_status);
    }
    if (filters?.device_id) {
      params = params.set('device_id', filters.device_id);
    }
    if (filters?.protocol && filters.protocol !== 'ALL') {
      params = params.set('protocol', filters.protocol);
    }
    if (filters?.search) {
      params = params.set('search', filters.search);
    }

    return this.http.get<TraceAnalysis[]>(`${this.baseUrl}/analysis`, { params }).pipe(
      catchError(err => {
        console.warn('API /api/analysis offline, returning fallback trace dataset:', err);
        return of([this.getFallbackTrace()]);
      })
    );
  }

  getAnalysisDetail(analysisId: string): Observable<TraceAnalysis> {
    return this.http.get<TraceAnalysis>(`${this.baseUrl}/analysis/${analysisId}`).pipe(
      catchError(err => {
        console.warn(`API /api/analysis/${analysisId} error, using fallback:`, err);
        return of(this.getFallbackTrace());
      })
    );
  }

  submitAnalysis(payload: TraceAnalysis): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/analysis`, payload);
  }

  resetAnalyses(): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/analysis/reset`, {});
  }

  private getFallbackTrace(): TraceAnalysis {
    return {
      analysis_id: 'TRACE-RUN-1001',
      device_id: 'TW-NODE-01',
      timestamp: new Date().toISOString(),
      analysis_type: 'TRACE_COMMUNICATION',
      result_status: 'FAILED',
      summary: 'Message length error detected on CAN bus packet ID 127.',
      trace_messages: [
        {
          timestamp: new Date().toISOString(),
          sender: 'ECU_ENGINE',
          receiver: 'TECWATCH_RECORDER',
          protocol: 'CAN',
          message_type: 'TELEMETRY',
          status: 'FAILED',
          error_reason: 'Message Length Error'
        },
        {
          timestamp: new Date(Date.now() - 5000).toISOString(),
          sender: 'SENSOR_BRAKE',
          receiver: 'TECWATCH_RECORDER',
          protocol: 'CAN',
          message_type: 'HEARTBEAT',
          status: 'OK',
          error_reason: null
        }
      ],
      failure_findings: [
        {
          message_id: '127',
          expected_length: 64,
          actual_length: 60,
          result: 'Message Length Error'
        }
      ],
      data_comparisons: [
        { field: 'MessageID', expected: '1001', actual: '1001', result: 'OK' },
        { field: 'Length', expected: '64', actual: '60', result: 'Error' },
        { field: 'Status', expected: 'READY', actual: 'READY', result: 'OK' }
      ]
    };
  }
}
