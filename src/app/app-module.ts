import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { AnalysisViewComponent } from './components/analysis-view/analysis-view.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { FindingsComponent } from './components/findings/findings.component';
import { LoadingComponent } from './components/loading/loading.component';
import { StatusHeaderComponent } from './components/status-header/status-header.component';
import { UploadComponent } from './components/upload/upload.component';
import { FilterStatusPipe } from './pipes/filter-status.pipe';
import { loadingInterceptor } from './interceptors/loading.interceptor';

@NgModule({
  declarations: [
    App,
    AnalysisViewComponent,
    DashboardComponent,
    FindingsComponent,
    LoadingComponent,
    StatusHeaderComponent,
    UploadComponent,
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
