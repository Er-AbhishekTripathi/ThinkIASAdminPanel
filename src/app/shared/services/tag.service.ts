import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Tag } from '../../core/models/tag.model';
import { environment } from '../../../environment/environment';

export interface TagResponse {
  _id: string;
  category: string;
  subCategory: string;
  topic: string;
  tag: string;
}

@Injectable({
  providedIn: 'root'
})
export class TagService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/tags`;

  private endpoint(section: 'prelims' | 'mains' = 'prelims'): string {
    return section === 'mains' ? `${environment.apiUrl}/mains-tags` : this.apiUrl;
  }

  getTags(section: 'prelims' | 'mains' = 'prelims'): Observable<Tag[]> {
    return this.http.get<Tag[]>(this.endpoint(section));
  }

  getCategories(section: 'prelims' | 'mains' = 'prelims'): Observable<string[]> {
    return this.http.get<string[]>(`${this.endpoint(section)}/categories`);
  }

  createTag(tagData: { category: string; subCategory: string; topic: string }, section: 'prelims' | 'mains' = 'prelims'): Observable<Tag> {
    return this.http.post<Tag>(this.endpoint(section), tagData);
  }

  updateTag(tagId: string, tagData: { category: string; subCategory: string; topic: string }, section: 'prelims' | 'mains' = 'prelims'): Observable<Tag> {
    return this.http.put<Tag>(`${this.endpoint(section)}/${tagId}`, tagData);
  }

  deleteTag(tagId: string, section: 'prelims' | 'mains' = 'prelims'): Observable<any> {
    return this.http.delete(`${this.endpoint(section)}/${tagId}`);
  }
}