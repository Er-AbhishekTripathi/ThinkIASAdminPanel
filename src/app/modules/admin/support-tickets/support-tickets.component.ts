import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environment/environment';

@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `<section class="wrap"><header><div><p>HELP DESK</p><h1>Support Tickets</h1><span>Review student complaints, attachments and send responses.</span></div></header>
  <div class="filters"><select [(ngModel)]="status" (change)="load()"><option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="closed">Closed</option></select></div>
  <p *ngIf="error" class="error">{{error}}</p>
  <div class="layout"><ul><li *ngFor="let ticket of tickets" (click)="open(ticket._id)" [class.active]="selected?._id===ticket._id"><strong>{{ticket.subject}}</strong><small>{{ticket.createdBy?.fullName || ticket.createdBy?.email}} · {{ticket.status}}</small></li></ul>
  <article *ngIf="selected"><h2>{{selected.subject}}</h2><p>{{selected.status}}</p>
    <div class="messages"><div *ngFor="let message of selected.messages" [class.admin]="message.role==='admin'"><b>{{message.role}}</b><p>{{message.body}}</p><a *ngFor="let file of message.attachments" [href]="file.url" target="_blank" rel="noopener">{{file.name}}</a></div></div>
    <form (submit)="reply($event)"><textarea [(ngModel)]="replyBody" name="reply" placeholder="Write a response"></textarea><input type="file" multiple (change)="onFiles($event)" accept="image/*,.pdf"><button type="submit">Send response</button></form>
    <div class="status-row"><button type="button" (click)="setStatus('open')">Open</button><button type="button" (click)="setStatus('in_progress')">In progress</button><button type="button" (click)="setStatus('closed')">Close</button></div>
  </article></div></section>`,
  styles: [`:host{display:block;background:#f6f8fb;min-height:100vh}.wrap{max-width:1100px;margin:0 auto;padding:24px}header{background:#102a43;color:#fff;padding:28px;border-radius:16px}.layout{display:grid;grid-template-columns:300px 1fr;gap:16px;margin-top:16px}ul{list-style:none;margin:0;padding:0;background:#fff;border-radius:12px}li{padding:14px;border-bottom:1px solid #eef2f6;cursor:pointer}li.active{background:#e8f6ee}article{background:#fff;border-radius:12px;padding:20px}.messages div{padding:12px;border-radius:10px;background:#f1f5f9;margin-bottom:8px}.messages .admin{background:#e8f6ee}form,textarea,input,select,button{display:block;width:100%;margin-top:8px}button{background:#198754;color:#fff;border:0;border-radius:8px;padding:10px;cursor:pointer}.status-row{display:flex;gap:8px}.status-row button{background:#1d5374}.error{color:#be123c}`]
})
export class SupportTicketsComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  tickets: any[] = []; selected: any = null; status = ''; error = ''; replyBody = ''; files: File[] = [];
  ngOnInit() { this.load(); }
  load() {
    const params: any = {}; if (this.status) params.status = this.status;
    this.http.get<any>(`${environment.apiUrl}/support-tickets`, { params }).subscribe({ next: r => this.tickets = r.data || [], error: e => this.error = e.error?.message || 'Unable to load tickets.' });
  }
  open(id: string) { this.http.get<any>(`${environment.apiUrl}/support-tickets/${id}`).subscribe({ next: r => this.selected = r.data }); }
  onFiles(event: Event) { this.files = Array.from((event.target as HTMLInputElement).files || []); }
  reply(event: Event) {
    event.preventDefault();
    const data = new FormData(); data.append('body', this.replyBody); this.files.forEach(file => data.append('attachments', file));
    this.http.post<any>(`${environment.apiUrl}/support-tickets/${this.selected._id}/replies`, data).subscribe({ next: r => { this.selected = r.data; this.replyBody = ''; this.files = []; this.load(); }, error: e => this.error = e.error?.message || 'Unable to send reply.' });
  }
  setStatus(status: string) { this.http.patch<any>(`${environment.apiUrl}/support-tickets/${this.selected._id}/status`, { status }).subscribe({ next: r => { this.selected = r.data; this.load(); } }); }
}
