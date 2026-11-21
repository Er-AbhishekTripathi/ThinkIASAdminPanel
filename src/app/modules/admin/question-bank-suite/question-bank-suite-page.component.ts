import { CommonModule } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { TestService } from '../../../shared/services/test.service';
import { ReopenExamDialogComponent } from '../../tests/reopen-exam-dialog/reopen-exam-dialog.component';
import {
  QbankKind,
  QbankMasters,
  QbankNamedMaster,
  QbankQuestion,
  QbankTag,
  QbankTest,
  QuestionBankSuiteStateService
} from './question-bank-suite-state.service';

type MasterTab = 'exams' | 'subjects' | 'papers' | 'optionals' | 'directives';

interface ParsedImportQuestion {
  number: number;
  language: 'en' | 'hi';
  question: QbankQuestion;
}

interface QuestionUsageSummary {
  total: number;
  fresh: number;
  used: number;
  reused: number;
}

interface QuestionGroupSummary {
  name: string;
  total: number;
  fresh: number;
  used: number;
}

interface TestSeriesContext {
  seriesId: string;
  slotId: string;
  title: string;
  exam: string;
  start: string;
  duration: number;
}

function createQuestion(kind: QbankKind, masters: QbankMasters): QbankQuestion {
  return {
    id: '',
    kind,
    en: '',
    hi: '',
    options: [],
    correct: '',
    exam: masters.exams[0] || '',
    subject: masters.subjects[0] || '',
    source: 'Own',
    difficulty: 'Medium',
    paper: kind === 'MAINS' ? masters.papers[0]?.name || '' : '',
    topic: '',
    marks: kind === 'MAINS' ? 15 : 2,
    optSubject: '',
    optPaper: 'Paper-I',
    tags: []
  };
}

