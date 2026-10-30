import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Clipboard } from '@angular/cdk/clipboard';
import { forkJoin } from 'rxjs';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { MainsQuestion, MainsQuestionInput, MainsQuestionsResponse, MainsQuestionService } from '../../../shared/services/mains-question.service';
import { TagService, TagResponse } from '../../../shared/services/tag.service';
import { MainsQuestionDialogComponent } from './mains-question-dialog.component';

@Component({
  selector: 'app-mains-questions-master',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    SafeHtmlPipe
  ],
  templateUrl: './mains-questions-master.component.html',
  styleUrl: './mains-questions-master.component.css'
})
export class MainsQuestionsMasterComponent implements OnInit {
  private questionService = inject(MainsQuestionService);
  private tagService = inject(TagService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private clipboard = inject(Clipboard);
  private confirmDialog = inject(ConfirmDialogService);

  questions = signal<MainsQuestion[]>([]);
  tags = signal<TagResponse[]>([]);
  loading = signal(true);
  totalQuestions = signal(0);
  pageSize = signal(10);
  currentPage = signal(0);
  searchTerm = '';
  selectedTagId = '';
  importFiles: File[] = [];
  importPreview: MainsQuestionInput[] = [];
  importTags: string[][] = [];
  importError = '';
  importing = false;
  selectedQuestion: MainsQuestion | null = null;
  selectedQuestions = signal<MainsQuestion[]>([]);
  allSelected = signal(false);
  someSelected = signal(false);
  showUIDsPanel = signal(false);
  selectedTags: string[] = [];
  replaceExistingTags = false;
  bulkTagLoading = false;
  private viewDialogRef: MatDialogRef<unknown> | null = null;
  private bulkTagDialogRef: MatDialogRef<unknown> | null = null;
  private readonly maxImportFileSize = 5 * 1024 * 1024;

  @ViewChild('viewQuestionTemplate') viewQuestionTemplate!: TemplateRef<unknown>;
  @ViewChild('bulkTagDialogTemplate') bulkTagDialogTemplate!: TemplateRef<unknown>;

  ngOnInit(): void {
    this.loadTags();
    this.loadQuestions();
  }

  loadTags(): void {
    this.tagService.getTags('mains').subscribe({
      next: tags => this.tags.set(tags),
      error: error => {
        console.error('Unable to load Mains tags:', error);
        this.snackBar.open('Unable to load Mains tags.', 'Close', { duration: 3000 });
      }
    });
  }

  loadQuestions(): void {
    this.loading.set(true);
    this.questionService.getQuestions(
      this.currentPage() + 1,
      this.pageSize(),
      this.searchTerm,
      this.selectedTagId
    ).subscribe({
      next: (response: MainsQuestionsResponse) => {
        this.questions.set(response.questions);
        this.selectedQuestions.update(selected => selected.filter(question =>
          response.questions.some(current => current._id === question._id)));
        this.totalQuestions.set(response.pagination.totalQuestions);
        this.updateSelectionStates();
        this.loading.set(false);
      },
      error: error => {
        console.error('Unable to load Mains questions:', error);
        this.snackBar.open('Unable to load Mains questions.', 'Close', { duration: 3000 });
        this.loading.set(false);
      }
    });
  }

  applyFilters(): void {
    this.currentPage.set(0);
    this.clearSelection();
    this.loadQuestions();
  }

  previewImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    this.importError = '';
    this.importPreview = [];
    this.importTags = [];

    if (files.length !== 2 || files.some(file => !/\.docx$/i.test(file.name))) {
      this.importFiles = [];
      this.importError = 'Select both English and Hindi Word (.docx) files.';
      return;
    }
    if (files.some(file => file.size > this.maxImportFileSize)) {
      this.importFiles = [];
      this.importError = 'Each Word file must be 5 MB or smaller.';
      return;
    }

    this.importFiles = files;
    this.importing = true;
    this.questionService.previewImport(files).subscribe({
      next: response => {
        this.importPreview = response.questions;
        this.importTags = response.questions.map(() => []);
        this.importing = false;
      },
      error: error => {
        console.error('Unable to preview Mains question files:', error);
        this.importError = error.error?.message || 'Unable to read the Word files.';
        this.importing = false;
      }
    });
  }

  confirmImport(): void {
    if (!this.importPreview.length || this.importing) return;
    this.importing = true;
    const questions = this.importPreview.map((item, index) => ({
      ...item,
      tags: this.importTags[index] || []
    }));
    this.questionService.importQuestions(questions).subscribe({
      next: response => {
        this.snackBar.open(response.message, 'Close', { duration: 5000 });
        this.importFiles = [];
        this.importPreview = [];
        this.importTags = [];
        this.importing = false;
        this.currentPage.set(0);
        this.loadQuestions();
      },
      error: error => {
        console.error('Unable to import Mains questions:', error);
        this.importError = error.error?.message || 'Unable to import Mains questions.';
        this.importing = false;
      }
    });
  }

