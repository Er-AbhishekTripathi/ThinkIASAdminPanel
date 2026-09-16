import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environment/environment';

export interface Meeting {
  _id: string;
  title: string;
  description: string;
  meetingDate: string;
  duration: number;
  meetingLink: string;
  videoLink?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMeetingRequest {
  title: string;
  description?: string;
  meetingDate: string;
  duration?: number;
  meetingLink: string;
}

export interface UpdateMeetingRequest {
  title?: string;
  description?: string;
  meetingDate?: string;
  duration?: number;
  meetingLink?: string;
  videoLink?: string;
}

export interface MeetingsResponse {
  message: string;
  upcomingMeetings: Meeting[];
  completedMeetings: Meeting[];
}

@Injectable({
  providedIn: 'root'
})
export class MeetingService {
  private apiUrl = `${environment.apiUrl}/meetings`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Create meeting
  createMeeting(meetingData: CreateMeetingRequest): Observable<{ message: string; meeting: Meeting }> {
    return this.http.post<{ message: string; meeting: Meeting }>(
      this.apiUrl,
      meetingData,
      { headers: this.getHeaders() }
    );
  }

  // Get admin meetings
  getAdminMeetings(): Observable<MeetingsResponse> {
    return this.http.get<MeetingsResponse>(`${this.apiUrl}/admin`, {
      headers: this.getHeaders()
    });
  }

  // Update meeting
  updateMeeting(meetingId: string, updateData: UpdateMeetingRequest): Observable<{ message: string; meeting: Meeting }> {
    return this.http.put<{ message: string; meeting: Meeting }>(
      `${this.apiUrl}/${meetingId}`,
      updateData,
      { headers: this.getHeaders() }
    );
  }

  // Delete meeting
  deleteMeeting(meetingId: string): Observable<{ message: string; meeting: Meeting }> {
    return this.http.delete<{ message: string; meeting: Meeting }>(
      `${this.apiUrl}/${meetingId}`,
      { headers: this.getHeaders() }
    );
  }
}