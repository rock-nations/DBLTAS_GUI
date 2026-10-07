import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { FindingsComponent } from './components/findings/findings.component';
import { LoadingComponent } from './components/loading/loading.component';
import { StatusHeaderComponent } from './components/status-header/status-header.component';
import { FilterStatusPipe } from './pipes/filter-status.pipe';
import { loadingInterceptor } from './interceptors/loading.interceptor';

@NgModule({
  declarations: [
    App,
    DashboardComponent,
    FindingsComponent,
    LoadingComponent,
    StatusHeaderComponent,
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
