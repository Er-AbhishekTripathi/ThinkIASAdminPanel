import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

function richTextContentLength(value: unknown): number {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&(?:amp|lt|gt|quot|#39);/gi, 'x')
    .replace(/\s+/g, ' ')
    .trim()
    .length;
}

export const richTextRequired: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  richTextContentLength(control.value) ? null : { required: true };

export function richTextMinLength(minimum: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const actualLength = richTextContentLength(control.value);
    return actualLength && actualLength < minimum
      ? { minlength: { requiredLength: minimum, actualLength } }
      : null;
  };
}
