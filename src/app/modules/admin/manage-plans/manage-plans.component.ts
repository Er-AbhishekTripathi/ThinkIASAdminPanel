import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminPlan, PlanAdminService } from '../../../shared/services/plan-admin.service';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminExam, ExamAdminService } from '../../../shared/services/exam-admin.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environment/environment';

@Component({
  selector: 'app-manage-plans',
  standalone: true,
  imports: [TranslatePipe, CommonModule, FormsModule, MatDialogModule, MatSnackBarModule, RouterLink],
  templateUrl: './manage-plans.component.html',
  styleUrls: ['./manage-plans.component.css']
})
export class ManagePlansComponent implements OnInit {
  @ViewChild('editorTemplate') private editorTemplate!: TemplateRef<unknown>;
  private editorDialog?: MatDialogRef<unknown>;

  plans: AdminPlan[] = [];
  editing: AdminPlan | null = null;
  featuresText = '';
  featuresHindiText = '';
  loading = false;
  saving = false;
  deletingPlanId: string | null = null;
  message = '';
  error = '';
  viewing = false;
  exams: AdminExam[] = [];
  programs: Array<{ _id: string; programName: string; examination?: string; examId?: any }> = [];
  selectedExamIds: string[] = [];
  selectedProgramIds: string[] = [];
  selectedExamId = '';

  constructor(
    private service: PlanAdminService,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
    private snackBar: MatSnackBar,
    private examService: ExamAdminService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}
  ngOnInit(): void {
    this.load();
    this.examService.getAll().subscribe({ next: (response) => this.exams = response.data || [] });
    this.http.get<any>(`${environment.apiUrl}/programs`).subscribe({
      next: (response) => { this.programs = response.data || []; }
    });
    this.route.queryParamMap.subscribe((params) => {
      this.selectedExamId = params.get('examId') || '';
    });
  }

  displayedPlans(): AdminPlan[] {
    if (!this.selectedExamId) return this.plans;
    return this.plans.filter((plan) => (plan.examIds || []).some((exam) => this.idOf(exam) === this.selectedExamId));
  }