  getImportFileNames(): string {
    return this.importFiles.map(file => file.name).join(' + ');
  }

  changePage(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.clearSelection();
    this.loadQuestions();
  }

  toggleQuestionSelection(question: MainsQuestion, selected: boolean): void {
    this.selectedQuestions.update(questions => selected
      ? [...questions.filter(item => item._id !== question._id), question]
      : questions.filter(item => item._id !== question._id));
    this.updateSelectionStates();
  }

  toggleSelectAll(selected: boolean): void {
    this.selectedQuestions.set(selected ? [...this.questions()] : []);
    this.showUIDsPanel.set(false);
    this.updateSelectionStates();
  }

  clearSelection(): void {
    this.selectedQuestions.set([]);
    this.showUIDsPanel.set(false);
    this.updateSelectionStates();
  }

  isQuestionSelected(question: MainsQuestion): boolean {
    return this.selectedQuestions().some(selected => selected._id === question._id);
  }

  closeUIDsPanel(): void {
    this.showUIDsPanel.set(false);
  }

  private updateSelectionStates(): void {
    const selectedIds = new Set(this.selectedQuestions().map(question => question._id));
    const selectedOnPage = this.questions().filter(question => selectedIds.has(question._id)).length;
    this.allSelected.set(this.questions().length > 0 && selectedOnPage === this.questions().length);
    this.someSelected.set(selectedOnPage > 0 && selectedOnPage < this.questions().length);
  }

  showSelectedUIDs(): void {
    if (!this.selectedQuestions().length) return;
    this.showUIDsPanel.set(true);
  }

  getSelectedQuestionUIDs(): string[] {
    return this.selectedQuestions().map(question => question._id).filter(Boolean);
  }

  copyQuestionUID(question: MainsQuestion): void {
    this.copyUIDs([question._id]);
  }

  copySelectedUIDs(): void {
    this.copyUIDs(this.getSelectedQuestionUIDs());
  }

  exportSelectedToCSV(): void {
    const selected = this.selectedQuestions();
    if (!selected.length) return;

    const escapeCsv = (value: string): string => `"${value.replace(/"/g, '""')}"`;
    const rows = [
      ['UID', 'Question (English)', 'Question (Hindi)', 'Tags'],
      ...selected.map(question => [
        question._id,
        question.question.english,
        question.question.hindi,
        question.tags.map(tag => tag.tag).join(', ')
      ])
    ];
    const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'selected-mains-questions.csv';
    link.click();
    URL.revokeObjectURL(url);
    this.snackBar.open(`Exported ${selected.length} question${selected.length === 1 ? '' : 's'}.`, 'Close', { duration: 3000 });
  }

  deleteSelectedQuestions(): void {
    const selected = this.selectedQuestions();
    if (!selected.length) return;

    this.confirmDialog.ask({
      title: 'Delete selected Mains questions?',
      message: `${selected.length} question${selected.length === 1 ? '' : 's'} will be permanently removed.`
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.loading.set(true);
      forkJoin(selected.map(question => this.questionService.deleteQuestion(question._id))).subscribe({
        next: () => {
          this.clearSelection();
          if (selected.length >= this.questions().length && this.currentPage() > 0) {
            this.currentPage.update(page => page - 1);
          }
          this.snackBar.open(`Deleted ${selected.length} Mains question${selected.length === 1 ? '' : 's'}.`, 'Close', { duration: 3000 });
          this.loadQuestions();
        },
        error: error => {
          console.error('Unable to delete selected Mains questions:', error);
          this.loading.set(false);
          this.snackBar.open(error.error?.message || 'Unable to delete selected Mains questions.', 'Close', { duration: 3000 });
        }
      });
    });
  }

  deleteAllQuestions(): void {
    this.confirmDialog.ask({
      title: 'Delete all Mains questions?',
      message: 'This permanently deletes every Mains question, including questions outside the current search or tag filter. This action cannot be undone.',
      confirmText: 'Delete All',
      icon: 'delete_forever'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.loading.set(true);
      this.questionService.deleteAllQuestions().subscribe({
        next: response => {
          this.currentPage.set(0);
          this.clearSelection();
          this.snackBar.open(response.message, 'Close', { duration: 5000 });
          this.loadQuestions();
        },
        error: error => {
          console.error('Unable to delete all Mains questions:', error);
          this.loading.set(false);
          this.snackBar.open(error.error?.message || 'Unable to delete all Mains questions.', 'Close', { duration: 4000 });
        }
      });
    });
  }

