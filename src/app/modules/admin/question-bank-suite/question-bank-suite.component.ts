import { Component, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AdminExam, ExamAdminService } from '../../../shared/services/exam-admin.service';

@Component({
  selector: 'app-question-bank-suite',
  standalone: true,
  imports: [],
  templateUrl: './question-bank-suite.component.html',
  styleUrl: './question-bank-suite.component.css'
})
export class QuestionBankSuiteComponent implements OnDestroy {
  suiteUrl: SafeResourceUrl;
  private exams: AdminExam[] = [];
  private examsLoaded = false;
  private examsLoadError = false;
  private dashboardObserver?: MutationObserver;

  constructor(
    private sanitizer: DomSanitizer,
    private router: Router,
    private examService: ExamAdminService
  ) {
    this.suiteUrl = this.suiteResourceUrl(this.router.url);
    this.examService.getAll().subscribe({
      next: response => {
        this.exams = response.data || [];
        this.examsLoaded = true;
        this.sendExamOptions();
      },
      error: error => {
        this.examsLoadError = true;
        console.error('Error loading question-bank-suite exams:', error);
        this.sendExamOptions();
      }
    });
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => {
      this.suiteUrl = this.suiteResourceUrl(this.router.url);
    });
  }

  onFrameLoad(event: Event): void {
    const frame = event.target as HTMLIFrameElement;
    this.sendExamOptions(frame);
    this.addTestSeriesLinks(frame);
  }

  ngOnDestroy(): void {
    this.dashboardObserver?.disconnect();
  }

  private addTestSeriesLinks(frame: HTMLIFrameElement): void {
    const frameDocument = frame.contentDocument;
    if (!frameDocument?.body) return;

    this.dashboardObserver?.disconnect();
    const addLinks = () => {
      if (!/\/dashboard(?:[/?]|$)/.test(frame.contentWindow?.location.hash || '')) return;

      const importLinks = frameDocument.querySelectorAll<HTMLAnchorElement>('a.btn[href]');
      importLinks.forEach(importLink => {
        const match = importLink.getAttribute('href')?.match(/\/(prelims|mains)\/import$/);
        const kind = match?.[1];
        const actions = importLink.parentElement;
        if (!kind || !actions || actions.querySelector(`[data-test-series-link="${kind}"]`)) return;

        const testSeriesLink = frameDocument.createElement('a');
        testSeriesLink.className = importLink.className;
        testSeriesLink.href = `#/${kind}/tests?view=test-series`;
        testSeriesLink.textContent = 'Test Series';
        testSeriesLink.dataset['testSeriesLink'] = kind;

        const testsLink = Array.from(actions.querySelectorAll<HTMLAnchorElement>('a.btn[href]'))
          .find(link => link.getAttribute('href')?.endsWith(`/${kind}/tests`));
        if (testsLink) {
          testsLink.insertAdjacentElement('afterend', testSeriesLink);
        } else {
          importLink.insertAdjacentElement('beforebegin', testSeriesLink);
        }
      });
    };

    this.dashboardObserver = new MutationObserver(addLinks);
    this.dashboardObserver.observe(frameDocument.body, { childList: true, subtree: true });
    addLinks();
  }

  private sendExamOptions(frame?: HTMLIFrameElement): void {
    if (!this.examsLoaded && !this.examsLoadError) return;
    const target = frame || document.querySelector<HTMLIFrameElement>('.question-bank-frame');
    target?.contentWindow?.postMessage({
      type: 'question-bank-suite-exams',
      exams: this.exams.map(exam => ({ name: exam.name })),
      error: this.examsLoadError
    }, window.location.origin);
  }

  private suiteResourceUrl(url: string): SafeResourceUrl {
    const route = url.split('?')[0].split('/').filter(Boolean);
    const page = route.length >= 2 && route[0] === 'question-bank-suite'
      ? `/${route[1]}/${route[2] || 'dashboard'}`
      : '/dashboard';
    const standalonePage = route[1] === 'setup' && route[2] === 'tags' ? '/tags'
      : route[1] === 'setup' && route[2] === 'settings' ? '/settings'
      : route[1] === 'prelims' && route[2] === 'test-series' && route[3] === 'create' ? '/prelims/tests?view=series-create'
      : route[1] === 'prelims' && route[2] === 'test-series' && route[3] ? `/prelims/tests?view=series-editor&id=${encodeURIComponent(route[3])}`
      : route[1] === 'prelims' && route[2] === 'test-series' ? '/prelims/tests?view=test-series'
      : route[1] === 'mains' && route[2] === 'test-series' && route[3] === 'create' ? '/mains/tests?view=series-create'
      : route[1] === 'mains' && route[2] === 'test-series' && route[3] ? `/mains/tests?view=series-editor&id=${encodeURIComponent(route[3])}`
      : route[1] === 'mains' && route[2] === 'test-series' ? '/mains/tests?view=test-series'
      : page;
    return this.sanitizer.bypassSecurityTrustResourceUrl(`/question-bank-suite.html#${standalonePage}`);
  }
}
