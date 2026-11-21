import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, concatMap, debounceTime, map, of, Subject } from 'rxjs';
import { environment } from '../../../../environment/environment';

export type QbankKind = 'PRELIMS' | 'MAINS';

export interface QbankTag {
  kind: QbankKind;
  category: string;
  subCategory: string;
  topic: string;
  path: string;
}

export interface QbankQuestion {
  id: string;
  kind: QbankKind;
  en: string;
  hi?: string;
  options?: string[];
  optionsHi?: string[];
  correct?: string;
  exam?: string;
  subject?: string;
  source?: string;
  difficulty?: string;
  paper?: string;
  topic?: string;
  marks?: number;
  optSubject?: string;
  optPaper?: string;
  tags?: string[];
  year?: string | number;
  deleted?: boolean;
  created?: number;
  [key: string]: unknown;
}

export interface QbankTest {
  id: string;
  kind: QbankKind;
  title: string;
  exam: string;
  subject: string;
  description?: string;
  optionalSubject?: string;
  optionalPaper?: string;
  paper?: string;
  start?: string;
  end?: string;
  duration: number;
  marksPerQ: number;
  negMarks: number;
  status: string;
  questionIds: string[];
  seriesId?: string;
  seriesSlotId?: string;
  created?: number;
  [key: string]: unknown;
}

export interface QbankNamedMaster {
  name: string;
  type?: string;
  subjects?: string[];
  [key: string]: unknown;
}

export interface QbankMasters {
  exams: string[];
  subjects: string[];
  papers: QbankNamedMaster[];
  optionals: QbankNamedMaster[];
  directives: string[];
  tags?: QbankTag[];
  [key: string]: unknown;
}

export interface QbankState {
  version: number;
  questions: QbankQuestion[];
  tests: QbankTest[];
  masters: QbankMasters;
  imports: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface SaveRequest {
  revision: number;
  state: QbankState;
}

interface SaveResult {
  revision: number;
  success: boolean;
}

const EMPTY_MASTERS: QbankMasters = {
  exams: ['UPSC CSE', 'UPPSC', 'APSC Assam', 'TNPSC'],
  subjects: [
    'Polity', 'History', 'Geography', 'Economy', 'Environment', 'Science & Technology',
    'Art & Culture', 'Current Affairs', 'Ethics', 'Essay'
  ],
  papers: [
    { name: 'GS-I', type: 'GS' },
    { name: 'GS-II', type: 'GS' },
    { name: 'GS-III', type: 'GS' },
    { name: 'GS-IV', type: 'GS' },
    { name: 'Essay', type: 'ESSAY' }
  ],
  optionals: [],
  directives: [
    'Discuss', 'Critically examine', 'Critically analyse', 'Examine', 'Analyse',
    'Evaluate', 'Comment', 'Elucidate', 'Explain', 'Highlight', 'Illustrate',
    'Substantiate', 'Do you agree', 'Case Study', 'Essay'
  ]
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : fallback;
}

function masterItems(value: unknown, fallback: QbankNamedMaster[]): QbankNamedMaster[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is QbankNamedMaster => isRecord(item) && typeof item['name'] === 'string');
}

@Injectable({ providedIn: 'root' })
export class QuestionBankSuiteStateService {
  private readonly http = inject(HttpClient);
  private readonly stateUrl = `${environment.apiUrl}/qbank/state`;
  private readonly saveRequests = new Subject<SaveRequest>();
  private initialized = false;
  private latestRevision = 0;

  readonly state = signal<QbankState | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saveStatus = computed(() => this.loading() ? 'Loading QBank data…'
    : this.saving() ? 'Saving changes…'
      : this.error() ? 'Save failed'
        : 'Changes saved');
  readonly questions = computed(() => this.state()?.questions ?? []);
  readonly tests = computed(() => this.state()?.tests ?? []);
  readonly masters = computed(() => this.state()?.masters ?? null);

