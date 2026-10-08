import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environment/environment';

export interface AdminProgramStage {
  _id?: string;
  code?: string;
  name: string;
  nameHindi?: string;
  displayOrder?: number;
  isActive?: boolean;
  programsCount?: number;
}

@Injectable({ providedIn: 'root' })
export class ProgramStageAdminService {
  constructor(private http: HttpClient) {}

  getAll(): Observable<{ success: boolean; data: AdminProgramStage[] }> {
    return this.http.get<{ success: boolean; data: AdminProgramStage[] }>(`${environment.apiUrl}/program-stages/admin/all`);
  }

  create(stage: Partial<AdminProgramStage>): Observable<{ success: boolean; data: AdminProgramStage }> {
    return this.http.post<{ success: boolean; data: AdminProgramStage }>(`${environment.apiUrl}/program-stages/admin`, stage);
  }

  update(stage: AdminProgramStage): Observable<{ success: boolean; data: AdminProgramStage }> {
    return this.http.put<{ success: boolean; data: AdminProgramStage }>(`${environment.apiUrl}/program-stages/admin/${stage._id}`, stage);
  }

  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${environment.apiUrl}/program-stages/admin/${id}`);
  }
}
