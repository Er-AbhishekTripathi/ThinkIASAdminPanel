import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environment/environment';
import { TagResponse } from './tag.service';

export interface MainsQuestion {
  _id: string;
  question: {
    english: string;
    hindi: string;
  };
  tags: TagResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface MainsQuestionsResponse {
  questions: MainsQuestion[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalQuestions: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface MainsQuestionInput {
  question: {
    english: string;
    hindi: string;
  };
  tags: string[];
}

@Injectable({ providedIn: 'root' })
export class MainsQuestionService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/mains-questions`;

  getQuestions(page: number, limit: number, search: string, tagId: string): Observable<MainsQuestionsResponse> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (search.trim()) params = params.set('search', search.trim());
    if (tagId) params = params.set('tagId', tagId);
    return this.http.get<MainsQuestionsResponse>(this.apiUrl, { params });
  }

  createQuestion(question: MainsQuestionInput): Observable<{ question: MainsQuestion }> {
    return this.http.post<{ question: MainsQuestion }>(this.apiUrl, question);
  }

  updateQuestion(id: string, question: MainsQuestionInput): Observable<{ question: MainsQuestion }> {
    return this.http.put<{ question: MainsQuestion }>(`${this.apiUrl}/${id}`, question);
  }

  deleteQuestion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  previewImport(files: File[]): Observable<{ questions: MainsQuestionInput[] }> {
    const form = new FormData();
    files.forEach(file => form.append('file', file));
    form.append('preview', 'true');
    return this.http.post<{ questions: MainsQuestionInput[] }>(`${this.apiUrl}/import`, form);
  }

  importQuestions(questions: MainsQuestionInput[]): Observable<{ count: number; message: string }> {
    return this.http.post<{ count: number; message: string }>(`${this.apiUrl}/import`, { questions });
  }
}
