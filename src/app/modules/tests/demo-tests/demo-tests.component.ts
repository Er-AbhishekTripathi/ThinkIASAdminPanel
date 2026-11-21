import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';

import { DemoTestService } from '../../../shared/services/demo-test.service';
import { DemoTestDialogComponent } from './demo-test-dialog/demo-test-dialog.component';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { timeout } from 'rxjs';

@Component({
  selector: 'app-demo-tests',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormsModule,
    ReactiveFormsModule,
    DemoTestDialogComponent
  ],
  templateUrl: './demo-tests.component.html',
  styleUrl: './demo-tests.component.css'
})
export class DemoTestsComponent implements OnInit {
  private demoTestService = inject(DemoTestService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private confirmDialog = inject(ConfirmDialogService);

  tests = signal<any[]>([]);
  filteredTests = signal<any[]>([]);
  loading = signal(false);
  isFormVisible = signal(false);
  selectedTest = signal<any | null>(null);
  
  // Search and filter
  searchTerm = '';
  statusFilter = 'all';
  
  ngOnInit() {
    this.loadDemoTests();
  }

  loadDemoTests() {
    this.loading.set(true);
    this.demoTestService.getDemoTests().pipe(timeout(10000)).subscribe({
      next: (tests) => {
        this.tests.set(tests);
        this.filterTests();
        this.loading.set(false);
      },
      error: (error) => {
        this.snackBar.open('Error loading demo tests', 'Close', { duration: 3000 });
        this.loading.set(false);
      }
    });
  }

  filterTests() {
    let filtered = [...this.tests()];
    
    // Apply search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(test => 
        test.title?.toLowerCase().includes(term) ||
        test.description?.toLowerCase().includes(term)
      );
    }
    
    // Apply status filter
    if (this.statusFilter !== 'all') {
      const isActive = this.statusFilter === 'active';
      filtered = filtered.filter(test => test.isActive === isActive);
    }
    
    this.filteredTests.set(filtered);
  }

  showCreateForm() {
    this.selectedTest.set(null);
    this.isFormVisible.set(true);
  }

  hideForm() {
    this.isFormVisible.set(false);
    this.selectedTest.set(null);
  }

  onDemoTestSaved() {
    this.hideForm();
    this.loadDemoTests();
  }

  openCreateDemoTestDialog(test?: any) {
    this.selectedTest.set(test || null);
    this.isFormVisible.set(true);
    setTimeout(() => {
      document.querySelector('.form-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  editDemoTest(test: any) {
    this.openCreateDemoTestDialog(test);
  }

  deleteDemoTest(testId: string) {
    this.confirmDialog.ask({title: 'Delete demo test?', message: 'This will also delete all associated results. This action cannot be undone.'}).subscribe(() => {
      this.demoTestService.deleteDemoTest(testId).subscribe({
        next: () => {
          this.snackBar.open('Demo test deleted successfully', 'Close', { duration: 3000 });
          this.loadDemoTests();
        },
        error: (error) => {
          this.snackBar.open('Error deleting demo test: ' + error.error?.message, 'Close', { duration: 3000 });
        }
      });
    });
  }

  toggleDemoTestStatus(test: any) {
    const newStatus = !test.isActive;
    const action = newStatus ? 'activate' : 'deactivate';

    this.confirmDialog.ask({
      title: `${newStatus ? 'Activate' : 'Deactivate'} demo test?`,
      message: `Are you sure you want to ${action} this demo test?`,
      confirmText: newStatus ? 'Activate' : 'Deactivate',
      icon: newStatus ? 'toggle_on' : 'toggle_off'
    }).subscribe(() => {
      this.demoTestService.toggleDemoTestStatus(test._id).subscribe({
        next: (updatedTest) => {
          // Update local state
          const updatedTests = this.tests().map(t => 
            t._id === test._id ? { ...t, isActive: updatedTest.test.isActive } : t
          );
          this.tests.set(updatedTests);
          this.filterTests();
          
          this.snackBar.open(
            `Demo test ${action}d successfully`,
            'Close',
            { duration: 3000 }
          );
        },
        error: (error) => {
          this.snackBar.open(`Error ${action}ing demo test`, 'Close', { duration: 3000 });
        }
      });
    });
  }

  viewResults(test: any) {
    this.router.navigate(['/demo-test-thinkcivil-ias', test._id, 'results']);
  }

  previewDemoTest(test: any) {
    this.router.navigate(['/take-demo-test', test._id]);
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }
}