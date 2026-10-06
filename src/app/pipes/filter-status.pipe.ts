import { Pipe, PipeTransform } from '@angular/core';
import { TraceAnalysis } from '../models/trace-analysis';

@Pipe({
  name: 'filterStatus',
  standalone: false
})
export class FilterStatusPipe implements PipeTransform {
  transform(items: TraceAnalysis[], status: string): TraceAnalysis[] {
    if (!items || !status) {
      return items;
    }
    return items.filter(item => item.result_status.toUpperCase() === status.toUpperCase());
  }
}
