import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrelimsTestSeriesComponent } from './prelims-test-series.component';

describe('PrelimsTestSeriesComponent', () => {
  let component: PrelimsTestSeriesComponent;
  let fixture: ComponentFixture<PrelimsTestSeriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrelimsTestSeriesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrelimsTestSeriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('validates rich-text description content instead of its HTML markup', () => {
    const description = component.testSeriesForm.get('description')!;

    description.setValue('<p>&nbsp;</p>');
    expect(description.hasError('required')).toBe(true);

    description.setValue('<p>abc</p>');
    expect(description.hasError('minlength')).toBe(true);

    description.setValue('<p>abcdefghij</p>');
    expect(description.valid).toBe(true);
  });

  it('tracks the shared question selection for the series', () => {
    component.toggleSeriesQuestion('question-1', true);
    component.toggleSeriesQuestion('question-2', true);

    expect(component.selectedSeriesQuestionIds).toEqual(['question-1', 'question-2']);

    component.toggleSeriesQuestion('question-1', false);
    expect(component.selectedSeriesQuestionIds).toEqual(['question-2']);
  });
});
