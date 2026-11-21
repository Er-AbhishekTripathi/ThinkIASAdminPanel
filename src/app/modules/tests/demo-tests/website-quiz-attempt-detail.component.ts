import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { QuizAttemptQuestion, QuizAttemptText, QuizService, QuizSubmissionDetails } from '../../../shared/services/quiz.service';

@Component({
  selector: 'app-website-quiz-attempt-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatProgressSpinnerModule],
  template: `
    <main class="report-page">
      <header class="report-header">
        <div>
          <a class="back-link" routerLink="/website-quiz-attempts"><mat-icon>arrow_back</mat-icon><span>Website Quiz Attempts</span></a>
          <div class="page-kicker"><mat-icon>fact_check</mat-icon><span>QUESTION-BY-QUESTION REPORT</span></div>
          <h1>Quiz attempt details</h1>
          <p>Review the questions, selected answers, and correct answers for this submission.</p>
        </div>
      </header>

      <div class="loading-state" *ngIf="loading()">
        <mat-spinner diameter="32"></mat-spinner><span>Loading attempt report...</span>
      </div>
      <p class="error-state" *ngIf="!loading() && error()" role="alert">
        <mat-icon>error_outline</mat-icon>{{ error() }}
      </p>

      <ng-container *ngIf="!loading() && submission() as attempt">
        <section class="student-summary">
          <div class="student-info">
            <span class="student-avatar">{{ getInitials(attempt.name) }}</span>
            <div>
              <span class="section-label">STUDENT</span>
              <h2>{{ attempt.name }}</h2>
              <p>{{ attempt.email }}<span *ngIf="attempt.phone"> · {{ attempt.phone }}</span></p>
            </div>
          </div>
          <div class="quiz-info">
            <span class="section-label">WEBSITE QUIZ</span>
            <h2>{{ attempt.quiz?.title || 'Deleted quiz' }}</h2>
            <p>Submitted {{ attempt.submittedAt | date:'MMM d, y · h:mm a' }}</p>
          </div>
        </section>

        <section class="score-summary" aria-label="Attempt score summary">
          <div><span>Score</span><strong>{{ attempt.score }} / {{ attempt.totalQuestions }}</strong></div>
          <div><span>Correct</span><strong class="correct">{{ attempt.correctAnswers }}</strong></div>
          <div><span>Incorrect</span><strong class="incorrect">{{ attempt.wrongAnswers }}</strong></div>
          <div><span>Percentage</span><strong>{{ getScorePercent(attempt) }}%</strong></div>
          <div><span>Time taken</span><strong>{{ formatDuration(attempt.timeTaken) }}</strong></div>
        </section>

        <section class="questions-section">
          <div class="questions-heading">
            <div><h2>Question report</h2><p>{{ attempt.questionOverview?.length || 0 }} questions in this attempt</p></div>
            <span class="legend"><i class="legend-correct"></i>Correct answer <i class="legend-selected"></i>Student's wrong answer</span>
          </div>

          <div class="empty-state" *ngIf="!attempt.questionOverview?.length">
            <mat-icon>quiz</mat-icon>
            <h3>Question report unavailable</h3>
            <p>This submission does not contain a saved question-by-question report.</p>
          </div>

          <article class="question-card" *ngFor="let question of attempt.questionOverview; let i = index">
            <div class="question-heading">
              <div><span class="question-number">Question {{ question.questionNumber || i + 1 }}</span><small *ngIf="question.questionUid">UID: {{ question.questionUid }}</small></div>
              <span class="result-badge" [class.result-correct]="question.isCorrect" [class.result-unanswered]="question.selectedOption < 0">
                {{ getResultLabel(question) }}
              </span>
            </div>

            <div class="question-copy">
              <p *ngIf="getText(question.questionText, 'english')" [innerHTML]="getText(question.questionText, 'english')"></p>
              <p class="hindi-copy" *ngIf="getText(question.questionText, 'hindi')" [innerHTML]="getText(question.questionText, 'hindi')"></p>
            </div>
            <div class="question-description" *ngIf="getText(question.description, 'english') || getText(question.description, 'hindi')">
              <p *ngIf="getText(question.description, 'english')" [innerHTML]="getText(question.description, 'english')"></p>
              <p class="hindi-copy" *ngIf="getText(question.description, 'hindi')" [innerHTML]="getText(question.description, 'hindi')"></p>
            </div>

            <div class="options-list">
              <div class="option-row" *ngFor="let option of question.options"
                [class.correct-option]="option.isCorrect"
                [class.selected-wrong-option]="option.isSelected && !option.isCorrect">
                <span class="option-letter">{{ option.optionLetter }}</span>
                <div class="option-copy">
                  <span *ngIf="getText(option.optionText, 'english')" [innerHTML]="getText(option.optionText, 'english')"></span>
                  <span class="hindi-copy" *ngIf="getText(option.optionText, 'hindi')" [innerHTML]="getText(option.optionText, 'hindi')"></span>
                </div>
                <span class="option-tag" *ngIf="option.isCorrect">Correct answer</span>
                <span class="option-tag selected-tag" *ngIf="option.isSelected">Your answer</span>
              </div>
            </div>
          </article>
        </section>
      </ng-container>
    </main>
  `,
  styles: [`
    :host{display:block;min-height:100vh;background:#f3f6f8;color:#1d303c}
    .report-page{max-width:1180px;margin:0 auto;padding:28px 32px 42px}
    .report-header{padding:24px 28px;border:1px solid #dce6e8;border-left:5px solid #27728a;border-radius:8px;background:linear-gradient(115deg,#fff 0%,#f2f8f8 100%)}
    .back-link{display:inline-flex;align-items:center;gap:5px;color:#52707d;font-size:13px;font-weight:600;text-decoration:none}
    .back-link mat-icon{width:18px;height:18px;font-size:18px}
    .back-link:hover{color:#1d5374}
    .page-kicker{display:flex;align-items:center;gap:7px;margin-top:18px;color:#27728a;font-size:11px;font-weight:700}
    .page-kicker mat-icon{width:17px;height:17px;font-size:17px}
    h1{margin:6px 0 0;color:#163447;font-size:27px;font-weight:700;line-height:1.2}
    .report-header p{margin:7px 0 0;color:#647782;font-size:14px}
    .student-summary{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:18px;padding:20px;border:1px solid #dce5e8;border-radius:8px;background:#fff}
    .student-info{display:flex;align-items:center;gap:13px;min-width:0}
    .student-avatar{display:grid;width:44px;height:44px;flex:0 0 44px;place-items:center;border-radius:50%;background:#e4f1f3;color:#246579;font-size:14px;font-weight:700}
    .student-info h2,.quiz-info h2{margin:4px 0;color:#243b48;font-size:16px}
    .student-info p,.quiz-info p{margin:0;color:#71818a;font-size:12px;overflow-wrap:anywhere}
    .section-label{color:#798991;font-size:10px;font-weight:700;letter-spacing:.07em}
    .quiz-info{padding-left:22px;border-left:1px solid #e8edef}
    .score-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));margin:16px 0 22px;border:1px solid #dce5e8;border-radius:8px;background:#fff}
    .score-summary>div{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:15px 16px;border-right:1px solid #e7edef}
    .score-summary>div:last-child{border-right:0}
    .score-summary span{color:#657780;font-size:11px;font-weight:600}
    .score-summary strong{color:#1d5374;font-size:16px;white-space:nowrap}
    .score-summary .correct{color:#197454}.score-summary .incorrect{color:#b14444}
    .questions-section{border:1px solid #dce5e8;border-radius:8px;background:#fff}
    .questions-heading{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:18px 20px;border-bottom:1px solid #e7edef}
    .questions-heading h2{margin:0;color:#1d3543;font-size:16px}
    .questions-heading p{margin:4px 0 0;color:#768791;font-size:12px}
    .legend{display:flex;align-items:center;gap:6px;color:#687a83;font-size:10px;white-space:nowrap}
    .legend i{width:9px;height:9px;border-radius:2px;background:#e8f4ec}
    .legend .legend-selected{margin-left:7px;background:#fff0ee}
    .question-card{padding:20px;border-bottom:1px solid #e7edef}
    .question-card:last-child{border-bottom:0}
    .question-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .question-number{display:block;color:#1d5374;font-size:13px;font-weight:700}
    .question-heading small{display:block;margin-top:4px;color:#8a989e;font-size:10px}
    .result-badge{padding:5px 9px;border-radius:20px;background:#fff0ee;color:#aa4242;font-size:10px;font-weight:700}
    .result-badge.result-correct{background:#e8f4ec;color:#24734f}
    .result-badge.result-unanswered{background:#f0f2f3;color:#657780}
    .question-copy{margin:14px 0 0;color:#263e4b;font-size:14px;font-weight:600;line-height:1.65}
    .question-copy p,.question-description p{margin:0 0 5px}
    .hindi-copy{font-family:inherit}
    .question-description{margin:10px 0;color:#657780;font-size:12px;line-height:1.6}
    .options-list{display:grid;gap:8px;margin-top:15px}
    .option-row{display:flex;align-items:center;gap:10px;min-height:42px;padding:8px 11px;border:1px solid #e3e9eb;border-radius:6px;background:#fcfdfd}
    .option-row.correct-option{border-color:#b9dbc6;background:#f1f8f3}
    .option-row.selected-wrong-option{border-color:#e6bbbb;background:#fff5f4}
    .option-letter{display:grid;width:25px;height:25px;flex:0 0 25px;place-items:center;border-radius:50%;background:#edf1f2;color:#566a74;font-size:10px;font-weight:700}
    .correct-option .option-letter{background:#dcefe2;color:#28734f}
    .selected-wrong-option .option-letter{background:#f8e1df;color:#a34343}
    .option-copy{display:grid;gap:3px;flex:1;min-width:0;color:#435963;font-size:12px;line-height:1.5}
    .option-tag{padding:4px 7px;border-radius:4px;background:#dcefe2;color:#28734f;font-size:9px;font-weight:700;white-space:nowrap}
    .selected-tag{background:#f8e1df;color:#a34343}
    .empty-state,.loading-state{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:9px;min-height:190px;color:#70818a}
    .empty-state mat-icon{width:30px;height:30px;font-size:30px;color:#97a7ad}
    .empty-state h3,.empty-state p{margin:0}.empty-state h3{color:#294452;font-size:15px}.empty-state p{font-size:12px}
    .loading-state{flex-direction:row}
    .error-state{display:flex;align-items:center;gap:8px;margin:18px 0;padding:12px 14px;border:1px solid #efc5c5;border-radius:6px;background:#fff5f5;color:#a33b3b;font-size:13px}
    @media(max-width:850px){.score-summary{grid-template-columns:repeat(3,minmax(0,1fr))}.score-summary>div:nth-child(3){border-right:0}.score-summary>div:nth-child(n+4){border-top:1px solid #e7edef}}
    @media(max-width:650px){.report-page{padding:16px 12px 28px}.student-summary{grid-template-columns:1fr}.quiz-info{padding:14px 0 0;border-top:1px solid #e8edef;border-left:0}.questions-heading{align-items:flex-start;flex-direction:column}.legend{flex-wrap:wrap}.question-card{padding:16px 13px}.option-row{align-items:flex-start;flex-wrap:wrap}.option-tag{margin-left:35px}}
    @media(max-width:450px){.score-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.score-summary>div:nth-child(odd){border-right:1px solid #e7edef}.score-summary>div:nth-child(even){border-right:0}.score-summary>div:nth-child(n+3){border-top:1px solid #e7edef}.score-summary>div:last-child{grid-column:span 2}}
  `]
})
export class WebsiteQuizAttemptDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private quizService = inject(QuizService);

  submission = signal<QuizSubmissionDetails | null>(null);
  loading = signal(false);
  error = signal('');

  ngOnInit(): void {
    const submissionId = this.route.snapshot.paramMap.get('id');
    if (!submissionId) {
      this.error.set('Quiz submission was not found.');
      return;
    }

    this.loading.set(true);
    this.quizService.getQuizSubmissionDetails(submissionId).subscribe({
      next: submission => {
        this.submission.set(submission);
        this.loading.set(false);
      },
      error: error => {
        this.error.set(error.error?.message || 'Unable to load this quiz report.');
        this.loading.set(false);
      }
    });
  }

  getScorePercent(attempt: QuizSubmissionDetails): number {
    return attempt.totalQuestions
      ? Math.round((attempt.score / attempt.totalQuestions) * 100)
      : 0;
  }

  formatDuration(seconds: number): string {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return minutes ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
  }

  getInitials(name: string): string {
    return (name || 'Student')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  }

  getText(value: string | QuizAttemptText | null | undefined, language: 'english' | 'hindi'): string {
    if (typeof value === 'string') {
      return language === 'english' ? value : '';
    }
    return value?.[language] || '';
  }

  getResultLabel(question: QuizAttemptQuestion): string {
    if (question.selectedOption < 0) return 'Not answered';
    return question.isCorrect ? 'Correct' : 'Incorrect';
  }
}
