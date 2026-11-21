import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { QuestionBankSuiteStateService } from './question-bank-suite-state.service';

@Component({
  selector: 'app-question-bank-suite',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './question-bank-suite.component.html',
  styleUrl: './question-bank-suite.component.css'
})
export class QuestionBankSuiteComponent implements OnInit {
  readonly state = inject(QuestionBankSuiteStateService);

  ngOnInit(): void {
    this.state.initialize();
  }
}
