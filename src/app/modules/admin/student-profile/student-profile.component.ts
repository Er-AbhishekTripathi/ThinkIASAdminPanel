import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environment/environment';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
@Component({selector:'app-student-profile',standalone:true,imports:[CommonModule,RouterLink,FormsModule,TranslatePipe],templateUrl:'./student-profile.component.html',styleUrls:['./student-profile.component.css']})
export class StudentProfileComponent implements OnInit {
  private http=inject(HttpClient); private route=inject(ActivatedRoute);
  student:any;error='';saving=false;
  editing=false;
  profileForm={fullName:'',email:'',phone:''};
  toggleStatus(){this.saving=true;this.http.patch<any>(environment.apiUrl+'/admin/students/'+this.student._id+'/status',{isActive:this.student.isActive===false}).subscribe({next:r=>{this.student.isActive=r.data.isActive;this.saving=false;},error:e=>{this.error=e.error?.message||'Unable to update account.';this.saving=false;}});}
  toggleBlock(){this.saving=true;this.http.patch<any>(environment.apiUrl+'/admin/students/'+this.student._id+'/block',{isBlocked:this.student.isBlocked!==true}).subscribe({next:r=>{this.student.isBlocked=r.data.isBlocked;this.saving=false;},error:e=>{this.error=e.error?.message||'Unable to update account block.';this.saving=false;}});}
  startEditing(){this.error='';this.profileForm={fullName:this.student.fullName||'',email:this.student.email||'',phone:this.student.phone||''};this.editing=true;}
  cancelEditing(){this.editing=false;this.error='';}
  saveDetails(){if(!this.student||this.saving)return;this.saving=true;this.error='';this.http.patch<any>(environment.apiUrl+'/admin/students/'+this.student._id+'/profile',this.profileForm).subscribe({next:r=>{this.student={...this.student,...r.data};this.editing=false;this.saving=false;},error:e=>{this.error=e.error?.message||'Unable to update student details.';this.saving=false;}});}
  ngOnInit(){this.http.get<any>(`${environment.apiUrl}/admin/students/${this.route.snapshot.paramMap.get('id')}`).subscribe({next:r=>this.student=r.data,error:e=>this.error=e.error?.message||'Unable to load profile.'});}
}
