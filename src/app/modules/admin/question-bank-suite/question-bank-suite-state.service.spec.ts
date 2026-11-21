import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environment/environment';
import { QuestionBankSuiteStateService } from './question-bank-suite-state.service';

describe('QuestionBankSuiteStateService', () => {
  let service: QuestionBankSuiteStateService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(QuestionBankSuiteStateService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the existing QBank state without dropping stored questions or tests', () => {
    service.initialize();

    const request = http.expectOne(`${environment.apiUrl}/qbank/state`);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBeTrue();
    request.flush({
      version: 1,
      questions: [{ id: 'q-1', kind: 'PRELIMS', en: 'Question', tags: ['polity'] }],
      tests: [{ id: 't-1', kind: 'PRELIMS', title: 'Test', questionIds: ['q-1'] }],
      masters: { exams: ['UPSC CSE'], subjects: ['Polity'], papers: [], optionals: [], directives: [] },
      imports: []
    });

    expect(service.questions().map(question => question.id)).toEqual(['q-1']);
    expect(service.tests().map(test => test.id)).toEqual(['t-1']);
    expect(service.questions()[0].tags).toEqual(['polity']);
  });

  it('surfaces load errors instead of replacing unavailable server data', () => {
    service.initialize();
    http.expectOne(`${environment.apiUrl}/qbank/state`).flush({}, {
      status: 503,
      statusText: 'Service Unavailable'
    });

    expect(service.state()).toBeNull();
    expect(service.error()).toBeTruthy();
    http.expectNone(request => request.method === 'PUT');
  });
});
