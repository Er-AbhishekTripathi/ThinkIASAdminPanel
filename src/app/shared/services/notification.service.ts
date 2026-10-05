import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environment/environment';

export interface AdminNotification {
  _id: string;
  title: string;
  body: string;
  link?: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly notifications = signal<AdminNotification[]>([]);
  readonly unread = signal(0);
  private refreshTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly http: HttpClient) {}

  load() {
    this.http.get<{ data: AdminNotification[] }>(`${environment.apiUrl}/notifications`).subscribe({
      next: ({ data }) => {
        this.notifications.set(data);
        this.unread.set(data.filter(item => !item.isRead).length);
      },
      error: error => console.error('Unable to load notifications:', error)
    });
  }

  startPolling() {
    if (!this.refreshTimer) this.refreshTimer = setInterval(() => this.load(), 15000);
  }

  stopPolling() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = undefined;
  }

  clear() {
    this.notifications.set([]);
    this.unread.set(0);
  }

  markRead(item: AdminNotification) {
    if (!item.isRead) {
      this.http.patch(`${environment.apiUrl}/notifications/${item._id}/read`, {}).subscribe({
        next: () => this.load(),
        error: error => console.error('Unable to mark notification as read:', error)
      });
    }
  }
}