  onExamFilter(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { examId: this.selectedExamId || null },
      queryParamsHandling: 'merge'
    });
  }

  idOf(value: any): string {
    if (!value) return '';
    return typeof value === 'string' ? value : (value._id || '');
  }

  examLabel(exam: any): string {
    return exam?.name || this.exams.find((item) => item._id === this.idOf(exam))?.name || 'Exam';
  }

  programLabel(program: any): string {
    return program?.programName || this.programs.find((item) => item._id === this.idOf(program))?.programName || 'Program';
  }

  mappedPrograms() {
    if (!this.selectedExamIds.length) return [];
    return this.programs.filter((program) => this.selectedExamIds.includes(this.idOf(program.examId)));
  }

  toggleExam(examId: string, checked: boolean): void {
    this.selectedExamIds = checked
      ? Array.from(new Set([...this.selectedExamIds, examId]))
      : this.selectedExamIds.filter((id) => id !== examId);
    const allowed = new Set(this.mappedPrograms().map((program) => program._id));
    this.selectedProgramIds = this.selectedProgramIds.filter((id) => allowed.has(id));
  }

  toggleProgram(programId: string, checked: boolean): void {
    this.selectedProgramIds = checked
      ? Array.from(new Set([...this.selectedProgramIds, programId]))
      : this.selectedProgramIds.filter((id) => id !== programId);
  }

  load(): void {
    this.loading = true; this.error = '';
    this.service.getAll().subscribe({
      next: response => { this.plans = response.data; this.loading = false; },
      error: error => { this.error = error?.error?.message || 'Plans could not be loaded.'; this.loading = false; }
    });
  }

  includesPrelims = true; includesMains = false;
  creating = false;
  add(): void {
    this.includesPrelims = true; this.includesMains = false; this.message = '';
    this.creating = true; this.viewing = false; this.error = ''; this.featuresText = ''; this.featuresHindiText = '';
    this.selectedExamIds = this.selectedExamId ? [this.selectedExamId] : [];
    this.selectedProgramIds = [];
    this.editing = {id: '', accessType: 'pre', name: '', subtitle: '', badge: '', baseAmount: 0, totalAmount: 0, duration: '', features: [], displayOrder: this.plans.length + 1, isActive: true, examIds: [], programIds: []};
    this.openEditor();
  }
  view(plan: AdminPlan): void {
    this.edit(plan, true);
  }
  edit(plan: AdminPlan, viewing = false): void {
    this.creating = false;
    this.viewing = viewing;
    this.editing = { ...plan, accessType: plan.accessType || (plan.id as 'pre' | 'mains' | 'combo'), features: [...plan.features] };
    this.selectedExamIds = (plan.examIds || []).map((item) => this.idOf(item)).filter(Boolean);
    this.selectedProgramIds = (plan.programIds || []).map((item) => this.idOf(item)).filter(Boolean);
    this.includesPrelims = this.editing.accessType !== 'mains';
    this.includesMains = this.editing.accessType !== 'pre';
    this.featuresText = plan.features.join('\n');
    this.featuresHindiText = (plan.featuresHindi || []).join('\n');
    this.message = ''; this.error = '';
    this.openEditor();
  }

  cancel(): void { this.editorDialog?.close(); }

  private openEditor(): void {
    this.editorDialog = this.dialog.open(this.editorTemplate, {
      width: '920px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100vh - 32px)',
      panelClass: 'manage-plan-dialog-panel',
      autoFocus: false
    });
    this.editorDialog.afterClosed().subscribe(() => {
      this.editing = null;
      this.editorDialog = undefined;
    });
  }

  deletePlan(plan: AdminPlan): void {
    if (this.deletingPlanId) return;
    this.confirmDialog.ask({
      title: 'Delete this plan?',
      message: `Delete "${plan.name}"? Plans with programs or batches cannot be deleted.`,
      confirmText: 'Delete plan',
      icon: 'delete_outline'
    }).subscribe(() => {
      this.deletingPlanId = plan.id;
      this.error = '';
      this.message = '';
      this.service.delete(plan.id).subscribe({
        next: () => {
          this.deletingPlanId = null;
          this.snackBar.open(`Plan "${plan.name}" deleted successfully.`, 'Close', {
            duration: 5000,
            panelClass: ['success-snackbar']
          });
          this.load();
        },
        error: error => {
          this.deletingPlanId = null;
          this.error = error?.error?.message || 'Plan could not be deleted.';
          if (error?.status === 409) {
            this.confirmDialog.ask({
              title: 'Plan still has programs',
              message: this.error,
              confirmText: 'Got it',
              icon: 'warning'
            }).subscribe();
          } else {
            this.snackBar.open(this.error, 'Close', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }
        }
      });
    });
  }

  save(): void {
    if (!this.editing || this.saving || this.viewing) return;
    if (!this.selectedExamIds.length) { this.error = 'Map at least one exam to this plan.'; return; }
    if (!this.includesPrelims && !this.includesMains) { this.error = 'Choose at least one included course.'; return; }
    this.editing.accessType = this.includesPrelims && this.includesMains ? 'combo' : this.includesPrelims ? 'pre' : 'mains';
    this.editing.features = this.featuresText.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    this.editing.featuresHindi = this.featuresHindiText.split(/\r?\n/).map(value => value.trim());
    this.editing.baseAmount = Number(this.editing.baseAmount);
    this.editing.totalAmount = Number(this.editing.totalAmount);
    this.editing.displayOrder = Number(this.editing.displayOrder);
    this.editing.examIds = this.selectedExamIds;
    this.editing.programIds = this.selectedProgramIds;
    if (!this.editing.name.trim() || !Number.isFinite(this.editing.totalAmount) || this.editing.totalAmount < 0) { this.error = 'Plan name and a valid price are required.'; return; }
    this.saving = true; this.error = '';
    (this.creating ? this.service.create(this.editing) : this.service.update(this.editing)).subscribe({
      next: () => {
        const successMessage = this.creating ? 'Plan created successfully.' : 'Plan updated successfully.';
        this.saving = false;
        this.editing = null;
        this.editorDialog?.close();
        this.message = '';
        this.snackBar.open(successMessage, 'Close', {
          duration: 5000,
          panelClass: ['success-snackbar']
        });
        this.load();
      },
      error: error => { this.error = error?.error?.message || 'Plan could not be updated.'; this.saving = false; }
    });
  }
}
