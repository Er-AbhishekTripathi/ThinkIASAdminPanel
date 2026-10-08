import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminExam, ExamAdminService } from '../../../shared/services/exam-admin.service';
import { AdminPlan, PlanAdminService } from '../../../shared/services/plan-admin.service';
import { Batch, BatchService } from '../../../shared/services/batch.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environment/environment';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';

@Component({
  selector: 'app-manage-batches',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatDialogModule, MatSnackBarModule],
  templateUrl: './manage-batches.component.html',
  styleUrls: ['./manage-batches.component.css']
})
export class ManageBatchesComponent implements OnInit {
  @ViewChild('editorTemplate') private editorTemplate!: TemplateRef<unknown>;
  private editorDialog?: MatDialogRef<unknown>;

  exams: AdminExam[] = [];
  plans: AdminPlan[] = [];
  programs: any[] = [];
  batches: any[] = [];
  selectedExamId = '';
  selectedProgramId = '';
  selectedPlanId = '';
  loading = false;
  saving = false;
  viewing = false;
  creating = false;
  error = '';
  editing: any = null;

  constructor(
    private examService: ExamAdminService,
    private planService: PlanAdminService,
    private batchService: BatchService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.examService.getAll().subscribe({ next: (response) => this.exams = response.data || [] });
    this.planService.getAll().subscribe({ next: (response) => this.plans = response.data || [] });
    this.http.get<any>(`${environment.apiUrl}/programs`).subscribe({
      next: (response) => { this.programs = response.data || []; }
    });
    this.route.queryParamMap.subscribe((params) => {
      this.selectedExamId = params.get('examId') || '';
      this.selectedProgramId = params.get('programId') || '';
      this.selectedPlanId = params.get('planId') || '';
      this.loadBatches();
    });
  }

  examPrograms() {
    if (!this.selectedExamId) return [];
    return this.programs.filter((program) => this.idOf(program.examId) === this.selectedExamId);
  }

  examPlans() {
    if (!this.selectedExamId) return [];
    return this.plans.filter((plan) => (plan.examIds || []).some((exam) => this.idOf(exam) === this.selectedExamId));
  }

  idOf(value: any): string {
    if (!value) return '';
    return typeof value === 'string' ? value : (value._id || '');
  }

  onExamChange(): void {
    this.selectedProgramId = '';
    this.selectedPlanId = '';
    this.syncQuery();
  }

  onProgramChange(): void {
    this.syncQuery();
  }

  onPlanChange(): void {
    this.syncQuery();
  }

  syncQuery(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        examId: this.selectedExamId || null,
        programId: this.selectedProgramId || null,
        planId: this.selectedPlanId || null
      },
      queryParamsHandling: 'merge'
    });
  }

  loadBatches(): void {
    if (!this.selectedExamId) {
      this.batches = [];
      return;
    }
    this.loading = true;
    this.batchService.getCatalogBatches({
      examId: this.selectedExamId,
      programId: this.selectedProgramId,
      planId: this.selectedPlanId
    }).subscribe({
      next: (response) => { this.batches = response.data || []; this.loading = false; },
      error: (error) => { this.error = error?.error?.message || 'Batches could not be loaded.'; this.loading = false; }
    });
  }

  add(): void {
    if (!this.selectedProgramId) {
      this.error = 'Select an exam and a program first.';
      return;
    }
    this.creating = true;
    this.viewing = false;
    this.editing = {
      batchName: '',
      batchNameHindi: '',
      brochureEnglish: '',
      brochureHindi: '',
      startDate: '',
      endDate: '',
      order: 0,
      isActive: true
    };
    this.openEditor();
  }

  view(batch: Batch): void { this.openForm(batch, true); }
  edit(batch: Batch): void { this.openForm(batch, false); }

  private openForm(batch: Batch, viewing: boolean): void {
    this.creating = false;
    this.viewing = viewing;
    this.editing = {
      ...batch,
      startDate: batch.startDate ? new Date(batch.startDate).toISOString().slice(0, 10) : '',
      endDate: batch.endDate ? new Date(batch.endDate).toISOString().slice(0, 10) : ''
    };
    this.openEditor();
  }

  private openEditor(): void {
    this.editorDialog = this.dialog.open(this.editorTemplate, {
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: false
    });
  }

  cancel(): void { this.editorDialog?.close(); }

  save(): void {
    if (!this.editing || this.viewing || this.saving) return;
    if (!this.editing.batchName || !this.editing.startDate || !this.editing.endDate) {
      this.error = 'Batch name, start date and end date are required.';
      return;
    }
    this.saving = true;
    const payload = {
      batchName: this.editing.batchName,
      batchNameHindi: this.editing.batchNameHindi,
      brochureEnglish: this.editing.brochureEnglish,
      brochureHindi: this.editing.brochureHindi,
      startDate: new Date(this.editing.startDate).toISOString(),
      endDate: new Date(this.editing.endDate).toISOString(),
      order: Number(this.editing.order) || 0,
      isActive: this.editing.isActive !== false
    };
    const request = this.creating
      ? this.batchService.createBatch(this.selectedProgramId, payload)
      : this.batchService.updateBatch(this.editing._id, payload);
    request.subscribe({
      next: () => {
        this.saving = false;
        this.editorDialog?.close();
        this.snackBar.open(this.creating ? 'Batch created.' : 'Batch updated.', 'Close', { duration: 4000 });
        this.loadBatches();
      },
      error: (error) => {
        this.saving = false;
        this.error = error?.error?.message || 'Batch could not be saved.';
      }
    });
  }

  deleteBatch(batch: Batch): void {
    this.confirmDialog.ask({
      title: 'Delete this batch?',
      message: `Delete "${batch.batchName}"? This cannot be undone.`,
      confirmText: 'Delete batch',
      icon: 'delete_outline'
    }).subscribe(() => {
      this.batchService.deleteBatch(batch._id).subscribe({
        next: () => {
          this.snackBar.open('Batch deleted.', 'Close', { duration: 4000 });
          this.loadBatches();
        },
        error: (error) => this.snackBar.open(error?.error?.message || 'Batch could not be deleted.', 'Close', { duration: 4000 })
      });
    });
  }

  programName(batch: any): string {
    const program = batch.programId;
    return program?.programName || this.programs.find((item) => item._id === this.idOf(program))?.programName || 'Program';
  }
}
