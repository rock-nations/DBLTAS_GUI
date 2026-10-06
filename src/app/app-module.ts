import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LoadingComponent } from './components/loading/loading.component';
import { FilterStatusPipe } from './pipes/filter-status.pipe';
import { loadingInterceptor } from './interceptors/loading.interceptor';

@NgModule({
  declarations: [
    App,
    DashboardComponent,
    LoadingComponent,
    FilterStatusPipe
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([loadingInterceptor]))
  ],
  bootstrap: [App]
})
export class AppModule { }