  constructor() {
    this.saveRequests.pipe(
      debounceTime(250),
      concatMap(request => this.http.put<unknown>(this.stateUrl, request.state, { withCredentials: true }).pipe(
        map((): SaveResult => ({ revision: request.revision, success: true })),
        catchError((error: unknown) => {
          this.error.set(this.errorMessage(error, 'QBank state could not be saved.'));
          return of({ revision: request.revision, success: false });
        })
      ))
    ).subscribe(result => {
      if (result.success) this.error.set('');
      if (result.revision === this.latestRevision) this.saving.set(false);
    });
  }

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.loading.set(true);
    this.error.set('');
    this.http.get<unknown>(this.stateUrl, { withCredentials: true }).subscribe({
      next: response => {
        try {
          const state = this.normalizeState(response);
          this.state.set(state);
          this.loading.set(false);
          if (response === null) this.persist();
        } catch (error) {
          this.error.set(this.errorMessage(error, 'QBank data has an invalid format.'));
          this.loading.set(false);
        }
      },
      error: error => {
        this.error.set(this.errorMessage(error, 'QBank data could not be loaded.'));
        this.loading.set(false);
      }
    });
  }

  retry(): void {
    if (this.state()) {
      this.persist();
      return;
    }
    this.initialized = false;
    this.initialize();
  }

  update(mutator: (state: QbankState) => void): void {
    const current = this.state();
    if (!current) return;
    mutator(current);
    this.state.set({ ...current });
    this.persist();
  }

  replaceState(value: unknown): string | null {
    try {
      const state = this.normalizeState(value);
      if (!isRecord(value) || !Array.isArray(value['questions']) || !Array.isArray(value['tests'])) {
        return 'This file is not a valid QBank backup.';
      }
      this.state.set(state);
      this.error.set('');
      this.persist();
      return null;
    } catch {
      return 'This file is not a valid QBank backup.';
    }
  }

  emptyState(): QbankState {
    return {
      version: 1,
      questions: [],
      tests: [],
      masters: {
        ...EMPTY_MASTERS,
        exams: [...EMPTY_MASTERS.exams],
        subjects: [...EMPTY_MASTERS.subjects],
        papers: EMPTY_MASTERS.papers.map(item => ({ ...item })),
        optionals: [],
        tags: []
      },
      imports: []
    };
  }

  private persist(): void {
    const current = this.state();
    if (!current) return;
    const revision = ++this.latestRevision;
    this.saving.set(true);
    this.saveRequests.next({ revision, state: structuredClone(current) });
  }

  private normalizeState(value: unknown): QbankState {
    const wrapped = isRecord(value) && isRecord(value['data']) ? value['data'] : value;
    if (wrapped === null) return this.emptyState();
    if (!isRecord(wrapped) || !Array.isArray(wrapped['questions']) || !Array.isArray(wrapped['tests'])) {
      throw new Error('Invalid QBank state response.');
    }

    const questions = wrapped['questions'].map(item => {
      if (!isRecord(item) || typeof item['id'] !== 'string') throw new Error('Invalid question in QBank state.');
      return {
        ...item,
        id: item['id'],
        kind: item['kind'] === 'MAINS' ? 'MAINS' : 'PRELIMS',
        en: typeof item['en'] === 'string' ? item['en'] : '',
        options: Array.isArray(item['options'])
          ? item['options'].filter((option): option is string => typeof option === 'string')
          : []
      } as QbankQuestion;
    });
    const tests = wrapped['tests'].map(item => {
      if (!isRecord(item) || typeof item['id'] !== 'string') throw new Error('Invalid test in QBank state.');
      return {
        ...item,
        id: item['id'],
        kind: item['kind'] === 'MAINS' ? 'MAINS' : 'PRELIMS',
        title: typeof item['title'] === 'string' ? item['title'] : '',
        questionIds: Array.isArray(item['questionIds'])
          ? item['questionIds'].filter((id): id is string => typeof id === 'string')
          : []
      } as QbankTest;
    });
    const rawMasters = isRecord(wrapped['masters']) ? wrapped['masters'] : {};
    const tags: QbankTag[] = Array.isArray(rawMasters['tags'])
      ? rawMasters['tags']
        .filter(isRecord)
        .filter((item): item is Record<string, unknown> & Pick<QbankTag, 'category' | 'subCategory' | 'topic' | 'path'> =>
          typeof item['category'] === 'string' &&
          typeof item['subCategory'] === 'string' &&
          typeof item['topic'] === 'string' &&
          typeof item['path'] === 'string'
        )
        .map(item => ({
          kind: item['kind'] === 'MAINS' ? 'MAINS' : 'PRELIMS',
          category: item.category,
          subCategory: item.subCategory,
          topic: item.topic,
          path: item.path
        }))
      : [];

    return {
      ...wrapped,
      version: typeof wrapped['version'] === 'number' ? wrapped['version'] : 1,
      questions,
      tests,
      masters: {
        ...EMPTY_MASTERS,
        ...rawMasters,
        exams: stringArray(rawMasters['exams'], EMPTY_MASTERS.exams),
        subjects: stringArray(rawMasters['subjects'], EMPTY_MASTERS.subjects),
        papers: masterItems(rawMasters['papers'], EMPTY_MASTERS.papers),
        optionals: masterItems(rawMasters['optionals'], []),
        directives: stringArray(rawMasters['directives'], EMPTY_MASTERS.directives),
        tags
      },
      imports: Array.isArray(wrapped['imports'])
        ? wrapped['imports'].filter(isRecord)
        : []
    };
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (isRecord(error) && isRecord(error['error']) && typeof error['error']['message'] === 'string') {
      return error['error']['message'];
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }
}
