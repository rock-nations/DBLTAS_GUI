import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);
  const endpointLabel = `${req.method} ${req.url.split('/api')[1] || req.url}`;
  
  loadingService.show(endpointLabel);

  return next(req).pipe(
    finalize(() => {
      loadingService.hide();
    })
  );
};
