import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../shared/services/auth.service';
import { TestService } from '../../shared/services/test.service';
import { PaymentDialogComponent } from './payment-dialog/payment-dialog.component';
import { UserService } from '../../shared/services/user.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TranslatePipe, 
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    RouterLink
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private testService = inject(TestService);
    private userService = inject(UserService);

  private router = inject(Router);
  private dialog = inject(MatDialog);

  currentUser = this.authService.currentUser;
  upcomingTests = signal<any[]>([]);
  recentResults = signal<any[]>([]);
  completedTestsCount = signal<number>(0);
  totalTestsCount = signal<number>(0);
  totalStudentsCount = signal<number>(0);
  totalResultsCount = signal<number>(0);
  
  loading = signal<boolean>(true);
  statisticsError = signal('');

  ngOnInit() {
    const user = this.currentUser();
    
    if (user?.role === 'student') {
      if (user.type === 'fresh') {
        this.loadFreshStudentData();
      } else if (user.type === 'pre') {
        this.loadPreStudentData();
      }
    } else if (user?.role === 'admin') {
      this.loadAdminData();
    }
  }

  // Open payment dialog
  openPaymentDialog(plan: 'pre' | 'mains' | 'combo') {
    const dialogRef = this.dialog.open(PaymentDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      data: { selectedPlan: plan },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Payment was successful, reload user data
        console.log('Payment completed successfully');
        // You can add logic here to refresh the user data if needed
      } else {
        console.log('Payment cancelled');
      }
    });
  }

  loadFreshStudentData() {
    this.loading.set(true);
    
    setTimeout(() => {
      this.loading.set(false);
    }, 1000);

    // this.testService.getUpcomingTests().subscribe({
    //   next: (tests) => {
    //     this.upcomingTests.set(tests.slice(0, 2));
    //   },
    //   error: (error) => {
    //     console.error('Error loading upcoming tests:', error);
    //   }
    // });
  }

  loadPreStudentData() {
    this.loading.set(true);
    
    this.testService.getUpcomingTests().subscribe({
      next: (tests) => {
        this.upcomingTests.set(tests.slice(0, 3));
      },
      error: (error) => {
        console.error('Error loading upcoming tests:', error);
      }
    });

    this.testService.getStudentResults().subscribe({
      next: (results) => {
        this.recentResults.set(results.slice(0, 5));
        this.completedTestsCount.set(results.length);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading student results:', error);
        this.loading.set(false);
      }
    });
  }

  loadAdminData() {
    this.loading.set(true);
    this.statisticsError.set('');
    
    this.testService.getPlatformStatistics().subscribe({
      next: (stats) => {
        if (![stats?.totalStudents, stats?.totalResults, stats?.totalTests].every(value => Number.isInteger(value) && value >= 0)) {
          this.statisticsError.set('Dashboard counts could not be loaded. Please retry.');
          this.loading.set(false);
          return;
        }
        this.totalStudentsCount.set(stats.totalStudents);
        this.totalResultsCount.set(stats.totalResults);
        this.totalTestsCount.set(stats.totalTests);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading platform statistics:', error);
        this.statisticsError.set('Dashboard counts could not be loaded. Please retry.');
        this.loading.set(false);
      }
    });
  }

  getRecentPerformance(): string {
    const results = this.recentResults();
    if (results.length === 0) return 'No tests taken yet';
    
    const avgPercentage = results.reduce((sum, result) => sum + parseFloat(result.percentage), 0) / results.length;
    return `Average: ${avgPercentage.toFixed(1)}%`;
  }

  navigateToStudentsList() {
    this.router.navigate(['/students-list']);
  }

  // getMe(){
  //   this.userService.getMe().subscribe({
  //     next: (results:any) => {
  //       console.log(results)
  //     },
  //     error: (error:any) => {
  //       // console.error('Error loading results:', error);
  //       // this.loading.set(false);
  //     }
  //   });
  // }
}
