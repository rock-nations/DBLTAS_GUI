import { ChangeDetectorRef, Component } from '@angular/core';
import { TecWatchApiService } from '../../services/tecwatch-api.service';
import { UploadStateService } from '../../services/upload-state.service';
import { ApiError } from '../../models/trace-analysis';
import { AnalysisScenarios } from '../../models/analysis-scenarios';

export type UploadKind = 'capture' | 'report';

/** Same limit as analysis.max_upload_bytes of the backend. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const UPLOAD_EXTENSIONS: Record<UploadKind, string[]> = {
  capture: ['.pcapng', '.pcap', '.cap'],
  report: ['.pdf']
};

/**
 * Upload & Analyze: sends a capture (pcapng/pcap) and/or CANoe test report (PDF) to
 * POST /api/analysis/upload and shows the returned findings with the analysis view.
 */
@Component({
  selector: 'app-upload',
  standalone: false,
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent {
  readonly zones: { kind: UploadKind; icon: string; title: string; hint: string; accept: string }[] = [
    {
      kind: 'capture',
      icon: '📡',
      title: 'Capture',
      hint: '.pcapng or .pcap of the SCI-TDS interface',
      accept: UPLOAD_EXTENSIONS.capture.join(',')
    },
    {
      kind: 'report',
      icon: '📄',
      title: 'Test report',
      hint: 'CANoe test report exported as PDF',
      accept: UPLOAD_EXTENSIONS.report.join(',')
    }
  ];

  files: Record<UploadKind, File | null> = { capture: null, report: null };
  fileErrors: Record<UploadKind, string | null> = { capture: null, report: null };
  dragOver: UploadKind | null = null;
  uploading = false;
  error: ApiError | null = null;

  constructor(
    private apiService: TecWatchApiService,
    private uploadState: UploadStateService,
    private changeDetector: ChangeDetectorRef
  ) {}

  get result(): AnalysisScenarios | null {
    return this.uploadState.result;
  }

  get resultFiles(): string[] {
    return this.uploadState.fileNames;
  }

  get canAnalyze(): boolean {
    return !this.uploading && (!!this.files.capture || !!this.files.report);
  }

  onFileSelected(kind: UploadKind, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setFile(kind, input.files?.[0] ?? null);
    input.value = ''; // selecting the same file again fires a change event
  }

  onDragOver(kind: UploadKind, event: DragEvent): void {
    event.preventDefault();
    this.dragOver = kind;
  }

  onDragLeave(kind: UploadKind): void {
    if (this.dragOver === kind) {
      this.dragOver = null;
    }
  }

  onDrop(kind: UploadKind, event: DragEvent): void {
    event.preventDefault();
    this.dragOver = null;
    this.setFile(kind, event.dataTransfer?.files?.[0] ?? null);
  }

  setFile(kind: UploadKind, file: File | null): void {
    const problem = file ? this.validate(kind, file) : null;
    this.fileErrors[kind] = problem;
    this.files[kind] = file && !problem ? file : null;
  }

  removeFile(kind: UploadKind): void {
    this.files[kind] = null;
    this.fileErrors[kind] = null;
  }

  analyze(): void {
    if (!this.canAnalyze) {
      return;
    }
    const { capture, report } = this.files;
    const fileNames = [capture?.name, report?.name].filter((name): name is string => !!name);
    this.uploading = true;
    this.error = null;
    this.apiService.uploadForAnalysis(capture, report).subscribe({
      next: result => {
        this.uploadState.set(result, fileNames);
        this.uploading = false;
        this.changeDetector.markForCheck();
      },
      error: (err: ApiError) => {
        this.error = err;
        this.uploading = false;
        this.changeDetector.markForCheck();
      }
    });
  }

  /** Clears the selected files and the last result. */
  startOver(): void {
    this.removeFile('capture');
    this.removeFile('report');
    this.error = null;
    this.uploadState.clear();
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** Quick check before uploading; the backend checks the file content as well. */
  private validate(kind: UploadKind, file: File): string | null {
    const name = file.name.toLowerCase();
    if (!UPLOAD_EXTENSIONS[kind].some(extension => name.endsWith(extension))) {
      return kind === 'capture'
        ? `'${file.name}' is not a capture file (.pcapng or .pcap).`
        : `'${file.name}' is not a PDF test report.`;
    }
    if (file.size === 0) {
      return `'${file.name}' is empty.`;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return `'${file.name}' is ${this.formatSize(file.size)}; the limit is 50 MB.`;
    }
    return null;
  }
}
