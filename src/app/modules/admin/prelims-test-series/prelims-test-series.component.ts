import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import { LanguageService } from '../../../shared/i18n/language.service';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, forkJoin, from, map, mergeMap, of, toArray } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { richTextMinLength, richTextRequired } from '../../../shared/forms/rich-text-validators';
import { PrelimsTSService, PrelimsTestSeries, TestDate } from '../../../shared/services/prelims-ts.service';
import { QbankQuestion, QuestionBankSuiteStateService } from '../question-bank-suite/question-bank-suite-state.service';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { ReopenExamDialogComponent } from '../../tests/reopen-exam-dialog/reopen-exam-dialog.component';

@Component({
  selector: 'app-prelims-test-series',
  standalone: true,
  imports: [TranslatePipe, 
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule,
    MatTooltipModule,
    CKEditorModule
  ],
  templateUrl: './prelims-test-series.component.html',
  styleUrls: ['./prelims-test-series.component.css']
})
export class PrelimsTestSeriesComponent implements OnInit {
  readonly Editor = ClassicEditor;
  readonly editorConfig = {
    toolbar: [
      'heading', '|', 'bold', 'italic', '|',
      'bulletedList', 'numberedList', '|',
      'insertTable', 'blockQuote', '|', 'undo', 'redo'
    ],
    table: {
      contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
    }
  };

