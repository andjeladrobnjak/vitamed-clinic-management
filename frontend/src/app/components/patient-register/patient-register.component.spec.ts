import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { PatientRegisterComponent } from './patient-register.component';

describe('PatientRegisterComponent', () => {
  let component: PatientRegisterComponent;
  let fixture: ComponentFixture<PatientRegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientRegisterComponent],
      providers: [provideRouter([]), provideHttpClient()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
