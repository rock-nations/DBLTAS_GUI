import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private activeRequests = 0;
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private currentEndpointSubject = new BehaviorSubject<string | null>(null);

  isLoading$ = this.isLoadingSubject.asObservable();
  currentEndpoint$ = this.currentEndpointSubject.asObservable();

  show(endpoint?: string): void {
    this.activeRequests++;
    if (endpoint) {
      this.currentEndpointSubject.next(endpoint);
    }
    this.isLoadingSubject.next(true);
  }

  hide(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    if (this.activeRequests === 0) {
      this.isLoadingSubject.next(false);
      this.currentEndpointSubject.next(null);
    }
  }
}
