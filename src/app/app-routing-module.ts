import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { FindingsComponent } from './components/findings/findings.component';
import { UploadComponent } from './components/upload/upload.component';

const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'findings', component: FindingsComponent },
  { path: 'upload', component: UploadComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
