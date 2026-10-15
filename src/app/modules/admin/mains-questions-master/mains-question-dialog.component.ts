import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { MainsQuestion, MainsQuestionInput, MainsQuestionService } from '../../../shared/services/mains-question.service';
import { TagResponse } from '../../../shared/services/tag.service';

interface MainsQuestionDialogData {
  question: MainsQuestion | null;
  tags: TagResponse[];
}

@Component({
  selector: 'app-mains-question-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    CKEditorModule
  ],
  templateUrl: './mains-question-dialog.component.html',
  styleUrl: './mains-question-dialog.component.css'
})
export class MainsQuestionDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<MainsQuestionDialogComponent>);
  private questionService = inject(MainsQuestionService);
  private snackBar = inject(MatSnackBar);
  readonly data = inject<MainsQuestionDialogData>(MAT_DIALOG_DATA);
  readonly Editor = ClassicEditor;
  readonly editorConfig = {
    toolbar: ['heading', '|', 'bold', 'italic', 'underline', '|', 'bulletedList', 'numberedList', '|', 'link', 'insertTable', '|', 'undo', 'redo']
  };
  saving = false;
  form = this.fb.group({
    english: [this.data.question?.question.english || '', [Validators.required]],
    hindi: [this.data.question?.question.hindi || ''],
    tags: [(this.data.question?.tags || []).map(tag => tag._id)]
  });

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload: MainsQuestionInput = {
      question: {
        english: value.english?.trim() || '',
        hindi: value.hindi?.trim() || ''
      },
      tags: value.tags || []
    };
    this.saving = true;
    const request = this.data.question
      ? this.questionService.updateQuestion(this.data.question._id, payload)
      : this.questionService.createQuestion(payload);
    request.subscribe({
      next: () => this.dialogRef.close(true),
      error: error => {
        console.error('Unable to save Mains question:', error);
        this.snackBar.open(error.error?.message || 'Unable to save question.', 'Close', { duration: 4000 });
        this.saving = false;
      }
    });
  }
}
