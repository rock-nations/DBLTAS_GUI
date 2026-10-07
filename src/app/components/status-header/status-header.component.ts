import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { TecWatchApiService } from '../../services/tecwatch-api.service';
import { ApiError, TecWatchStatus, TrackSectionStatus } from '../../models/trace-analysis';

/** German Belegungszustand terms used by DB operators, with the English meaning. */
const OCCUPANCY_LABELS: Record<TrackSectionStatus['occupancy'], string> = {
  FREE: 'frei (free)',
  OCCUPIED: 'belegt (occupied)',
  DISTURBED: 'gestört (disturbed)'
};

@Component({
  selector: 'app-status-header',
  standalone: false,
  templateUrl: './status-header.component.html',
  styleUrls: ['./status-header.component.css']
})
export class StatusHeaderComponent implements OnInit {
  status: TecWatchStatus | null = null;
  statusError: ApiError | null = null;

  constructor(
    private apiService: TecWatchApiService,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Initial load: tecWatch status of the monitored SCI-TDS interface (proxied by the backend)
    this.loadStatus();
  }

  // The app is zoneless, so HTTP callbacks mark the view for check themselves
  loadStatus(): void {
    this.apiService.getStatus().subscribe({
      next: status => {
        this.status = status;
        this.statusError = null;
        this.changeDetector.markForCheck();
      },
      error: (err: ApiError) => {
        this.status = null;
        this.statusError = err;
        this.changeDetector.markForCheck();
      }
    });
  }

  overallBadge(status: TecWatchStatus['status']): string {
    switch (status) {
      case 'OPERATIONAL':
        return 'badge-passed';
      case 'DEGRADED':
        return 'badge-warning';
      case 'DISCONNECTED':
        return 'badge-serious';
      case 'FAULT':
        return 'badge-failed';
      default:
        return 'badge-neutral';
    }
  }

  linkDot(state: TecWatchStatus['link']['state']): string {
    return state === 'CONNECTED' ? 'active' : state === 'CONNECTING' ? 'warning' : 'error';
  }

  occupancyDot(occupancy: TrackSectionStatus['occupancy']): string {
    return occupancy === 'FREE' ? 'active' : occupancy === 'OCCUPIED' ? 'warning' : 'error';
  }

  occupancyLabel(occupancy: TrackSectionStatus['occupancy']): string {
    return OCCUPANCY_LABELS[occupancy] ?? occupancy;
  }
}