  readonly language = inject(LanguageService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private confirmDialog = inject(ConfirmDialogService);
  private prelimsTSService = inject(PrelimsTSService);
  readonly questionBank = inject(QuestionBankSuiteStateService);

  // Main data
  testSeries = signal<PrelimsTestSeries[]>([]);
  filteredTestSeries = signal<PrelimsTestSeries[]>([]);
  loading = signal(false);
  isFormVisible = signal(false);
  isEditMode = signal(false);
  editingId = signal<string | null>(null);
  submitting = signal(false);

  // Search and filter
  searchTerm = '';
  statusFilter = 'all';

  // Pagination
  currentPage = 1;
  totalItems = 0;
  itemsPerPage = 50;

  // Form
  testSeriesForm!: FormGroup;
  seriesQuestionSearch = '';
  selectedSeriesQuestionIds: string[] = [];
  readonly questionUsage = computed(() => {
    const usage = new Map<string, string[]>();
    const merge = (questionIds: unknown, label: string) => {
      if (!Array.isArray(questionIds) || !label) return;
      for (const questionId of questionIds) {
        if (typeof questionId !== 'string') continue;
        const labels = usage.get(questionId) || [];
        if (!labels.includes(label)) labels.push(label);
        usage.set(questionId, labels);
      }
    };

    for (const test of this.questionBank.tests()) {
      if (test.kind !== 'PRELIMS' || test.status === 'draft') continue;
      merge(test.questionIds, `Test: ${test.title || test.exam || test.id}`);
    }

    for (const series of this.testSeries()) {
      for (const testDate of series.testDates || []) {
        const exam = testDate.exam;
        merge(
          exam?.questionUids,
          `Test Series: ${series.name || 'Test Series'}`
        );
      }
    }
    return usage;
  });

  ngOnInit() {
    this.initForm();
    this.questionBank.initialize();
    this.loadTestSeries();
  }

  initForm() {
    this.testSeriesForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      nameHi: [''],
      description: ['', [richTextRequired, richTextMinLength(10)]],
      descriptionHi: [''],
      intro: [''], introHi: [''],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]],
      testDates: this.fb.array([], [Validators.required, Validators.minLength(1)]),
      isActive: [true]
    }, { validators: this.dateRangeValidator });
  }

  dateRangeValidator(group: AbstractControl): ValidationErrors | null {
    const startDate = group.get('startDate')?.value;
    const endDate = group.get('endDate')?.value;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        return { invalidDateRange: true };
      }
    }
    return null;
  }

  get testDatesArray(): FormArray {
    return this.testSeriesForm.get('testDates') as FormArray;
  }

  get testDatesCount(): number {
    return this.testDatesArray.length;
  }

  get testDateControls(): AbstractControl[] {
    return this.testDatesArray.controls;
  }

  loadTestSeries() {
    this.loading.set(true);
    
    const params: any = {
      page: this.currentPage,
      limit: this.itemsPerPage
    };

    if (this.searchTerm) {
      params.search = this.searchTerm;
    }

    if (this.statusFilter !== 'all') {
      params.isActive = this.statusFilter === 'active';
    }

    this.prelimsTSService.getAllTestSeries(params).subscribe({
      next: (response) => {
        this.testSeries.set(response.data);
        this.filteredTestSeries.set(response.data);
        this.totalItems = response.pagination.totalItems;
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading test series:', error);
        this.snackBar.open('Error loading test series', 'Close', { duration: 3000 });
        this.loading.set(false);
      }
    });
  }

  filterTestSeries() {
    let filtered = [...this.testSeries()];
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(series => 
        series.name?.toLowerCase().includes(term) ||
        series.nameHi?.toLowerCase().includes(term) ||
        series.description?.toLowerCase().includes(term) ||
        series.descriptionHi?.toLowerCase().includes(term)
      );
    }
    
    if (this.statusFilter !== 'all') {
      const isActive = this.statusFilter === 'active';
      filtered = filtered.filter(series => series.isActive === isActive);
    }
    
    this.filteredTestSeries.set(filtered);
  }

  // Form Actions
  showCreateForm() {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.resetForm();
    this.isFormVisible.set(true);
    // Add one empty test date
    this.addTestDate();
    setTimeout(() => {
      document.querySelector('.form-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  showEditForm(series: PrelimsTestSeries) {
    this.isEditMode.set(true);
    this.editingId.set(series._id || null);
    this.patchFormData(series);
    this.isFormVisible.set(true);
    setTimeout(() => {
      document.querySelector('.form-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  hideForm() {
    this.isFormVisible.set(false);
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.resetForm();
  }

  resetForm() {
    this.testSeriesForm.reset({
      name: '',
      nameHi: '',
      description: '',
      descriptionHi: '',
      intro: '', introHi: '',
      startDate: '',
      endDate: '',
      isActive: true
    });
    while (this.testDatesArray.length) {
      this.testDatesArray.removeAt(0);
    }
    this.seriesQuestionSearch = '';
    this.selectedSeriesQuestionIds = [];
  }

  patchFormData(series: PrelimsTestSeries) {
    this.testSeriesForm.patchValue({
      name: series.name,
      nameHi: series.nameHi || '',
      description: series.description,
      descriptionHi: series.descriptionHi || '',
      intro: series.intro || '', introHi: series.introHi || '',
      startDate: series.startDate,
      endDate: series.endDate,
      isActive: series.isActive
    });
    this.selectedSeriesQuestionIds = [...new Set(
      (series.testDates || []).flatMap(testDate =>
        Array.isArray(testDate.exam?.questionUids)
          ? testDate.exam.questionUids.filter((id: unknown): id is string => typeof id === 'string')
          : []
      )
    )];

    while (this.testDatesArray.length) {
      this.testDatesArray.removeAt(0);
    }
    
    if (series.testDates && series.testDates.length > 0) {
      series.testDates.forEach(testDate => {
        this.addTestDate(testDate);
      });
    }
  }

  addTestDate(testDate?: TestDate) {
    const dateGroup = this.fb.group({
      date: [testDate?.date || '', Validators.required],
      time: [testDate?.time || '09:00'],
      duration: [testDate?.duration || 120, [Validators.required, Validators.min(30)]]
    });
    this.testDatesArray.push(dateGroup);
  }

  openTimePicker(input: HTMLInputElement): void {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.focus();
  }

  removeTestDate(index: number) {
    if (this.testDatesArray.length <= 1) {
      this.snackBar.open('You need at least one test date', 'Close', { duration: 3000 });
      return;
    }
    this.testDatesArray.removeAt(index);
  }

  clearAllTestDates() {
    if (this.testDatesArray.length === 0) return;
    if (confirm('Are you sure you want to remove all test dates?')) {
      while (this.testDatesArray.length) {
        this.testDatesArray.removeAt(0);
      }
      this.addTestDate();
    }
  }

  onStartDateChange() {
    this.testSeriesForm.get('endDate')?.updateValueAndValidity();
  }

  getMinDateForTestDates(): Date {
    const startDate = this.testSeriesForm.get('startDate')?.value;
    if (startDate) {
      return new Date(startDate);
    }
    return new Date();
  }

  getMaxDateForTestDates(): Date {
    const endDate = this.testSeriesForm.get('endDate')?.value;
    if (endDate) {
      return new Date(endDate);
    }
    const max = new Date();
    max.setFullYear(max.getFullYear() + 1);
    return max;
  }

  addAllDatesBetweenRange() {
    const startDate = this.testSeriesForm.get('startDate')?.value;
    const endDate = this.testSeriesForm.get('endDate')?.value;
    
    if (!startDate || !endDate) {
      this.snackBar.open('Please select start and end dates first', 'Close', { duration: 3000 });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
      this.snackBar.open('End date must be after start date', 'Close', { duration: 3000 });
      return;
    }

    while (this.testDatesArray.length) {
      this.testDatesArray.removeAt(0);
    }

    let currentDate = new Date(start);
    let count = 0;
    while (currentDate <= end) {
      this.addTestDate({
        date: new Date(currentDate),
        time: '09:00',
        duration: 120
      });
      count++;
      currentDate.setDate(currentDate.getDate() + 7);
    }

    this.snackBar.open(`${count} test dates added successfully!`, 'Close', { duration: 3000 });
  }

  addWeeklyTestDates() {
    const startDate = this.testSeriesForm.get('startDate')?.value;
    const endDate = this.testSeriesForm.get('endDate')?.value;
    
    if (!startDate || !endDate) {
      this.snackBar.open('Please select start and end dates first', 'Close', { duration: 3000 });
      return;
    }

    const dayOfWeek = prompt('Enter day of week (0=Sunday, 1=Monday, ..., 6=Saturday):', '0');
    if (dayOfWeek === null) return;
    
    const day = parseInt(dayOfWeek);
    if (isNaN(day) || day < 0 || day > 6) {
      this.snackBar.open('Invalid day. Please enter a number between 0 and 6.', 'Close', { duration: 3000 });
      return;
    }

    while (this.testDatesArray.length) {
      this.testDatesArray.removeAt(0);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    let currentDate = new Date(start);
    
    while (currentDate.getDay() !== day) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    let count = 0;
    while (currentDate <= end) {
      this.addTestDate({
        date: new Date(currentDate),
        time: '09:00',
        duration: 120
      });
      count++;
      currentDate.setDate(currentDate.getDate() + 7);
    }

    if (count === 0) {
      this.snackBar.open('No dates found for the selected day in the range', 'Close', { duration: 3000 });
    } else {
      this.snackBar.open(`${count} weekly test dates added successfully!`, 'Close', { duration: 3000 });
    }
  }

  onSubmit() {
    if (this.testSeriesForm.invalid) {
      this.testSeriesForm.markAllAsTouched();
      this.snackBar.open('Please fix all errors before submitting', 'Close', { duration: 3000 });
      return;
    }

    this.submitting.set(true);
    const formValue = this.testSeriesForm.value;
    
    const testSeriesData: PrelimsTestSeries = {
      name: formValue.name,
      nameHi: formValue.nameHi || '',
      description: formValue.description,
      descriptionHi: formValue.descriptionHi || '',
      intro: formValue.intro || '', introHi: formValue.introHi || '',
      startDate: formValue.startDate,
      endDate: formValue.endDate,
      testDates: formValue.testDates.map((td: any) => ({
        date: td.date,
        time: td.time || '09:00',
        duration: td.duration || 120
      })),
      isActive: formValue.isActive
    };

    const isEditing = this.isEditMode() && this.editingId();
    const saveRequest = isEditing
      ? this.prelimsTSService.updateTestSeries(this.editingId()!, testSeriesData)
      : this.prelimsTSService.createTestSeries(testSeriesData);

    saveRequest.subscribe({
      next: response => {
        if (isEditing) {
          this.saveSharedQuestions(response.data);
          return;
        }

        const createdSeries = response?.data as PrelimsTestSeries | undefined;
        if (!createdSeries?._id) {
          console.error('Test series was created but the response did not include its identifier.', response);
          this.snackBar.open('Test series was created. Refresh and edit it to add questions.', 'Close', { duration: 5000 });
          this.loadTestSeries();
          this.hideForm();
          this.submitting.set(false);
          return;
        }

        this.isEditMode.set(true);
        this.editingId.set(createdSeries._id);
        this.patchFormData(createdSeries);
        this.loadTestSeries();
        this.snackBar.open('Test series created. Select shared questions, then update the series to add them.', 'Close', { duration: 5000 });
        this.submitting.set(false);
      },
      error: error => {
        console.error(`Error ${isEditing ? 'updating' : 'creating'} test series:`, error);
        this.snackBar.open(`Error ${isEditing ? 'updating' : 'creating'} test series`, 'Close', { duration: 3000 });
        this.submitting.set(false);
      }
    });
  }

  seriesQuestions(): QbankQuestion[] {
    const query = this.seriesQuestionSearch.trim().toLowerCase();
    return this.questionBank.questions()
      .filter(question => question.kind === 'PRELIMS')
      .filter(question => {
        if (!query) return true;
        const searchableText = [
          question.en,
          question.hi || '',
          ...(question.options || []),
          ...(question.optionsHi || []),
          question.exam || '',
          question.subject || '',
          ...(question.tags || [])
        ].join(' ').replace(/<[^>]*>/g, ' ').toLowerCase();
        return searchableText.includes(query);
      })
      .sort((left, right) => Number(this.isSeriesQuestionSelected(right.id)) - Number(this.isSeriesQuestionSelected(left.id)));
  }

  isSeriesQuestionSelected(questionId: string): boolean {
    return this.selectedSeriesQuestionIds.includes(questionId);
  }

  toggleSeriesQuestion(questionId: string, checked: boolean): void {
    const selected = new Set(this.selectedSeriesQuestionIds);
    if (checked) selected.add(questionId);
    else selected.delete(questionId);
    this.selectedSeriesQuestionIds = [...selected];
  }

  usedInExams(question: QbankQuestion): string[] {
    const exams: string[] = [];
    for (const test of this.questionBank.tests()) {
      if (test.kind !== 'PRELIMS' || test.status === 'draft') continue;
      if (!test.questionIds.includes(question.id) || !test.exam) continue;
      if (!exams.includes(test.exam)) exams.push(test.exam);
    }
    return exams;
  }

  usedInTests(question: QbankQuestion): string[] {
    return this.questionUsage().get(question.id) || [];
  }

  private saveSharedQuestions(series: PrelimsTestSeries): void {
    const seriesId = series?._id;
    const testDates = series?.testDates || [];
    if (!seriesId || !testDates.length || testDates.some(testDate => !testDate._id)) {
      console.error('Test series was saved without the identifiers needed to assign questions to its dates.', series);
      this.isEditMode.set(true);
      this.editingId.set(seriesId || null);
      this.snackBar.open('Test series was saved, but questions could not be assigned to its dates. Refresh and retry.', 'Close', { duration: 5000 });
      this.submitting.set(false);
      return;
    }

    const questionUids = [...this.selectedSeriesQuestionIds];
    from(testDates).pipe(
      mergeMap(testDate => this.prelimsTSService.saveSlotExam(seriesId, testDate._id!, {
        title: testDate.exam?.title || `${series.name} - ${this.formatDate(testDate.date)}`,
        description: testDate.exam?.description || series.description,
        duration: testDate.duration || testDate.exam?.duration || 120,
        marksPerQuestion: testDate.exam?.marksPerQuestion ?? 2,
        negativeMarks: testDate.exam?.negativeMarks ?? 0.66,
        introPage: testDate.exam?.introPage || '',
        introPageHi: testDate.exam?.introPageHi || '',
        isActive: testDate.exam?.isActive !== false,
        questionUids
      }), 5),
      toArray()
    ).subscribe({
      next: () => {
        this.snackBar.open(`Test series updated successfully with ${questionUids.length} shared question(s)!`, 'Close', { duration: 3000 });
        this.loadTestSeries();
        this.hideForm();
        this.submitting.set(false);
      },
      error: error => {
        console.error('Test series was saved, but shared questions could not be assigned to every date:', error);
        this.isEditMode.set(true);
        this.editingId.set(seriesId);
        this.snackBar.open('Test series was saved, but questions could not be assigned to every date. Update the series to retry.', 'Close', { duration: 5000 });
        this.submitting.set(false);
      }
    });
  }

  // CRUD Operations
  deleteTestSeries(id: string) {
    this.confirmDialog.ask({title: 'Delete test series?', message: 'This action cannot be undone.'}).subscribe(() => {
      this.prelimsTSService.deleteTestSeries(id).subscribe({
        next: () => {
          this.snackBar.open('Test series deleted successfully!', 'Close', { duration: 3000 });
          this.loadTestSeries();
        },
        error: (error) => {
          console.error('Error deleting test series:', error);
          this.snackBar.open('Error deleting test series', 'Close', { duration: 3000 });
        }
      });
    });
  }

  toggleStatus(testSeries: PrelimsTestSeries) {
    const newStatus = !testSeries.isActive;
    const action = newStatus ? 'activate' : 'deactivate';
    
    if (confirm(`Are you sure you want to ${action} this test series?`)) {
      this.prelimsTSService.toggleStatus(testSeries._id!).subscribe({
        next: () => {
          this.snackBar.open(`Test series ${action}d successfully!`, 'Close', { duration: 3000 });
          this.loadTestSeries();
        },
        error: (error) => {
          console.error('Error toggling status:', error);
          this.snackBar.open(`Error ${action}ing test series`, 'Close', { duration: 3000 });
        }
      });
    }
  }

  viewTestSeries(id: string) {
    const series = this.testSeries().find(item => item._id === id);
    if (series) this.showEditForm(series);
  }

  // Helpers
  formatDate(date: Date | string): string {
    if (!date) return '—';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '—';
    }
  }

  formatDateRange(start: Date | string, end: Date | string): string {
    return `${this.formatDate(start)} - ${this.formatDate(end)}`;
  }

  getStatusText(isActive: boolean): string {
    return isActive ? 'Active' : 'Inactive';
  }

  trackByIndex(index: number): number {
    return index;
  }

  slotStart(slot: TestDate) {
    const date = new Date(slot.date);
    const [hours, minutes] = String(slot.time || '09:00').split(':').map(Number);
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date;
  }

  hasReopenableExams(series: PrelimsTestSeries): boolean {
    return this.reopenableExams(series).length > 0;
  }

  openReopenSeries(series: PrelimsTestSeries): void {
    const exams = this.reopenableExams(series);
    if (!series._id || exams.length === 0) {
      this.snackBar.open('There are no created exams to reopen in this test series.', 'Close', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(ReopenExamDialogComponent, {
      width: '480px',
      maxWidth: 'calc(100vw - 32px)',
      panelClass: 'reopen-exam-dialog-panel',
      autoFocus: false,
      data: { testTitle: series.name, seriesWide: true, scheduledExamCount: exams.length }
    });
    dialogRef.afterClosed().subscribe(details => {
      if (!details) return;
      forkJoin(exams.map(exam => this.prelimsTSService
        .reopenExam(series._id!, exam.id, details.email, details.until)
        .pipe(
          map(() => ({ success: true as const, title: exam.title })),
          catchError((error: unknown) => of({ success: false as const, title: exam.title, error }))
        )
      )).subscribe(results => {
        const failed = results.filter(result => !result.success);
        const reopened = results.length - failed.length;
        if (failed.length === 0) {
          this.snackBar.open(`Reopened all ${reopened} scheduled exams for the student.`, 'Close', { duration: 4000 });
          return;
        }
        this.snackBar.open(
          `Reopened ${reopened} of ${results.length} exams. Failed: ${failed.map(result => result.title).join(', ')}.`,
          'Close',
          { duration: 6000 }
        );
      });
    });
  }

  private reopenableExams(series: PrelimsTestSeries): Array<{ id: string; title: string }> {
    const exams = new Map<string, { id: string; title: string }>();
    for (const slot of series.testDates || []) {
      const exam = slot.exam;
      const id = typeof exam?._id === 'string' ? exam._id : '';
      if (!id) continue;
      exams.set(id, {
        id,
        title: typeof exam.title === 'string' && exam.title.trim()
          ? exam.title
          : `${series.name} - ${this.formatDate(slot.date)}`
      });
    }
    return Array.from(exams.values());
  }
}