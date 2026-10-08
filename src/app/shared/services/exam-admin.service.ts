import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environment/environment';

export interface AdminExam {
  _id?: string;
  code: string;
  name: string;
  nameHindi?: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  isVisibleOnWebsite: boolean;
  programsCount?: number;
  plansCount?: number;
  batchesCount?: number;
}

@Injectable({ providedIn: 'root' })
export class ExamAdminService {
  constructor(private http: HttpClient) {}

  getPublic(): Observable<{ success: boolean; data: AdminExam[] }> {
    return this.http.get<{ success: boolean; data: AdminExam[] }>(`${environment.apiUrl}/exams`);
  }

  getAll(): Observable<{ success: boolean; data: AdminExam[] }> {
    return this.http.get<{ success: boolean; data: AdminExam[] }>(`${environment.apiUrl}/exams/admin/all`);
  }

  create(exam: Partial<AdminExam>): Observable<{ success: boolean; data: AdminExam }> {
    return this.http.post<{ success: boolean; data: AdminExam }>(`${environment.apiUrl}/exams/admin`, exam);
  }

  update(exam: AdminExam): Observable<{ success: boolean; data: AdminExam }> {
    return this.http.put<{ success: boolean; data: AdminExam }>(`${environment.apiUrl}/exams/admin/${exam._id}`, exam);
  }

  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${environment.apiUrl}/exams/admin/${id}`);
  }
}
