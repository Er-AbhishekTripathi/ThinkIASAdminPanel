import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminExam, ExamAdminService } from '../../../shared/services/exam-admin.service';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-manage-exams',
  standalone: true,
  imports: [TranslatePipe, CommonModule, FormsModule, MatDialogModule, MatSnackBarModule, RouterLink],
  templateUrl: './manage-exams.component.html',
  styleUrls: ['./manage-exams.component.css']
})
export class ManageExamsComponent implements OnInit {
  @ViewChild('editorTemplate') private editorTemplate!: TemplateRef<unknown>;
  private editorDialog?: MatDialogRef<unknown>;

  exams: AdminExam[] = [];
  editing: AdminExam | null = null;
  creating = false;
  viewing = false;
  loading = false;
  saving = false;
  deletingId: string | null = null;
  error = '';

  constructor(
    private service: ExamAdminService,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = '';
    this.service.getAll().subscribe({
      next: (response) => { this.exams = response.data || []; this.loading = false; },
      error: (error) => { this.error = error?.error?.message || 'Exams could not be loaded.'; this.loading = false; }
    });
  }

  add(): void {
    this.creating = true;
    this.viewing = false;
    this.editing = { code: '', name: '', nameHindi: '', description: '', displayOrder: this.exams.length + 1, isActive: true };
    this.openEditor();
  }

  view(exam: AdminExam): void {
    this.creating = false;
    this.viewing = true;
    this.editing = { ...exam };
    this.openEditor();
  }

  edit(exam: AdminExam): void {
    this.creating = false;
    this.viewing = false;
    this.editing = { ...exam };
    this.openEditor();
  }

  cancel(): void { this.editorDialog?.close(); }

  private openEditor(): void {
    this.editorDialog = this.dialog.open(this.editorTemplate, {
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100vh - 32px)',
      autoFocus: false
    });
    this.editorDialog.afterClosed().subscribe(() => {
      this.editing = null;
      this.editorDialog = undefined;
    });
  }

  deleteExam(exam: AdminExam): void {
    if (!exam._id || this.deletingId) return;
    this.confirmDialog.ask({
      title: 'Delete this exam?',
      message: `Delete "${exam.name}"? Exams mapped to programs or plans cannot be deleted.`,
      confirmText: 'Delete exam',
      icon: 'delete_outline'
    }).subscribe(() => {
      this.deletingId = exam._id!;
      this.service.delete(exam._id!).subscribe({
        next: () => {
          this.deletingId = null;
          this.snackBar.open(`Exam "${exam.name}" deleted.`, 'Close', { duration: 4000 });
          this.load();
        },
        error: (error) => {
          this.deletingId = null;
          this.error = error?.error?.message || 'Exam could not be deleted.';
          this.snackBar.open(this.error, 'Close', { duration: 5000 });
        }
      });
    });
  }

  save(): void {
    if (!this.editing || this.saving || this.viewing) return;
    if (!this.editing.name.trim()) { this.error = 'Exam name is required.'; return; }
    this.saving = true;
    this.error = '';
    const request = this.creating ? this.service.create(this.editing) : this.service.update(this.editing);
    request.subscribe({
      next: () => {
        this.saving = false;
        this.editorDialog?.close();
        this.snackBar.open(this.creating ? 'Exam created.' : 'Exam updated.', 'Close', { duration: 4000 });
        this.load();
      },
      error: (error) => {
        this.saving = false;
        this.error = error?.error?.message || 'Exam could not be saved.';
      }
    });
  }
}