  openBulkTagDialog(): void {
    if (!this.selectedQuestions().length) return;
    this.selectedTags = [];
    this.replaceExistingTags = false;
    this.bulkTagDialogRef = this.dialog.open(this.bulkTagDialogTemplate, {
      width: '500px',
      maxWidth: '90vw',
      autoFocus: false
    });
  }

  closeBulkTagDialog(): void {
    this.bulkTagDialogRef?.close();
  }

  applyBulkTags(): void {
    const selected = this.selectedQuestions();
    if (!selected.length || !this.selectedTags.length || this.bulkTagLoading) return;

    this.bulkTagLoading = true;
    const updates = selected.map(question => {
      const existingTags = question.tags.map(tag => tag._id);
      const tags = this.replaceExistingTags
        ? [...this.selectedTags]
        : [...new Set([...existingTags, ...this.selectedTags])];
      return this.questionService.updateQuestion(question._id, {
        question: question.question,
        tags
      });
    });

    forkJoin(updates).subscribe({
      next: () => {
        this.bulkTagLoading = false;
        this.closeBulkTagDialog();
        this.snackBar.open(`Updated tags for ${selected.length} Mains question${selected.length === 1 ? '' : 's'}.`, 'Close', { duration: 3000 });
        this.loadQuestions();
      },
      error: error => {
        console.error('Unable to update tags for selected Mains questions:', error);
        this.bulkTagLoading = false;
        this.snackBar.open(error.error?.message || 'Unable to update tags for selected questions.', 'Close', { duration: 3000 });
      }
    });
  }

  private copyUIDs(uids: string[]): void {
    if (!uids.length) {
      this.snackBar.open('No UIDs to copy', 'Close', { duration: 3000 });
      return;
    }

    const copied = this.clipboard.copy(uids.join(',\n'));
    this.snackBar.open(
      copied
        ? `${uids.length} UID${uids.length === 1 ? '' : 's'} copied to clipboard!`
        : 'Unable to copy UIDs',
      'Close',
      { duration: 3000, panelClass: [copied ? 'success-snackbar' : 'error-snackbar'] }
    );
  }

  openQuestionDialog(question: MainsQuestion | null = null): void {
    if (!this.tags().length) {
      this.tagService.getTags('mains').subscribe({
        next: tags => {
          this.tags.set(tags);
          this.showQuestionDialog(question);
        },
        error: error => {
          console.error('Unable to load Mains tags for question editor:', error);
          this.snackBar.open('Unable to load Mains tags.', 'Close', { duration: 3000 });
        }
      });
      return;
    }
    this.showQuestionDialog(question);
  }

  private showQuestionDialog(question: MainsQuestion | null): void {
    const dialogRef = this.dialog.open(MainsQuestionDialogComponent, {
      width: 'min(900px, 94vw)',
      maxHeight: '92vh',
      autoFocus: false,
      data: { question, tags: this.tags() }
    });
    dialogRef.afterClosed().subscribe(saved => {
      if (saved) {
        this.snackBar.open(question ? 'Mains question updated.' : 'Mains question added.', 'Close', { duration: 3000 });
        this.loadQuestions();
      }
    });
  }

  openViewDialog(question: MainsQuestion): void {
    this.selectedQuestion = question;
    this.viewDialogRef = this.dialog.open(this.viewQuestionTemplate, {
      width: 'min(900px, 92vw)',
      maxHeight: '90vh',
      autoFocus: false
    });
    this.viewDialogRef.afterClosed().subscribe(() => {
      this.selectedQuestion = null;
      this.viewDialogRef = null;
    });
  }

  closeViewDialog(): void {
    this.viewDialogRef?.close();
  }

  deleteQuestion(question: MainsQuestion): void {
    this.confirmDialog.ask({
      title: 'Delete Mains question?',
      message: 'This theory question will be permanently removed.'
    }).subscribe(() => {
      this.questionService.deleteQuestion(question._id).subscribe({
        next: () => {
          this.snackBar.open('Mains question deleted.', 'Close', { duration: 3000 });
          if (this.questions().length === 1 && this.currentPage() > 0) {
            this.currentPage.update(page => page - 1);
          }
          this.loadQuestions();
        },
        error: error => {
          console.error('Unable to delete Mains question:', error);
          this.snackBar.open(error.error?.message || 'Unable to delete Mains question.', 'Close', { duration: 3000 });
        }
      });
    });
  }

  trackQuestion(_index: number, question: MainsQuestion): string {
    return question._id;
  }
}
