import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MainsTestSeriesComponent } from './mains-test-series.component';

describe('MainsTestSeriesComponent', () => {
  let component: MainsTestSeriesComponent;
  let fixture: ComponentFixture<MainsTestSeriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainsTestSeriesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MainsTestSeriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('tracks the shared Mains question selection for the series', () => {
    component.toggleSeriesQuestion('question-1', true);
    component.toggleSeriesQuestion('question-2', true);

    expect(component.selectedSeriesQuestionIds).toEqual(['question-1', 'question-2']);

    component.toggleSeriesQuestion('question-1', false);
    expect(component.selectedSeriesQuestionIds).toEqual(['question-2']);
  });
});
