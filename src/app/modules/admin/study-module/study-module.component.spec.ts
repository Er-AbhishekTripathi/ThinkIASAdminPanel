import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { ModuleService } from '../../../shared/services/module.service';
import { ModuleTestService } from '../../../shared/services/module-test.service';
import { QuestionService } from '../../../shared/services/question.service';

import { findOwningModule, StudyModuleComponent } from './study-module.component';
import { ModuleTestDialogComponent } from './module-test-dialog/module-test-dialog.component';

describe('StudyModuleComponent', () => {
  let component: StudyModuleComponent;
  let fixture: ComponentFixture<StudyModuleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudyModuleComponent],
      providers: [
        { provide: ModuleService, useValue: { getAdminModules: () => of([]) } },
        {
          provide: ModuleTestService,
          useValue: {
            getAdminModuleTestsByModule: () => of([]),
            createModuleTest: () => of({}),
            updateModuleTest: () => of({}),
            deleteModuleTest: () => of({}),
            toggleModuleTestActive: () => of({})
          }
        },
        { provide: QuestionService, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: MatSnackBar, useValue: { open: () => {} } },
        {
          provide: MatDialog,
          useValue: { open: () => ({ afterClosed: () => of(false) }) }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudyModuleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('resolves a module from its nested folder navigation path', () => {
    const module = { _id: 'module-1', type: 'module' } as any;
    const folder = { _id: 'folder-1', type: 'folder' } as any;

    expect(findOwningModule(folder, [module])).toBe(module);
  });

  it('passes the current module ID when opening Create Test directly', () => {
    const module = { _id: 'module-1', type: 'module' } as any;
    const openDialog = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({
      afterClosed: () => of(false)
    } as any);
    component.currentItem = module;

    component.openCreateTestModalForModule();

    expect(openDialog).toHaveBeenCalledWith(ModuleTestDialogComponent, jasmine.objectContaining({
      data: { moduleId: 'module-1', test: null }
    }));
  });
});
