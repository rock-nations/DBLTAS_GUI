import { Injectable } from '@angular/core';
import { AnalysisScenarios } from '../models/analysis-scenarios';

/** Keeps the last upload analysis while the user switches between views. */
@Injectable({
  providedIn: 'root'
})
export class UploadStateService {
  result: AnalysisScenarios | null = null;
  fileNames: string[] = [];

  set(result: AnalysisScenarios, fileNames: string[]): void {
    this.result = result;
    this.fileNames = fileNames;
  }

  clear(): void {
    this.result = null;
    this.fileNames = [];
  }
}