@Component({
  selector: 'app-question-bank-suite-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatDialogModule, MatSnackBarModule, CKEditorModule],
  templateUrl: './question-bank-suite-page.component.html',
  styleUrl: './question-bank-suite-page.component.css'
})
export class QuestionBankSuitePageComponent {
  readonly store = inject(QuestionBankSuiteStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly testService = inject(TestService);
  @ViewChild('questionEditor') private questionEditor?: ElementRef<HTMLElement>;
  readonly Editor = ClassicEditor;
  readonly editorConfig = {
    toolbar: [
      'heading', '|', 'bold', 'italic', 'underline', 'strikethrough', '|',
      'bulletedList', 'numberedList', '|', 'insertTable', 'blockQuote', '|', 'undo', 'redo'
    ],
    table: {
      contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
    }
  };

  readonly page = signal('dashboard');
  readonly kind = signal<QbankKind>('PRELIMS');
  readonly testId = signal('');
  readonly masterTab = signal<MasterTab>('exams');
  readonly testSeriesContext = signal<TestSeriesContext | null>(null);
  readonly questionExamUsage = computed(() => {
    const examsByQuestion = new Map<string, string[]>();
    for (const test of this.store.tests()) {
      if (test.status === 'draft') continue;
      for (const questionId of new Set(test.questionIds)) {
        const key = `${test.kind}:${questionId}`;
        const exams = examsByQuestion.get(key) || [];
        if (test.exam && !exams.includes(test.exam)) {
          exams.push(test.exam);
          examsByQuestion.set(key, exams);
        }
      }
    }
    return examsByQuestion;
  });

  questionSearch = '';
  testSearch = '';
  testExamFilter = '';
  testStatusFilter = '';
  testPaperFilter = '';
  testOptionalFilter = '';
  questionFormVisible = false;
  questionError = '';
  questionDraft = createQuestion('PRELIMS', this.store.emptyState().masters);
  optionsText = '';
  tagsText = '';
  selectedQuestionTags: string[] = [];
  questionTagSearch = '';
  tagDraft = { category: '', subCategory: '', topic: '' };
  editingTagPath: string | null = null;
  tagFormVisible = false;
  tagError = '';
  tagNotice = '';
  testDraft: QbankTest | null = null;
  reopeningTestId = signal<string | null>(null);
  editorKey = '';
  importText = '';
  englishImportText = '';
  hindiImportText = '';
  importPreview: QbankQuestion[] = [];
  duplicateImportCount = 0;
  importMessage = '';
  importError = '';
  newMasterName = '';
  newMasterType = 'GS';
  backupMessage = '';
  backupError = '';

  constructor() {
    this.route.data.subscribe(data => {
      this.page.set(typeof data['page'] === 'string' ? data['page'] : 'dashboard');
      this.kind.set(data['kind'] === 'MAINS' ? 'MAINS' : 'PRELIMS');
    });
    this.route.paramMap.subscribe(params => {
      this.testId.set(params.get('id') || '');
      const tab = params.get('tab');
      this.masterTab.set(this.isMasterTab(tab) ? tab : 'exams');
    });
    this.route.queryParamMap.subscribe(params => {
      const seriesId = params.get('seriesId');
      this.testSeriesContext.set(seriesId ? {
        seriesId,
        slotId: params.get('slotId') || '',
        title: params.get('seriesTitle') || '',
        exam: params.get('exam') || '',
        start: params.get('start') || '',
        duration: Number(params.get('duration')) || 30
      } : null);
    });

    effect(() => {
      const state = this.store.state();
      const page = this.page();
      const kind = this.kind();
      const id = this.testId();
      const seriesContext = this.testSeriesContext();
      const contextKey = seriesContext
        ? `${seriesContext.seriesId}:${seriesContext.slotId}:${seriesContext.exam}:${seriesContext.start}`
        : '';
      const key = `${page}:${kind}:${id}:${contextKey}`;
      if (!state || page !== 'test-editor' || key === this.editorKey) return;
      this.editorKey = key;
      this.initializeTestDraft(id, kind, state.tests, state.masters, seriesContext);
    });
  }

  questionsForKind(): QbankQuestion[] {
    const query = this.questionSearch.trim().toLowerCase();
    return this.store.questions().filter(question =>
      !question.deleted &&
      question.kind === this.kind() &&
      (!query || `${this.plainQuestionText(question.en)} ${this.plainQuestionText(question.hi || '')} ${question.exam || ''} ${question.subject || ''} ${(question.tags || []).join(' ')}`
        .toLowerCase().includes(query))
    ).sort((left, right) => Number(this.hasHighlightedTag(right)) - Number(this.hasHighlightedTag(left)));
  }

  hasHighlightedTag(question: QbankQuestion): boolean {
    return (question.tags || []).some(tag => this.isHighlightedTag(tag));
  }

  isHighlightedTag(tag: string): boolean {
    return tag.trim().replace(/^#/, '').toLowerCase() === 'history/rigvedic period';
  }

  testsForKind(): QbankTest[] {
    const query = this.testSearch.trim().toLowerCase();
    return this.store.tests().filter(test =>
      test.kind === this.kind() &&
      (!query || `${test.title} ${test.exam} ${test.subject} ${test.paper || ''}`.toLowerCase().includes(query)) &&
      (!this.testExamFilter || test.exam === this.testExamFilter) &&
      (!this.testStatusFilter || test.status === this.testStatusFilter) &&
      (!this.testPaperFilter || test.paper === this.testPaperFilter) &&
      (!this.testOptionalFilter || test.optionalSubject === this.testOptionalFilter)
    );
  }

  countQuestions(kind: QbankKind): number {
    return this.store.questions().filter(question => question.kind === kind && !question.deleted).length;
  }

  countTests(kind: QbankKind): number {
    return this.store.tests().filter(test => test.kind === kind).length;
  }

  questionUsageSummary(kind: QbankKind): QuestionUsageSummary {
    const questions = this.questionsForKindValue(kind);
    const usage = this.questionUsageCounts(kind);
    const used = questions.filter(question => (usage.get(question.id) || 0) > 0).length;
    return {
      total: questions.length,
      fresh: questions.length - used,
      used,
      reused: questions.filter(question => (usage.get(question.id) || 0) > 1).length
    };
  }

  usedInExams(question: QbankQuestion): string[] {
    return this.questionExamUsage().get(`${question.kind}:${question.id}`) || [];
  }

  questionExamSummary(kind: QbankKind): QuestionGroupSummary[] {
    return this.questionGroupSummary(kind, question => question.exam || 'Unassigned');
  }

  questionPaperSummary(kind: QbankKind): QuestionGroupSummary[] {
    return this.questionGroupSummary(kind, question => question.paper || 'Unassigned');
  }

  private questionsForKindValue(kind: QbankKind): QbankQuestion[] {
    return this.store.questions().filter(question => question.kind === kind && !question.deleted);
  }

  private questionUsageCounts(kind: QbankKind): Map<string, number> {
    const counts = new Map<string, number>();
    for (const test of this.store.tests()) {
      if (test.kind !== kind || test.status === 'draft') continue;
      for (const questionId of new Set(test.questionIds)) {
        counts.set(questionId, (counts.get(questionId) || 0) + 1);
      }
    }
    return counts;
  }

  private questionGroupSummary(
    kind: QbankKind,
    groupName: (question: QbankQuestion) => string
  ): QuestionGroupSummary[] {
    const usage = this.questionUsageCounts(kind);
    const groups = new Map<string, QuestionGroupSummary>();
    for (const question of this.questionsForKindValue(kind)) {
      const name = groupName(question);
      const group = groups.get(name) || { name, total: 0, fresh: 0, used: 0 };
      group.total++;
      if ((usage.get(question.id) || 0) > 0) group.used++;
      else group.fresh++;
      groups.set(name, group);
    }
    return Array.from(groups.values()).sort((left, right) => left.name.localeCompare(right.name));
  }

  beginQuestion(question?: QbankQuestion): void {
    const masters = this.store.masters() || this.store.emptyState().masters;
    this.questionError = '';
    this.questionDraft = question
      ? {
          ...question,
          en: this.toEditorHtml(question.en),
          hi: this.toEditorHtml(question.hi || ''),
          options: [...(question.options || [])],
          tags: [...(question.tags || [])]
        }
      : createQuestion(this.kind(), masters);
    this.optionsText = (this.questionDraft.options || []).join('\n');
    this.selectedQuestionTags = [...(this.questionDraft.tags || [])];
    this.questionTagSearch = '';
    this.tagsText = '';
    this.questionFormVisible = true;
    window.setTimeout(() => {
      this.questionEditor?.nativeElement.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  }

  cancelQuestion(): void {
    this.questionFormVisible = false;
    this.questionError = '';
    this.selectedQuestionTags = [];
    this.questionTagSearch = '';
    this.tagsText = '';
  }

  saveQuestion(): void {
    const englishHtml = this.questionDraft.en.trim();
    const english = this.plainQuestionText(englishHtml).trim();
    const hindiHtml = this.questionDraft.hi?.trim() || '';
    const options = this.optionsText.split(/\r?\n/).map(option => option.trim()).filter(Boolean);
    this.questionError = '';
    if (!english) {
      this.questionError = 'Enter the English question text.';
      return;
    }
    if (this.kind() === 'PRELIMS' && (options.length < 2 || !this.questionDraft.correct)) {
      this.questionError = 'Add at least two options and choose the correct option.';
      return;
    }

    const existingId = this.questionDraft.id;
    const saved: QbankQuestion = {
      ...this.questionDraft,
      id: existingId || this.newId(),
      kind: this.kind(),
      en: englishHtml,
      hi: this.plainQuestionText(hindiHtml).trim() ? hindiHtml : '',
      options,
      tags: [...new Set([
        ...this.selectedQuestionTags,
        ...this.tagsText.split(',').map(tag => tag.trim()).filter(Boolean)
      ])],
      created: this.questionDraft.created || Date.now()
    };
    this.store.update(state => {
      const index = state.questions.findIndex(question => existingId !== '' && question.id === existingId);
      if (index >= 0) state.questions[index] = saved;
      else state.questions.unshift(saved);
    });
    this.questionFormVisible = false;
    this.selectedQuestionTags = [];
    this.questionTagSearch = '';
    this.tagsText = '';
  }

  deleteQuestion(question: QbankQuestion): void {
    const isUsed = this.store.tests().some(test => test.questionIds.includes(question.id));
    if (isUsed) {
      window.alert('This question is used by a test. Remove it from the test before deleting it.');
      return;
    }
    if (!window.confirm('Delete this question? It will be hidden from the question bank.')) return;
    this.store.update(state => {
      const current = state.questions.find(item => item.id === question.id);
      if (current) current.deleted = true;
    });
  }

  createTest(): void {
    this.router.navigate(['/question-bank-suite', this.kind().toLowerCase(), 'tests', 'new']);
  }

  editTest(test: QbankTest): void {
    this.router.navigate(['/question-bank-suite', this.kind().toLowerCase(), 'tests', test.id]);
  }

  initializeTestDraft(
    id: string,
    kind: QbankKind,
    tests: QbankTest[],
    masters: QbankMasters,
    seriesContext: TestSeriesContext | null = null
  ): void {
    if (id === 'new') {
      const duration = seriesContext?.duration || (kind === 'PRELIMS' ? 30 : 180);
      this.testDraft = {
        id: '',
        kind,
        title: seriesContext?.title || '',
        exam: seriesContext?.exam || masters.exams[0] || '',
        subject: masters.subjects[0] || '',
        optionalSubject: '',
        optionalPaper: '',
        paper: kind === 'MAINS' ? masters.papers[0]?.name || '' : '',
        start: seriesContext?.start || '',
        end: seriesContext?.start ? this.addMinutesToLocalDateTime(seriesContext.start, duration) : '',
        duration,
        marksPerQ: kind === 'PRELIMS' ? 2 : 10,
        negMarks: kind === 'PRELIMS' ? 0.66 : 0,
        status: 'draft',
        questionIds: []
      };
      return;
    }

    const test = tests.find(item => item.id === id);
    if (!test) {
      this.testDraft = null;
      return;
    }
    this.testDraft = { ...test, questionIds: [...(test.questionIds || [])] };
  }

  saveTest(): void {
    const draft = this.testDraft;
    if (!draft?.title.trim() || this.isTestFrozen()) return;
    const id = draft.id || this.newId();
    const seriesContext = this.testSeriesContext();
    const saved = {
      ...draft,
      id,
      kind: this.kind(),
      title: draft.title.trim(),
      ...(seriesContext ? { seriesId: seriesContext.seriesId, seriesSlotId: seriesContext.slotId } : {})
    };
    this.store.update(state => {
      const index = state.tests.findIndex(test => test.id === id);
      if (index >= 0) state.tests[index] = saved;
      else state.tests.unshift(saved);
    });
    if (seriesContext) {
      this.router.navigate(['/question-bank-suite', 'prelims', 'test-series'], {
        queryParams: { seriesId: seriesContext.seriesId }
      });
    } else {
      this.router.navigate(['/question-bank-suite', this.kind().toLowerCase(), 'tests']);
    }
  }

  toggleQuestionForTest(questionId: string, checked: boolean): void {
    if (!this.testDraft || this.isTestFrozen()) return;
    const selected = new Set(this.testDraft.questionIds);
    if (checked) selected.add(questionId);
    else selected.delete(questionId);
    this.testDraft = { ...this.testDraft, questionIds: [...selected] };
  }

  setTestStatus(test: QbankTest, status: string): void {
    this.store.update(state => {
      const current = state.tests.find(item => item.id === test.id);
      if (current) current.status = status;
    });
  }

  maxTestMarks(test: QbankTest): number {
    return test.questionIds.length * (Number.isFinite(test.marksPerQ) ? test.marksPerQ : 0);
  }

  reopenTestForStudent(test: QbankTest): void {
    const dialogRef = this.dialog.open(ReopenExamDialogComponent, {
      width: '480px',
      maxWidth: 'calc(100vw - 32px)',
      panelClass: 'reopen-exam-dialog-panel',
      autoFocus: false,
      data: { testTitle: test.title }
    });

    dialogRef.afterClosed().subscribe(details => {
      if (!details) return;
      this.reopeningTestId.set(test.id);
      this.testService.getAllTests(test.kind === 'PRELIMS' ? 'pre' : 'mains').subscribe({
        next: exams => {
          const exam = this.findLinkedExam(test, exams);
          if (!exam) {
            this.reopeningTestId.set(null);
            this.snackBar.open(
              'This QBank test is not linked to a unique student-accessible exam.',
              'Close',
              { duration: 5000 }
            );
            return;
          }
          this.testService.reopenExam(exam._id, details.email, details.until).subscribe({
            next: response => {
              this.reopeningTestId.set(null);
              this.snackBar.open(
                `Exam reopened for ${response.student?.email || details.email}`,
                'Close',
                { duration: 4000 }
              );
            },
            error: error => {
              this.reopeningTestId.set(null);
              this.snackBar.open(error.error?.message || 'Unable to reopen exam', 'Close', { duration: 4000 });
            }
          });
        },
        error: error => {
          this.reopeningTestId.set(null);
          this.snackBar.open(error.error?.message || 'Unable to find the linked exam', 'Close', { duration: 4000 });
        }
      });
    });
  }

  private findLinkedExam(test: QbankTest, exams: Array<{ _id: string; title: string; startTime: string; duration: number }>) {
    const matchingTitle = exams.filter(exam => exam.title.trim() === test.title.trim());
    if (test.start) {
      const startTime = new Date(test.start).getTime();
      const matchingSchedule = matchingTitle.filter(exam =>
        new Date(exam.startTime).getTime() === startTime &&
        exam.duration === test.duration
      );
      if (matchingSchedule.length === 1) return matchingSchedule[0];
      if (matchingSchedule.length > 1) return null;
    }
    return matchingTitle.length === 1 ? matchingTitle[0] : null;
  }

  isTestFrozen(): boolean {
    return this.testDraft?.status === 'live' || this.testDraft?.status === 'completed';
  }

  duplicateTest(test: QbankTest): void {
    this.store.update(state => {
      state.tests.unshift({
        ...test,
        id: this.newId(),
        title: `${test.title} (copy)`,
        status: 'draft',
        created: Date.now()
      });
    });
  }

  deleteTest(test: QbankTest): void {
    if (!window.confirm(`Delete "${test.title}"?`)) return;
    this.store.update(state => {
      state.tests = state.tests.filter(item => item.id !== test.id);
    });
  }

  importQuestions(): void {
    this.importMessage = '';
    this.importError = '';
    const masters = this.store.masters() || this.store.emptyState().masters;
    let imported: QbankQuestion[];
    if (this.importText.trim()) {
      try {
        const parsed: unknown = JSON.parse(this.importText.trim());
        const rows = Array.isArray(parsed)
          ? parsed
          : this.isRecord(parsed) && Array.isArray(parsed['questions'])
            ? parsed['questions']
            : [];
        imported = rows.filter(this.isRecord).map(row => this.questionFromJson(row, masters))
          .filter(question => question.en.trim() || Boolean(question.hi?.trim()));
      } catch (error) {
        this.importError = error instanceof Error ? error.message : 'Could not read the JSON file.';
        return;
      }
    } else {
      const english = this.parseTextImport(this.englishImportText, masters);
      const hindi = this.parseTextImport(this.hindiImportText, masters);
      const paired = new Map<number, QbankQuestion>();
      [...english, ...hindi].forEach(item => {
        const current = paired.get(item.number) || createQuestion(this.kind(), masters);
        const importedText = item.language === 'hi' ? item.question.hi || '' : item.question.en || '';
        if (item.language === 'hi') current.hi = importedText;
        else current.en = importedText;
        this.copyImportMetadata(current, item.question);
        if (item.language === 'hi' && item.question.options?.length) current.optionsHi = item.question.options;
        else if (!current.options?.length && item.question.options?.length) current.options = item.question.options;
        if (!current.correct && item.question.correct) current.correct = item.question.correct;
        paired.set(item.number, current);
      });
      imported = [...paired.values()].filter(question => question.en.trim() || Boolean(question.hi?.trim()));
    }

    if (!imported.length) {
      this.importError = 'No valid questions found. Use JSON or start text questions with numbered markers such as Q1. or Q2.';
      return;
    }

    const seen = new Set(this.store.questions()
      .filter(question => question.kind === this.kind() && !question.deleted)
      .map(question => this.normalizedQuestion(question.en || question.hi || '')));
    const unique: QbankQuestion[] = [];
    this.duplicateImportCount = 0;
    imported.forEach(question => {
      const key = this.normalizedQuestion(question.en || question.hi || '');
      if (!key || seen.has(key)) {
        this.duplicateImportCount++;
        return;
      }
      seen.add(key);
      unique.push({ ...question, id: this.newId(), kind: this.kind(), created: Date.now() });
    });
    this.importPreview = unique;
    if (!unique.length) {
      this.importMessage = `${this.duplicateImportCount} duplicate question(s) found; there is nothing new to import.`;
    } else {
      this.importMessage = `${unique.length} question(s) ready to import. ${this.duplicateImportCount} duplicate(s) will be skipped.`;
    }
  }

  confirmImport(): void {
    if (!this.importPreview.length) return;
    const count = this.importPreview.length;
    this.store.update(state => {
      state.questions.unshift(...this.importPreview);
      state.imports.push({
        id: this.newId(),
        kind: this.kind(),
        count,
        created: Date.now(),
        questionIds: this.importPreview.map(question => question.id)
      });
    });
    this.importPreview = [];
    this.importText = '';
    this.englishImportText = '';
    this.hindiImportText = '';
    this.importMessage = `${count} question(s) imported.`;
    this.importError = '';
  }

  cancelImportPreview(): void {
    this.importPreview = [];
    this.importMessage = '';
    this.duplicateImportCount = 0;
  }

  importHistoryForKind(): Array<Record<string, unknown>> {
    return (this.store.state()?.imports || [])
      .filter(record => record['kind'] === this.kind())
      .slice()
      .reverse();
  }

  importDate(record: Record<string, unknown>): string {
    const timestamp = typeof record['created'] === 'number' ? record['created'] : Number(record['created']);
    return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : '—';
  }

  undoImport(record: Record<string, unknown>): void {
    const ids = Array.isArray(record['questionIds'])
      ? record['questionIds'].filter((id): id is string => typeof id === 'string')
      : [];
    if (!ids.length || record['undone'] === true) return;
    if (!window.confirm(`Undo this import of ${ids.length} question(s)? Questions used by tests will be kept.`)) return;

    let removed = 0;
    let kept = 0;
    this.store.update(state => {
      const used = new Set(state.tests.flatMap(test => test.questionIds));
      state.questions.forEach(question => {
        if (!ids.includes(question.id)) return;
        if (used.has(question.id)) kept++;
        else {
          question.deleted = true;
          removed++;
        }
      });
      record['undone'] = true;
    });
    this.importMessage = `${removed} question(s) removed from the bank; ${kept} kept because tests use them.`;
  }

  async readImportFile(event: Event, language: 'json' | 'en' | 'hi'): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024 || !/\.(json|txt|md|docx)$/i.test(file.name)) {
      this.importError = 'Select a JSON, TXT, MD or DOCX file up to 20 MB.';
      return;
    }
    try {
      if (/\.json$/i.test(file.name)) {
        this.englishImportText = '';
        this.hindiImportText = '';
        this.importText = await file.text();
      } else {
        this.importText = '';
        const text = /\.docx$/i.test(file.name) ? await this.extractDocxText(file) : await file.text();
        if (language === 'hi') this.hindiImportText = text;
        else this.englishImportText = text;
      }
      this.importPreview = [];
      this.importError = '';
      this.importMessage = `${file.name} is ready to preview.`;
    } catch (error) {
      this.importError = error instanceof Error ? error.message : 'Could not read this import file.';
    } finally {
      (event.target as HTMLInputElement).value = '';
    }
  }

  masterValues(): Array<string | QbankNamedMaster> {
    const masters = this.store.masters();
    if (!masters) return [];
    return masters[this.masterTab()];
  }

  masterName(value: string | QbankNamedMaster): string {
    return typeof value === 'string' ? value : value.name;
  }

  masterDetail(value: string | QbankNamedMaster): string {
    return typeof value === 'string' ? '' : value.type || 'Optional subject';
  }

  addMaster(): void {
    const name = this.newMasterName.trim();
    if (!name) return;
    if (this.masterValues().some(item => this.masterName(item).toLowerCase() === name.toLowerCase())) return;
    this.store.update(state => {
      const tab = this.masterTab();
      if (tab === 'papers') state.masters.papers.push({ name, type: this.newMasterType });
      else if (tab === 'optionals') state.masters.optionals.push({ name, subjects: [] });
      else if (tab === 'exams') state.masters.exams.push(name);
      else if (tab === 'subjects') state.masters.subjects.push(name);
      else state.masters.directives.push(name);
    });
    this.newMasterName = '';
  }

  selectMasterTab(tab: string): void {
    if (!this.isMasterTab(tab)) return;
    this.router.navigate(['/question-bank-suite', 'master', tab]);
  }

  removeMaster(value: string | QbankNamedMaster): void {
    const name = this.masterName(value);
    if (!window.confirm(`Remove "${name}" from master data?`)) return;
    this.store.update(state => {
      const tab = this.masterTab();
      if (tab === 'exams') state.masters.exams = state.masters.exams.filter(item => item !== name);
      else if (tab === 'subjects') state.masters.subjects = state.masters.subjects.filter(item => item !== name);
      else if (tab === 'papers') state.masters.papers = state.masters.papers.filter(item => item.name !== name);
      else if (tab === 'optionals') state.masters.optionals = state.masters.optionals.filter(item => item.name !== name);
      else state.masters.directives = state.masters.directives.filter(item => item !== name);
    });
  }

  tagsForKind(): Array<{ name: string; count: number; category?: string; subCategory?: string; topic?: string }> {
    const counts = new Map<string, number>();
    this.store.questions().filter(question => question.kind === this.kind()).forEach(question => {
      (question.tags || []).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    const definitions = (this.store.masters()?.tags || []).filter(tag => tag.kind === this.kind());
    definitions.forEach(tag => {
      if (!counts.has(tag.path)) counts.set(tag.path, 0);
    });
    return [...counts].map(([name, count]) => {
      const definition = definitions.find(tag => tag.path === name);
      const parts = name.split('/').map(part => part.trim());
      return {
        name,
        count,
        category: definition?.category || parts[0],
        subCategory: definition?.subCategory || parts[1],
        topic: definition?.topic || parts.slice(2).join('/')
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  questionTagOptions(): Array<{ name: string; count: number; category?: string; subCategory?: string; topic?: string }> {
    const query = this.questionTagSearch.trim().toLowerCase();
    return this.tagsForKind().filter(tag =>
      !query || `${tag.name} ${tag.category || ''} ${tag.subCategory || ''} ${tag.topic || ''}`
        .toLowerCase().includes(query)
    );
  }

  tagCategories(): string[] {
    return [...new Set((this.store.masters()?.tags || [])
      .filter(tag => tag.kind === this.kind())
      .map(tag => tag.category))]
      .sort((a, b) => a.localeCompare(b));
  }

  tagSubcategories(): string[] {
    const category = this.normalizeTagPart(this.tagDraft.category);
    return [...new Set((this.store.masters()?.tags || [])
      .filter(tag => tag.kind === this.kind() && tag.category === category)
      .map(tag => tag.subCategory))]
      .sort((a, b) => a.localeCompare(b));
  }

  setTagKind(kind: QbankKind): void {
    this.kind.set(kind);
    this.tagDraft = { category: '', subCategory: '', topic: '' };
    this.editingTagPath = null;
    this.tagFormVisible = false;
    this.tagError = '';
    this.tagNotice = '';
  }

  openTagForm(): void {
    if (this.tagFormVisible) {
      this.cancelTagForm();
      return;
    }
    this.editingTagPath = null;
    this.tagDraft = { category: '', subCategory: '', topic: '' };
    this.tagError = '';
    this.tagNotice = '';
    this.tagFormVisible = true;
  }

  editTag(tag: { name: string; category?: string; subCategory?: string; topic?: string }): void {
    const definition = (this.store.masters()?.tags || []).find(item =>
      item.kind === this.kind() && item.path === tag.name
    );
    this.editingTagPath = tag.name;
    this.tagDraft = {
      category: definition?.category || tag.category || '',
      subCategory: definition?.subCategory || tag.subCategory || '',
      topic: definition?.topic || tag.topic || ''
    };
    this.tagError = '';
    this.tagNotice = '';
    this.tagFormVisible = true;
  }

  cancelTagForm(): void {
    this.tagFormVisible = false;
    this.editingTagPath = null;
    this.tagDraft = { category: '', subCategory: '', topic: '' };
    this.tagError = '';
    this.tagNotice = '';
  }

  saveQuestionBankTag(): void {
    this.tagError = '';
    this.tagNotice = '';
    if (!this.store.state()) {
      this.tagError = 'Question Bank data is not loaded yet. Please retry after it finishes loading.';
      return;
    }

    const category = this.normalizeTagPart(this.tagDraft.category);
    const subCategory = this.normalizeTagPart(this.tagDraft.subCategory);
    const topic = this.normalizeTagPart(this.tagDraft.topic);
    if (!category || !subCategory || !topic) {
      this.tagError = 'Category, subcategory and topic are required.';
      return;
    }
    if ([category, subCategory, topic].some(part => part.includes('/'))) {
      this.tagError = 'Do not use "/" inside a category, subcategory or topic name.';
      return;
    }

    const path = `${category}/${subCategory}/${topic}`;
    const tags = this.store.masters()?.tags || [];
    if (tags.some(tag =>
      tag.kind === this.kind() &&
      tag.path.toLowerCase() === path.toLowerCase() &&
      tag.path !== this.editingTagPath
    )) {
      this.tagError = 'This category, subcategory and topic already exist.';
      return;
    }

    const tag: QbankTag = { kind: this.kind(), category, subCategory, topic, path };
    this.store.update(state => {
      if (this.editingTagPath) {
        const oldPath = this.editingTagPath;
        state.questions.forEach(question => {
          if (question.kind !== this.kind()) return;
          question.tags = [...new Set((question.tags || []).map(value => value === oldPath ? path : value))];
        });
        state.masters.tags = (state.masters.tags || [])
          .filter(item => item.kind !== this.kind() || (item.path !== oldPath && item.path !== path))
          .concat(tag);
      } else {
        state.masters.tags = [...(state.masters.tags || []), tag];
      }
    });
    if (this.editingTagPath) {
      this.editingTagPath = path;
      this.tagNotice = `Updated #${path}.`;
    } else {
      this.tagDraft = { category, subCategory, topic: '' };
      this.tagNotice = `Created #${path}. You can now assign it to questions.`;
    }
  }

  deleteTag(name: string): void {
    if (!window.confirm(`Remove "${name}" from all questions?`)) return;
    if (this.editingTagPath === name) this.cancelTagForm();
    this.tagError = '';
    this.tagNotice = '';
    this.store.update(state => {
      state.questions.forEach(question => {
        if (question.kind === this.kind()) question.tags = (question.tags || []).filter(tag => tag !== name);
      });
      state.masters.tags = (state.masters.tags || []).filter(tag =>
        tag.kind !== this.kind() || tag.path !== name
      );
    });
  }

  toggleQuestionTag(tag: string, checked: boolean): void {
    const selected = new Set(this.selectedQuestionTags);
    if (checked) selected.add(tag);
    else selected.delete(tag);
    this.selectedQuestionTags = [...selected];
  }

  private normalizeTagPart(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  downloadBackup(): void {
    const state = this.store.state();
    if (!state) return;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `thinkcivil-qbank-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.backupMessage = 'Backup downloaded.';
    this.backupError = '';
  }

  async restoreBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.backupMessage = '';
    this.backupError = '';
    try {
      const result = this.store.replaceState(JSON.parse(await file.text()) as unknown);
      if (result) this.backupError = result;
      else this.backupMessage = 'Backup restored; saving changes to the server.';
    } catch {
      this.backupError = 'Could not read this backup file.';
    } finally {
      input.value = '';
    }
  }

  clearAllData(): void {
    if (!window.confirm('Delete all QBank questions, tests, imports and master data? This cannot be undone.')) return;
    this.store.update(state => {
      const empty = this.store.emptyState();
      state.version = empty.version;
      state.questions = empty.questions;
      state.tests = empty.tests;
      state.masters = empty.masters;
      state.imports = empty.imports;
    });
    this.backupMessage = 'QBank data cleared.';
    this.backupError = '';
  }

  private questionFromJson(row: Record<string, unknown>, masters: QbankMasters): QbankQuestion {
    const questionText = this.isRecord(row['question']) ? row['question'] : {};
    const rawOptions = Array.isArray(row['options']) ? row['options'] : [];
    const tags = Array.isArray(row['tags'])
      ? row['tags'].filter((tag): tag is string => typeof tag === 'string')
      : typeof row['tags'] === 'string' ? row['tags'].split(',').map(tag => tag.trim()).filter(Boolean) : [];
    const base = createQuestion(this.kind(), masters);
    return {
      ...base,
      id: '',
      en: typeof row['en'] === 'string' ? row['en']
        : typeof questionText['english'] === 'string' ? questionText['english'] : '',
      hi: typeof row['hi'] === 'string' ? row['hi']
        : typeof questionText['hindi'] === 'string' ? questionText['hindi'] : '',
      options: rawOptions.filter((option): option is string => typeof option === 'string'),
      optionsHi: Array.isArray(row['optionsHi'])
        ? row['optionsHi'].filter((option): option is string => typeof option === 'string')
        : [],
      correct: typeof row['correct'] === 'string' || typeof row['correct'] === 'number'
        ? String(row['correct'])
        : '',
      subject: typeof row['subject'] === 'string' ? row['subject'] : base.subject,
      exam: typeof row['exam'] === 'string' ? row['exam'] : base.exam,
      source: typeof row['source'] === 'string' ? row['source'] : base.source,
      difficulty: typeof row['difficulty'] === 'string' ? row['difficulty'] : base.difficulty,
      paper: typeof row['paper'] === 'string' ? row['paper'] : base.paper,
      topic: typeof row['topic'] === 'string' ? row['topic'] : '',
      marks: typeof row['marks'] === 'number' ? row['marks'] : base.marks,
      optSubject: typeof row['optSubject'] === 'string' ? row['optSubject'] : '',
      optPaper: typeof row['optPaper'] === 'string' ? row['optPaper'] : 'Paper-I',
      year: typeof row['year'] === 'string' || typeof row['year'] === 'number' ? row['year'] : undefined,
      tags
    };
  }

  private parseTextImport(text: string, masters: QbankMasters): ParsedImportQuestion[] {
    const blocks: Array<{ number: number; lines: string[] }> = [];
    let current: { number: number; lines: string[] } | null = null;
    for (const rawLine of text.replace(/\r/g, '').split('\n')) {
      const line = rawLine.replace(/[\u200b\u00a0]/g, ' ').trim()
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1');
      if (!line) continue;
      const marker = line.match(/^(?:Q(?:uestion)?\s*\.?\s*|प्रश्न\s*\.?\s*|प्र\s*\.\s*)(\d+)\s*[.):\-–]?\s*(.*)$/i);
      if (marker) {
        current = { number: Number(marker[1]), lines: [] };
        if (marker[2]) current.lines.push(marker[2]);
        blocks.push(current);
      } else if (current && !/^[-=_*#~]{3,}$/.test(line)) {
        current.lines.push(line);
      }
    }

    return blocks.map(block => {
      const questionLines: string[] = [];
      const options: string[] = [];
      const metadata: Record<string, string> = {};
      let activeOption = -1;
      let activeMetadata = '';
      const metadataNames: Record<string, string> = {
        exam: 'exam', year: 'year', 'pyq year': 'year', subject: 'subject',
        source: 'source', difficulty: 'difficulty', level: 'difficulty',
        paper: 'paper', topic: 'topic', chapter: 'topic', tags: 'tags', tag: 'tags',
        answer: 'answer', ans: 'answer', correct: 'answer', 'correct answer': 'answer',
        marks: 'marks', words: 'words', 'word limit': 'words',
        'optional subject': 'optSubject', optional: 'optSubject', 'opt subject': 'optSubject',
        'optional paper': 'optPaper', 'opt paper': 'optPaper',
        explanation: 'explanation', solution: 'explanation', approach: 'explanation',
        directive: 'directive', keywords: 'keywords',
        'परीक्षा': 'exam', 'वर्ष': 'year', 'विषय': 'subject', 'स्रोत': 'source',
        'उत्तर': 'answer', 'सही उत्तर': 'answer', 'अंक': 'marks', 'शब्द': 'words',
        'शब्द सीमा': 'words', 'व्याख्या': 'explanation', 'स्पष्टीकरण': 'explanation'
      };

      for (const line of block.lines) {
        const label = line.match(/^([A-Za-z\u0900-\u097f][A-Za-z\u0900-\u097f /]{0,28})\s*[:：]\s*(.*)$/);
        const key = label ? metadataNames[label[1].trim().toLowerCase()] : undefined;
        if (key) {
          metadata[key] = metadata[key]
            ? `${metadata[key]}${key === 'explanation' ? '\n' : ' '}${label?.[2].trim() || ''}`
            : label?.[2].trim() || '';
          activeMetadata = key;
          activeOption = -1;
          continue;
        }

        const inlineOptions = this.kind() === 'PRELIMS'
          ? [...line.matchAll(/\(([a-d])\)\s*/gi)]
          : [];
        if (inlineOptions.length >= 2 && inlineOptions[0].index !== undefined) {
          const firstIndex = inlineOptions[0].index;
          if (firstIndex > 0) questionLines.push(line.slice(0, firstIndex).trim());
          inlineOptions.forEach((match, index) => {
            const start = (match.index || 0) + match[0].length;
            const end = index + 1 < inlineOptions.length ? inlineOptions[index + 1].index : line.length;
            options.push(line.slice(start, end).trim());
          });
          activeOption = options.length - 1;
          activeMetadata = '';
          continue;
        }

        const option = line.match(/^\(?([a-d])[\).]\s*(.*)$/i);
        if (this.kind() === 'PRELIMS' && option) {
          options.push(option[2].trim());
          activeOption = options.length - 1;
          activeMetadata = '';
          continue;
        }
        if (activeMetadata) {
          metadata[activeMetadata] += `${activeMetadata === 'explanation' ? '\n' : ' '}${line}`;
        } else if (activeOption >= 0 && options[activeOption] !== undefined) {
          options[activeOption] += ` ${line}`;
        } else {
          questionLines.push(line);
        }
      }

      const textValue = questionLines.join('\n').trim();
      const hindiLetters = (textValue.match(/[\u0900-\u097f]/g) || []).length;
      const latinLetters = (textValue.match(/[A-Za-z]/g) || []).length;
      const language: 'en' | 'hi' = hindiLetters > latinLetters * 0.5 ? 'hi' : 'en';
      const base = createQuestion(this.kind(), masters);
      const answer = metadata['answer']?.match(/(?:^|[^A-Z])([A-D])(?:$|[^A-Z])/i)?.[1]?.toUpperCase()
        || metadata['answer']?.match(/[1-4]/)?.[0];
      const question: QbankQuestion = {
        ...base,
        en: language === 'en' ? textValue : '',
        hi: language === 'hi' ? textValue : '',
        options,
        optionsHi: language === 'hi' ? options : [],
        correct: answer && /^[1-4]$/.test(answer) ? 'ABCD'[Number(answer) - 1] : answer || '',
        exam: metadata['exam'] || base.exam,
        year: metadata['year'],
        subject: metadata['subject'] || base.subject,
        source: metadata['source'] || base.source,
        difficulty: metadata['difficulty'] || base.difficulty,
        paper: metadata['paper'] || base.paper,
        topic: metadata['topic'] || '',
        marks: Number(metadata['marks']) || base.marks,
        optSubject: metadata['optSubject'] || '',
        optPaper: metadata['optPaper'] || 'Paper-I',
        tags: (metadata['tags'] || '').split(',').map(tag => tag.trim()).filter(Boolean),
        explanation: metadata['explanation'] || '',
        directive: metadata['directive'] || '',
        keywords: metadata['keywords'] || '',
        words: Number(metadata['words']) || undefined
      };
      return { number: block.number, language, question };
    }).filter(item => item.question.en || item.question.hi);
  }

  private copyImportMetadata(target: QbankQuestion, source: QbankQuestion): void {
    const defaults = createQuestion(target.kind, this.store.masters() || this.store.emptyState().masters);
    if (source.exam && source.exam !== defaults.exam) target.exam = source.exam;
    if (source.subject && source.subject !== defaults.subject) target.subject = source.subject;
    if (source.source && source.source !== defaults.source) target.source = source.source;
    if (source.difficulty && source.difficulty !== defaults.difficulty) target.difficulty = source.difficulty;
    if (source.paper && source.paper !== defaults.paper) target.paper = source.paper;
    if (source.topic) target.topic = source.topic;
    if (source.marks !== undefined && source.marks !== defaults.marks) target.marks = source.marks;
    if (source.optSubject) target.optSubject = source.optSubject;
    if (source.optPaper && source.optPaper !== defaults.optPaper) target.optPaper = source.optPaper;
    if (source.year !== undefined) target.year = source.year;
    if (source.tags?.length) target.tags = source.tags;
  }

  private normalizedQuestion(text: string): string {
    return this.plainQuestionText(text).toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  }

  private toEditorHtml(text: string): string {
    if (!text) return '';
    if (/<(?:p|br|h[1-6]|strong|b|em|i|u|s|ul|ol|li|table|blockquote|a|div|span)\b/i.test(text)) {
      return text;
    }
    return `<p>${text.split(/\r?\n/).map(line => this.escapeHtml(line)).join('<br>')}</p>`;
  }

  private plainQuestionText(text: string): string {
    return text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|li|h[1-6]|blockquote|tr)>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, '\'');
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private async extractDocxText(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let endRecord = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        endRecord = offset;
        break;
      }
    }
    if (endRecord < 0) throw new Error('This DOCX file is not a valid Word document.');

    const entryCount = view.getUint16(endRecord + 10, true);
    let cursor = view.getUint32(endRecord + 16, true);
    const decoder = new TextDecoder();
    for (let index = 0; index < entryCount; index++) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('Could not read the DOCX file structure.');
      const method = view.getUint16(cursor + 10, true);
      const compressedSize = view.getUint32(cursor + 20, true);
      const uncompressedSize = view.getUint32(cursor + 24, true);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const localOffset = view.getUint32(cursor + 42, true);
      const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
      cursor += 46 + nameLength + extraLength + commentLength;
      if (name !== 'word/document.xml') continue;
      if (uncompressedSize > 20 * 1024 * 1024) throw new Error('The DOCX document content exceeds 20 MB.');

      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Could not read the DOCX document content.');
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
      let xml: string;
      if (method === 0) xml = decoder.decode(compressed);
      else if (method === 8) {
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        xml = await new Response(stream).text();
      } else {
        throw new Error('This DOCX compression format is not supported.');
      }

      const documentXml = new DOMParser().parseFromString(xml, 'application/xml');
      if (documentXml.querySelector('parsererror')) throw new Error('Could not parse Word document content.');
      let nextQuestion = 1;
      return Array.from(documentXml.getElementsByTagNameNS('*', 'p'))
        .map(paragraph => {
          const text = paragraph.textContent?.trim() || '';
          const numberedQuestion = text.match(/^(\d+)\.\s+(.+)$/);
          const properties = paragraph.getElementsByTagNameNS('*', 'pPr')[0];
          const isListItem = Boolean(properties?.getElementsByTagNameNS('*', 'numPr').length);
          if (!isListItem && numberedQuestion && Number(numberedQuestion[1]) === nextQuestion) {
            nextQuestion++;
            return `Q${numberedQuestion[1]}. ${numberedQuestion[2]}`;
          }
          return text;
        })
        .filter(Boolean)
        .join('\n');
    }
    throw new Error('The DOCX file does not contain Word question content.');
  }

  kindLabel(kind: QbankKind): string {
    return kind === 'PRELIMS' ? 'Prelims' : 'Mains';
  }

  kindQuestions(): QbankQuestion[] {
    return this.store.questions().filter(question => question.kind === this.kind() && !question.deleted);
  }

  testPickerQuestions(): QbankQuestion[] {
    const selected = new Set(this.testDraft?.questionIds || []);
    const seriesContext = this.testSeriesContext();
    return this.store.questions().filter(question =>
      question.kind === this.kind() &&
      (selected.has(question.id) ||
        (!question.deleted && (!seriesContext || question.exam === this.testDraft?.exam)))
    );
  }

  questionTitle(id: string): string {
    return this.store.questions().find(question => question.id === id)?.en || 'Question no longer available';
  }

  backToTests(): void {
    const seriesContext = this.testSeriesContext();
    if (seriesContext) {
      this.router.navigate(['/question-bank-suite', 'prelims', 'test-series'], {
        queryParams: { seriesId: seriesContext.seriesId }
      });
      return;
    }
    this.router.navigate(['/question-bank-suite', this.kind().toLowerCase(), 'tests']);
  }

  private addMinutesToLocalDateTime(value: string, minutes: number): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    date.setMinutes(date.getMinutes() + minutes);
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private isMasterTab(value: string | null): value is MasterTab {
    return value === 'exams' || value === 'subjects' || value === 'papers' ||
      value === 'optionals' || value === 'directives';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private newId(): string {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
