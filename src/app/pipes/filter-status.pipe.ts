import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterStatus',
  standalone: false
})
export class FilterStatusPipe implements PipeTransform {
  transform<T extends { status: string }>(items: T[], status: string): T[] {
    if (!items || !status) {
      return items;
    }
    return items.filter(item => item.status.toUpperCase() === status.toUpperCase());
  }
}
