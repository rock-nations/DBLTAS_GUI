import { Component, OnInit } from '@angular/core';
import { TecWatchApiService } from '../../services/tecwatch-api.service';
import { TecWatchStatus, TraceAnalysis } from '../../models/trace-analysis';

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  tecWatchStatus: TecWatchStatus | null = null;
  analyses: TraceAnalysis[] = [];
  selectedAnalysis: TraceAnalysis | null = null;
  activeTab: 'trace' | 'failures' | 'comparison' = 'trace';

  // Filters
  searchTerm: string = '';
  selectedStatus: string = 'ALL';
  selectedProtocol: string = 'ALL';
  sortField: 'timestamp' | 'analysis_id' | 'result_status' = 'timestamp';
  sortAsc: boolean = false;

  // New Trace Modal / Demo State
  isSubmitting: boolean = false;
  submitNotification: string | null = null;

  constructor(private apiService: TecWatchApiService) {}

  ngOnInit(): void {
    this.loadStatus();
    this.loadAnalyses();
  }

  loadStatus(): void {
    this.apiService.getStatus().subscribe(status => {
      this.tecWatchStatus = status;
    });
  }

  loadAnalyses(targetIdToSelect?: string): void {
    this.apiService.getAnalyses({
      result_status: this.selectedStatus,
      protocol: this.selectedProtocol,
      search: this.searchTerm
    }).subscribe(data => {
      this.analyses = data;
      if (targetIdToSelect) {
        const found = data.find(a => a.analysis_id === targetIdToSelect);
        if (found) {
          this.selectedAnalysis = found;
          return;
        }
      }
      if (!this.selectedAnalysis && data.length > 0) {
        this.selectAnalysis(data[0]);
      } else if (this.selectedAnalysis) {
        const found = data.find(a => a.analysis_id === this.selectedAnalysis?.analysis_id);
        if (found) {
          this.selectedAnalysis = found;
        } else if (data.length > 0) {
          this.selectAnalysis(data[0]);
        }
      }
    });
  }

  selectAnalysis(analysis: TraceAnalysis): void {
    this.selectedAnalysis = analysis;
  }

  onFilterChange(): void {
    this.loadAnalyses();
  }

  setSort(field: 'timestamp' | 'analysis_id' | 'result_status'): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }
  }

  get sortedAnalyses(): TraceAnalysis[] {
    return [...this.analyses].sort((a, b) => {
      let valA = a[this.sortField];
      let valB = b[this.sortField];
      let res = 0;
      if (valA < valB) res = -1;
      if (valA > valB) res = 1;
      return this.sortAsc ? res : -res;
    });
  }

  // Quick Scenario / Demo injection
  injectScenario(scenario: 'can_error' | 'ethernet_ok' | 'modbus_error'): void {
    this.isSubmitting = true;

    // Reset filters to ALL so the injected scenario is immediately visible
    this.selectedStatus = 'ALL';
    this.selectedProtocol = 'ALL';
    this.searchTerm = '';

    let newTrace: TraceAnalysis;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);

    if (scenario === 'can_error') {
      newTrace = {
        analysis_id: `TRACE-CAN-${randomSuffix}`,
        device_id: 'TW-CAN-BUS-01',
        timestamp: new Date().toISOString(),
        analysis_type: 'TRACE_COMMUNICATION',
        result_status: 'FAILED',
        summary: 'Length truncation detected on CAN payload frame 127.',
        trace_messages: [
          {
            timestamp: new Date().toISOString(),
            sender: 'ECU_ENGINE',
            receiver: 'TECWATCH_RECORDER',
            protocol: 'CAN',
            message_type: 'FRAME_DIAG',
            status: 'FAILED',
            error_reason: 'Message Length Error'
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
    } else if (scenario === 'ethernet_ok') {
      newTrace = {
        analysis_id: `TRACE-ETH-${randomSuffix}`,
        device_id: 'TW-ETH-GATEWAY',
        timestamp: new Date().toISOString(),
        analysis_type: 'TRACE_COMMUNICATION',
        result_status: 'PASSED',
        summary: 'All TCP sockets and frame lengths verified nominal.',
        trace_messages: [
          {
            timestamp: new Date().toISOString(),
            sender: 'CLIENT_DBLTAS',
            receiver: 'TECWATCH_GATEWAY',
            protocol: 'TCP',
            message_type: 'TELEMETRY_SYNC',
            status: 'OK',
            error_reason: null
          }
        ],
        failure_findings: [],
        data_comparisons: [
          { field: 'HeaderLen', expected: '20', actual: '20', result: 'OK' },
          { field: 'PayloadSize', expected: '512', actual: '512', result: 'OK' },
          { field: 'Checksum', expected: 'VALID', actual: 'VALID', result: 'OK' }
        ]
      };
    } else {
      newTrace = {
        analysis_id: `TRACE-MOD-${randomSuffix}`,
        device_id: 'TW-MODBUS-PLC',
        timestamp: new Date().toISOString(),
        analysis_type: 'TRACE_COMMUNICATION',
        result_status: 'FAILED',
        summary: 'Modbus register count mismatch error on function code 03.',
        trace_messages: [
          {
            timestamp: new Date().toISOString(),
            sender: 'PLC_CONTROLLER',
            receiver: 'TECWATCH_SLAVE',
            protocol: 'MODBUS',
            message_type: 'READ_HOLDING_REGISTERS',
            status: 'FAILED',
            error_reason: 'Register Boundary Overflow'
          }
        ],
        failure_findings: [
          {
            message_id: '204',
            expected_length: 16,
            actual_length: 12,
            result: 'Message Length Error'
          }
        ],
        data_comparisons: [
          { field: 'RegisterQty', expected: '10', actual: '6', result: 'Error' },
          { field: 'FunctionCode', expected: '03', actual: '03', result: 'OK' }
        ]
      };
    }

    this.apiService.submitAnalysis(newTrace).subscribe({
      next: () => {
        this.submitNotification = `Scenario ${newTrace.analysis_id} sent to backend API successfully!`;
        this.isSubmitting = false;
        this.selectedAnalysis = newTrace;
        this.loadAnalyses(newTrace.analysis_id);
        setTimeout(() => (this.submitNotification = null), 4000);
      },
      error: (err) => {
        console.warn('API error, falling back locally:', err);
        this.analyses.unshift(newTrace);
        this.selectedAnalysis = newTrace;
        this.isSubmitting = false;
        this.submitNotification = `Scenario ${newTrace.analysis_id} loaded locally.`;
        setTimeout(() => (this.submitNotification = null), 4000);
      }
    });
  }

  resetHistory(): void {
    this.apiService.resetAnalyses().subscribe({
      next: () => {
        this.selectedStatus = 'ALL';
        this.selectedProtocol = 'ALL';
        this.searchTerm = '';
        this.selectedAnalysis = null;
        this.loadAnalyses();
        this.submitNotification = '🔄 Trace history cleared and reset to initial demo run.';
        setTimeout(() => (this.submitNotification = null), 4000);
      },
      error: () => {
        this.selectedStatus = 'ALL';
        this.selectedProtocol = 'ALL';
        this.searchTerm = '';
        this.loadAnalyses();
      }
    });
  }
}

