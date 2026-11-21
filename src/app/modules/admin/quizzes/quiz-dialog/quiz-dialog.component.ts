import { Component, effect, inject, signal, OnInit, Input, Output, EventEmitter, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { QuizService } from '../../../../shared/services/quiz.service';
import { QuestionService } from '../../../../shared/services/question.service';
import { DemoTestService } from '../../../../shared/services/demo-test.service';
import { PrelimsTSService } from '../../../../shared/services/prelims-ts.service';
import { QbankQuestion, QuestionBankSuiteStateService } from '../../question-bank-suite/question-bank-suite-state.service';
import { FormsModule } from '@angular/forms';

interface Question {
  _id: string;
  uid: string;
  question: {
    english: string;
    hindi: string;
    _id?: string;
  };
  options: Array<{
    english: string;
    hindi: string;
    _id?: string;
  }>;
  correctAnswer: number;
  description?: {
    english: string;
    hindi: string;
  };
  tags: any[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  source?: string;
  exam?: string;
  subject?: string;
}

interface Tag {
  _id: string;
  tag: string;
  types?: string;
  questionCount: number;
}

@Component({
  selector: 'app-quiz-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatCheckboxModule
  ],
  templateUrl: './quiz-dialog.component.html',
  styleUrl: './quiz-dialog.component.css'
})
export class QuizDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private quizService = inject(QuizService);
  private questionService = inject(QuestionService);
  private demoTestService = inject(DemoTestService);
  private prelimsTestService = inject(PrelimsTSService);
  readonly questionBank = inject(QuestionBankSuiteStateService);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<QuizDialogComponent>, { optional: true });
  private data = inject(MAT_DIALOG_DATA, { optional: true });

  @Input() quiz: any = null;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  quizForm: FormGroup;
  isEdit = signal(false);
  loading = signal(false);
  questionsLoading = signal(false);
  
  // Questions from API
  allQuestions = signal<Question[]>([]);
  filteredQuestions = signal<Question[]>([]);
  private legacyQuestions = signal<Question[]>([]);
  private legacyQuestionsLoaded = signal(false);
  private editQuestionsHydrated = false;
  
  // Tags
  tags = signal<Tag[]>([]);
  tagsLoading = signal(false);
  currentFilterTag = signal<string | null>(null);
  showTagFilter = signal(false);
  
  // Add by UID functionality
  showAddByUid = signal(false);
  uidTextareaValue = signal('');
  uidProcessingStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Add by Type functionality
  showAddByType = signal(false);
  selectedQuestionType = signal('');
  
  // Question selection
  selectedQuestions = signal<Question[]>([]);
  temporarilySelectedUids = signal<string[]>([]);
  usageByQuestion = signal<Map<string, string[]>>(new Map());
  questionPickerSearch = '';

  constructor() {
    this.quizForm = this.createQuizForm();
    effect(() => {
      const state = this.questionBank.state();
      const bankLoading = this.questionBank.loading();
      const questions = new Map<string, Question>();
      (state?.questions || [])
        .filter(question => question.kind === 'PRELIMS')
        .forEach(question => {
          if (!questions.has(question.id)) {
            questions.set(question.id, this.mapQbankQuestion(question));
          }
        });

      const mergedQuestions = [...questions.values()];
      this.allQuestions.set(mergedQuestions);
      this.filteredQuestions.set(mergedQuestions);
      this.questionsLoading.set(bankLoading);
      untracked(() => this.mergeQbankTestUsage());

      if (this.isEdit() && this.quiz && !bankLoading && !this.editQuestionsHydrated) {
        this.populateForm(this.quiz);
        this.editQuestionsHydrated = true;
      }
    });
  }

  createQuizForm(): FormGroup {
    return this.fb.group({
      title: ['', Validators.required],
      description: [''],
      isActive: [true, Validators.required],
      questionUids: [[], Validators.minLength(1)]
    });
  }

  ngOnInit() {
    this.quiz = this.quiz || this.data?.quiz || null;
    this.isEdit.set(!!this.quiz);
    this.questionBank.initialize();
    this.loadTags();
    this.loadUsageSources();
  }

  private mergeUsage(questionIds: unknown, label: string): void {
    if (!Array.isArray(questionIds) || !label) return;
    const usage = new Map(this.usageByQuestion());
    for (const uid of questionIds) {
      if (typeof uid !== 'string') continue;
      const labels = usage.get(uid) || [];
      if (!labels.includes(label)) labels.push(label);
      usage.set(uid, labels);
    }
    this.usageByQuestion.set(usage);
  }

  private mergeQbankTestUsage(): void {
    for (const test of this.questionBank.tests()) {
      if (test.status === 'draft') continue;
      const label = `Prelims Test: ${test.title || test.exam || test.id}`;
      this.mergeUsage(test.questionIds, label);
    }
  }

  private loadUsageSources(): void {
    this.quizService.getAllQuizzes().subscribe({
      next: (quizzes: any[]) => quizzes.forEach(quiz =>
        this.mergeUsage(quiz.questionUids, `Quiz: ${quiz.title || quiz._id}`))
    });
    this.demoTestService.getDemoTests().subscribe({
      next: (tests: any[]) => tests.forEach(test =>
        this.mergeUsage(test.questionUids, `Demo Test: ${test.title || test._id}`))
    });
    this.prelimsTestService.getAllTestSeries({ page: 1, limit: 500 }).subscribe({
      next: (response) => response.data.forEach(series => {
        for (const testDate of series.testDates || []) {
          const exam = testDate.exam as any;
          const examTitle = exam?.title || exam?.name || series.name;
          this.mergeUsage(exam?.questionUids, `Prelims: ${examTitle}`);
        }
      })
    });
  }

  getQuestionUsageLabels(question: Question): string[] {
    return this.usageByQuestion().get(question.uid) || [];
  }

  pickerQuestions(): Question[] {
    const search = this.questionPickerSearch.trim().toLowerCase();
    return this.filteredQuestions().filter(question => {
      if (!search) return true;
      const haystack = [
        question.question.english,
        question.question.hindi,
        question.exam,
        question.subject,
        this.getQuestionTags(question),
        ...question.tags
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }

  isQuestionInQuiz(uid: string): boolean {
    return this.selectedQuestions().some(question => question.uid === uid);
  }

  toggleQuestionForQuiz(uid: string, checked: boolean): void {
    const selected = [...this.selectedQuestions()];
    if (checked) {
      if (!selected.some(question => question.uid === uid)) {
        const question = this.allQuestions().find(item => item.uid === uid);
        if (question) selected.push(question);
      }
    } else {
      const index = selected.findIndex(question => question.uid === uid);
      if (index >= 0) selected.splice(index, 1);
    }
    this.selectedQuestions.set(selected);
  }

  private mapQbankQuestion(question: QbankQuestion): Question {
    return {
      _id: question.id,
      uid: question.id,
      question: {
        english: question.en,
        hindi: question.hi || ''
      },
      options: (question.options || []).map((english, index) => ({
        english,
        hindi: question.optionsHi?.[index] || ''
      })),
      correctAnswer: 'ABCD'.indexOf(question.correct || ''),
      description: undefined,
      tags: question.tags || [],
      isActive: !question.deleted,
      source: 'Prelims Test',
      exam: question.exam,
      subject: question.subject
    };
  }

  loadAvailableQuestions(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.questionsLoading.set(true);
      this.questionService.getAllQuestions().subscribe({
        next: (response: any) => {
          const questions: Question[] = (response.questions || []).map((q: any) => ({
            _id: q._id,
            uid: q.uid,
            question: {
              english: q.question?.english || '',
              hindi: q.question?.hindi || '',
              _id: q.question?._id
            },
            options: q.options || [],
            correctAnswer: q.correctAnswer,
            description: q.description,
            tags: q.tags || [],
            isActive: q.isActive !== undefined ? q.isActive : true,
            createdAt: q.createdAt,
            updatedAt: q.updatedAt
          }));
          
          this.legacyQuestions.set(questions);
          this.legacyQuestionsLoaded.set(true);
          resolve();
        },
        error: (error: any) => {
          console.error('Error loading questions:', error);
          this.snackBar.open('Error loading questions', 'Close', { duration: 3000 });
          this.legacyQuestionsLoaded.set(true);
          resolve();
        }
      });
    });
  }

  populateForm(quiz: any) {
    this.quizForm.patchValue({
      title: quiz.title,
      description: quiz.description,
      isActive: quiz.isActive
    });

    const questionUids = quiz.questionUids || [];
    this.setSelectedQuestionsFromUids(questionUids);
  }

  setSelectedQuestionsFromUids(questionUids: string[]) {
    if (questionUids.length > 0) {
      const allQuestions = this.allQuestions();
      const selectedQuestions = allQuestions.filter(q => questionUids.includes(q.uid));
      this.selectedQuestions.set(selectedQuestions);
      this.temporarilySelectedUids.set([...questionUids]);
      this.updateQuestionUidsFormControl();
    } else {
      this.selectedQuestions.set([]);
      this.temporarilySelectedUids.set([]);
      this.updateQuestionUidsFormControl();
    }
  }

  loadTags() {
    this.tagsLoading.set(true);
    this.questionService.getTags().subscribe({
      next: (response: any) => {
        const tagRows = Array.isArray(response) ? response : (response?.data || []);
        const tags: Tag[] = tagRows.map((tag: any) => ({
          _id: tag._id,
          tag: tag.tag,
          types: tag.types || '',
          questionCount: 0
        }));
        this.calculateTagQuestionCounts(tags);
        this.tags.set(tags);
        this.tagsLoading.set(false);
      },
      error: (error: any) => {
        console.error('Error loading tags:', error);
        this.tagsLoading.set(false);
      }
    });
  }

  calculateTagQuestionCounts(tags: Tag[]) {
    const allQuestions = this.allQuestions();
    tags.forEach(tag => {
      const count = allQuestions.filter(q => 
        q.tags && Array.isArray(q.tags) && 
        q.tags.some((t: any) => {
          if (typeof t === 'object') {
            return String(t._id || '') === String(tag._id) || t.tag === tag.tag;
          }
          return String(t) === String(tag._id);
        })
      ).length;
      tag.questionCount = count;
    });
    const noneQuestions = allQuestions.filter(q => !q.tags || q.tags.length === 0);
    if (noneQuestions.length > 0) {
      tags.push({ _id: 'none', tag: 'None', questionCount: noneQuestions.length });
    }
  }

  // Filter by Tag functionality
  toggleTagFilter() {
    this.showTagFilter.set(!this.showTagFilter());
  }

  applyTagFilter(tag: Tag) {
    this.currentFilterTag.set(tag.tag);
    this.showTagFilter.set(false);
    const allQuestions = this.allQuestions();
    let filtered: Question[];
    
    if (tag._id === 'none') {
      filtered = allQuestions.filter(q => !q.tags || q.tags.length === 0);
    } else {
      filtered = allQuestions.filter(q => 
        q.tags && Array.isArray(q.tags) && 
        q.tags.some((t: any) => {
          if (typeof t === 'object') {
            return String(t._id || '') === String(tag._id) || t.tag === tag.tag;
          }
          return String(t) === String(tag._id);
        })
      );
    }
    
    this.filteredQuestions.set(filtered);
    this.snackBar.open(`Filtered by tag: ${tag.tag} (${filtered.length} questions)`, 'Close', { duration: 3000 });
  }

  clearTagFilter() {
    this.currentFilterTag.set(null);
    this.showTagFilter.set(false);
    this.filteredQuestions.set(this.allQuestions());
    this.snackBar.open('Tag filter cleared', 'Close', { duration: 2000 });
  }

  getQuestionTags(question: Question): string {
    if (!question.tags || question.tags.length === 0) return 'None';
    if (question.source === 'Prelims Test') {
      return question.tags
        .map((tag: any) => typeof tag === 'string' ? tag : (tag?.tag || ''))
        .filter(tagName => !!tagName)
        .join(', ') || 'None';
    }

    const tagNames = question.tags
      .map((tag: any) => {
        if (typeof tag === 'object') return tag.tag;
        // If it's just an ID, find the tag in our tags list
        const foundTag = this.tags().find(t => t._id === tag);
        return foundTag ? foundTag.tag : 'Unknown';
      })
      .filter(tagName => tagName !== 'Unknown');
    
    return tagNames.length > 0 ? tagNames.join(', ') : 'None';
  }

  // Available questions for display
  availableQuestions(): Question[] {
    return this.pickerQuestions().filter(question =>
      question.source !== 'Prelims Test' || question.isActive || this.isQuestionInQuiz(question.uid)
    );
  }

  // Add by UID functionality
  toggleAddByUid() {
    this.showAddByUid.set(!this.showAddByUid());
    if (this.showAddByUid()) this.showAddByType.set(false);
    if (!this.showAddByUid()) {
      this.uidTextareaValue.set('');
    }
  }

  questionTypes(): string[] {
    return [...new Set(
      this.tags()
        .map(tag => String(tag.types || '').trim())
        .filter(type => type.length > 0)
    )].sort((a, b) => a.localeCompare(b));
  }

  toggleAddByType() {
    this.showAddByType.set(!this.showAddByType());
    if (this.showAddByType()) this.showAddByUid.set(false);
    if (!this.showAddByType()) this.selectedQuestionType.set('');
  }

  getQuestionCountByType(): number {
    const type = this.selectedQuestionType();
    if (!type) return 0;
    return this.getQuestionsByType(type).length;
  }

  getQuestionsByType(type: string): Question[] {
    return this.allQuestions().filter(question =>
      question.tags && question.tags.some((tagRef: any) => {
        if (typeof tagRef === 'object') {
          const objectType = String(tagRef.types || '').trim();
          if (objectType) return objectType === type;
        }

        const tagId = typeof tagRef === 'object'
          ? String(tagRef._id || '')
          : String(tagRef || '');
        const tagName = typeof tagRef === 'object' ? String(tagRef.tag || '') : '';
        const matchedTag = this.tags().find(tag =>
          String(tag._id) === tagId || (!!tagName && tag.tag === tagName)
        );
        return matchedTag?.types === type;
      })
    );
  }

  processQuestionsByType() {
    const type = this.selectedQuestionType();
    if (!type) return;

    const matchingQuestions = this.getQuestionsByType(type);
    const existingUids = new Set(this.selectedQuestions().map(question => question.uid));
    const newQuestions = matchingQuestions.filter(question => !existingUids.has(question.uid));

    this.selectedQuestions.set([...this.selectedQuestions(), ...newQuestions]);
    this.updateQuestionUidsFormControl();
    this.snackBar.open(
      `Added ${newQuestions.length} question(s) for type: ${type}`,
      'Close',
      { duration: 4000 }
    );

    if (newQuestions.length === 0) {
      return;
    }
    this.toggleAddByType();
  }

  onUidTextareaChange(event: Event) {
    const value = (event.target as HTMLTextAreaElement).value;
    this.uidTextareaValue.set(value);
  }

  async processUids() {
    const textareaValue = this.uidTextareaValue().trim();
    
    if (!textareaValue) {
      this.snackBar.open('Please enter at least one UID', 'Close', { duration: 2000 });
      return;
    }
    
    const uids = textareaValue
      .split(/[\n,]+/)
      .map(uid => uid.trim())
      .filter(uid => uid.length > 0);
    
    if (uids.length === 0) {
      this.snackBar.open('No valid UIDs found', 'Close', { duration: 2000 });
      return;
    }
    
    this.uidProcessingStatus.set('loading');
    
    try {
      const allQuestions = this.allQuestions();
      const foundQuestions: Question[] = [];
      const notFoundUids: string[] = [];
      const duplicateUids: string[] = [];
      const currentSelectedUids = this.selectedQuestions().map(q => q.uid);
      
      uids.forEach(uid => {
        const question = allQuestions.find(q => q.uid === uid);
        if (question) {
          if (currentSelectedUids.includes(uid)) {
            duplicateUids.push(uid);
          } else {
            foundQuestions.push(question);
          }
        } else {
          notFoundUids.push(uid);
        }
      });
      
      let message = '';
      
      if (foundQuestions.length > 0) {
        const updatedQuestions = [...this.selectedQuestions(), ...foundQuestions];
        this.selectedQuestions.set(updatedQuestions);
        this.updateQuestionUidsFormControl();
        message += `Added ${foundQuestions.length} question(s) to quiz. `;
      }
      
      if (duplicateUids.length > 0) {
        message += `${duplicateUids.length} question(s) already exist in quiz. `;
      }
      
      if (notFoundUids.length > 0) {
        message += `${notFoundUids.length} UID(s) not found.`;
      }
      
      if (foundQuestions.length === 0 && duplicateUids.length === 0 && notFoundUids.length > 0) {
        message = 'No valid questions found. Check the UIDs and try again.';
      }
      
      this.snackBar.open(message, 'Close', { duration: 5000 });
      
      // Clear and close
      setTimeout(() => {
        this.showAddByUid.set(false);
        this.uidTextareaValue.set('');
        this.uidProcessingStatus.set('idle');
      }, 1000);
      
    } catch (error) {
      console.error('Error processing UIDs:', error);
      this.snackBar.open('Error processing UIDs', 'Close', { duration: 3000 });
      this.uidProcessingStatus.set('idle');
    }
  }

  getUidCount(): number {
    const textareaValue = this.uidTextareaValue().trim();
    if (!textareaValue) return 0;
    return textareaValue
      .split(/[\n,]+/)
      .map(uid => uid.trim())
      .filter(uid => uid.length > 0)
      .length;
  }

  clearUids() {
    this.uidTextareaValue.set('');
    this.uidProcessingStatus.set('idle');
  }

  onSelectionChange(selectedUids: string[]) {
    this.temporarilySelectedUids.set([...new Set(selectedUids || [])]);
  }

  isAllFilteredSelected(): boolean {
    const availableQuestions = this.availableQuestions();
    if (availableQuestions.length === 0) return false;
    return availableQuestions.every(question => this.isQuestionInQuiz(question.uid));
  }

  toggleSelectAll() {
    const availableQuestions = this.availableQuestions();
    if (availableQuestions.length === 0) return;

    if (this.isAllFilteredSelected()) {
      const availableUids = new Set(availableQuestions.map(question => question.uid));
      this.selectedQuestions.set(this.selectedQuestions().filter(question => !availableUids.has(question.uid)));
    } else {
      const selectedUids = new Set(this.selectedQuestions().map(question => question.uid));
      const newQuestions = availableQuestions.filter(question => !selectedUids.has(question.uid));
      this.selectedQuestions.set([...this.selectedQuestions(), ...newQuestions]);
    }
    this.updateQuestionUidsFormControl();
  }

  addSelectedToQuiz() {
    const tempSelectedUids = this.temporarilySelectedUids();
    
    if (tempSelectedUids.length === 0) {
      this.snackBar.open('No questions selected', 'Close', { duration: 2000 });
      return;
    }
    
    const allQuestions = this.allQuestions();
    const currentSelectedUids = this.selectedQuestions().map(q => q.uid);
    
    const newQuestions = allQuestions.filter(q => 
      tempSelectedUids.includes(q.uid) && !currentSelectedUids.includes(q.uid)
    );
    
    const duplicateCount = tempSelectedUids.filter(uid => currentSelectedUids.includes(uid)).length;
    
    if (newQuestions.length > 0) {
      const updatedQuestions = [...this.selectedQuestions(), ...newQuestions];
      this.selectedQuestions.set(updatedQuestions);
      this.updateQuestionUidsFormControl();
      
      let message = `Added ${newQuestions.length} question(s) to quiz`;
      if (duplicateCount > 0) {
        message += ` (${duplicateCount} already in quiz)`;
      }
      
      this.snackBar.open(message, 'Close', { duration: 3000 });
      this.temporarilySelectedUids.set([]);
    } else if (duplicateCount > 0) {
      this.snackBar.open(`All selected questions already exist in quiz`, 'Close', { duration: 3000 });
    }
  }

  clearAll() {
    this.selectedQuestions.set([]);
    this.temporarilySelectedUids.set([]);
    this.updateQuestionUidsFormControl();
    this.snackBar.open('All questions removed from quiz', 'Close', { duration: 2000 });
  }

  removeQuestion(index: number) {
    const currentSelectedQuestions = [...this.selectedQuestions()];
    const questionToRemove = currentSelectedQuestions[index];
    
    currentSelectedQuestions.splice(index, 1);
    this.selectedQuestions.set(currentSelectedQuestions);
    
    const currentTempUids = this.temporarilySelectedUids();
    const updatedTempUids = currentTempUids.filter(uid => uid !== questionToRemove.uid);
    this.temporarilySelectedUids.set(updatedTempUids);
    
    this.updateQuestionUidsFormControl();
    this.snackBar.open('Question removed from quiz', 'Close', { duration: 2000 });
  }

  getQuestionDisplayText(question: Question): string {
    const english = question.question.english || '';
    const hindi = question.question.hindi || '';
    return `<strong>English:</strong> ${english}${hindi ? `<br><strong>Hindi:</strong> ${hindi}` : ''}`;
  }

  getOptionLetter(index: number): string {
    return index >= 0 && index < 26 ? String.fromCharCode(65 + index) : '?';
  }

  isQuestionSelected(uid: string): boolean {
    return this.temporarilySelectedUids().includes(uid) || 
           this.selectedQuestions().some(q => q.uid === uid);
  }

  updateQuestionUidsFormControl() {
    const questionUids = this.selectedQuestions().map(q => q.uid);
    this.quizForm.patchValue({ questionUids });
  }

  onSubmit() {
    this.quizForm.markAllAsTouched();

    if (this.quizForm.valid && this.selectedQuestions().length > 0) {
      this.loading.set(true);
      
      const formValue = this.quizForm.value;
      const quizData = {
        title: formValue.title,
        description: formValue.description,
        isActive: formValue.isActive,
        questionUids: this.selectedQuestions().map(q => q.uid)
      };

        const operation = this.isEdit()
          ? this.quizService.updateQuiz(this.quiz._id, quizData)
        : this.quizService.createQuiz(quizData);

      operation.subscribe({
        next: () => {
          this.snackBar.open(`Quiz ${this.isEdit() ? 'updated' : 'created'} successfully`, 'Close', { duration: 3000 });
          if (this.dialogRef) this.dialogRef.close(true);
          this.saved.emit();
        },
        error: (error: any) => {
          this.loading.set(false);
          console.error('Error:', error);
          this.snackBar.open(`Error ${this.isEdit() ? 'updating' : 'creating'} quiz: ${error.error?.message || 'Unknown error'}`, 'Close', { duration: 3000 });
        },
        complete: () => {
          this.loading.set(false);
        }
      });
    } else if (this.selectedQuestions().length === 0) {
      this.snackBar.open('Please add at least one question to the quiz', 'Close', { duration: 3000 });
    } else {
      this.snackBar.open('Please fill all required fields', 'Close', { duration: 3000 });
    }
  }

  onCancel() {
    if (this.dialogRef) this.dialogRef.close(false);
    this.cancelled.emit();
  }
}