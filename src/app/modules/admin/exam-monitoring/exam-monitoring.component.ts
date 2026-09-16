import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environment/environment';

interface Session { _id:string; status:string; online:boolean; lastHeartbeatAt:string; latestSnapshotUrl?:string; recordingUrl?:string; snapshotCount:number; violations:any[]; student?:{fullName:string;email:string}; test?:{title:string}; }
@Component({selector:'app-exam-monitoring',standalone:true,imports: [TranslatePipe, CommonModule],templateUrl:'./exam-monitoring.component.html',styleUrl:'./exam-monitoring.component.css'})
export class ExamMonitoringComponent implements OnInit,OnDestroy {
 private http=inject(HttpClient); @ViewChild('liveVideo') liveVideo?:ElementRef<HTMLVideoElement>;
 sessions=signal<Session[]>([]);loading=signal(true);activeTab=signal<'live'|'history'>('live');selected=signal<Session|null>(null);liveStatus=signal('Connecting to student camera...');
 private timer?:number;private answerTimer?:number;private peer?:RTCPeerConnection;private requestId='';private iceServers:RTCIceServer[]=[{urls:'stun:stun.l.google.com:19302'}];
 ngOnInit(){this.load();this.loadIceConfig();this.timer=window.setInterval(()=>this.load(false),5000)}
 ngOnDestroy(){if(this.timer)clearInterval(this.timer);this.closeViewer()}
 load(show=true){if(show)this.loading.set(true);this.http.get<any>(`${environment.apiUrl}/proctoring/admin/sessions`).subscribe({next:r=>{
   this.sessions.set(r.data);this.loading.set(false);
   const current=this.selected();
   const updated=current?r.data.find((s:Session)=>s._id===current._id):null;
   if(updated){
     if(!updated.online&&this.peer){this.closeViewer(false);this.activeTab.set('history');}
     this.selected.set(updated);
     if(!updated.online)this.liveStatus.set(updated.recordingUrl?'Completed — recording ready':updated.status==='completed'?'Test completed. Recording upload pending.':'Student is offline.');
   }
 },error:()=>this.loading.set(false)})}
 viewRecording(s:Session){this.closeViewer();this.selected.set(s);this.liveStatus.set('Completed — recording ready');}
  visibleSessions():Session[]{return this.activeTab()==='live'?this.sessions().filter(x=>x.online):this.sessions()}
  liveCount():number{return this.sessions().filter(x=>x.online).length}
 watch(s:Session){if(!s.online)return;this.closeViewer(false);this.selected.set(s);this.liveStatus.set('Connecting to student camera...');window.setTimeout(()=>this.createViewer(s),0)}
 closeViewer(clear=true){if(this.answerTimer)clearInterval(this.answerTimer);this.answerTimer=undefined;this.peer?.close();this.peer=undefined;if(this.requestId&&this.selected())this.http.delete(`${environment.apiUrl}/proctoring/admin/sessions/${this.selected()!._id}/live`,{params:{requestId:this.requestId}}).subscribe();this.requestId='';if(this.liveVideo?.nativeElement)this.liveVideo.nativeElement.srcObject=null;if(clear)this.selected.set(null)}
 private async loadIceConfig(){try{const r=await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/proctoring/ice-config`));if(r?.data?.iceServers?.length)this.iceServers=r.data.iceServers}catch{}}
 private async createViewer(s:Session){if(this.selected()?._id!==s._id||!this.selected()?.online)return;try{const p=new RTCPeerConnection({iceServers:this.iceServers});this.peer=p;p.addTransceiver('video',{direction:'recvonly'});p.addTransceiver('audio',{direction:'recvonly'});p.ontrack=e=>{const v=this.liveVideo?.nativeElement;if(v){v.srcObject=e.streams[0];v.play().catch(()=>undefined)}this.liveStatus.set('LIVE')};p.oniceconnectionstatechange=()=>{if(['connected','completed'].includes(p.iceConnectionState))this.liveStatus.set('LIVE');if(p.iceConnectionState==='failed')this.liveStatus.set('Connection failed. Please reconnect.');if(p.iceConnectionState==='disconnected')this.liveStatus.set('Student connection interrupted.')};await p.setLocalDescription(await p.createOffer());await this.waitForIce(p);if(this.peer!==p)return;const r=await firstValueFrom(this.http.post<any>(`${environment.apiUrl}/proctoring/admin/sessions/${s._id}/live/offer`,{offer:p.localDescription?.toJSON()}));if(this.peer!==p){this.http.delete(`${environment.apiUrl}/proctoring/admin/sessions/${s._id}/live`,{params:{requestId:r.data.requestId}}).subscribe();return;}this.requestId=r.data.requestId;this.answerTimer=window.setInterval(()=>this.pollAnswer(s._id),1500);this.pollAnswer(s._id)}catch(e:any){if(this.selected()?._id===s._id)this.liveStatus.set(e?.error?.message||'Unable to start live view.')}}
 private pollAnswer(id:string){if(!this.requestId||this.peer?.remoteDescription)return;this.http.get<any>(`${environment.apiUrl}/proctoring/admin/sessions/${id}/live/answer`,{params:{requestId:this.requestId}}).subscribe({next:r=>{if(!r?.data?.answer||!this.peer||this.peer.remoteDescription)return;this.peer.setRemoteDescription(r.data.answer).catch(()=>this.liveStatus.set('Invalid student stream response.'));if(this.answerTimer)clearInterval(this.answerTimer)}})}
 private waitForIce(p:RTCPeerConnection):Promise<void>{if(p.iceGatheringState==='complete')return Promise.resolve();return new Promise(resolve=>{const done=()=>{if(p.iceGatheringState==='complete'){p.removeEventListener('icegatheringstatechange',done);resolve()}};p.addEventListener('icegatheringstatechange',done);window.setTimeout(()=>{p.removeEventListener('icegatheringstatechange',done);resolve()},8000)})}
}
