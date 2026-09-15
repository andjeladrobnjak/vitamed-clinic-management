import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ClinicServicesComponent } from './clinic-services.component';

describe('ClinicServicesComponent', () => {
  let component: ClinicServicesComponent;
  let fixture: ComponentFixture<ClinicServicesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClinicServicesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ClinicServicesComponent);
    component = fixture.componentInstance;
    component.specialties = [
      { id: 1, name: 'Kardiologija', slug: 'kardiologija' },
      { id: 4, name: 'Ginekologija', slug: 'ginekologija' }
    ];
    component.isLoading = false;
  });

  it('builds a specialty detail link from the specialty slug', () => {
    expect(component.specialtySlug(component.specialties[0])).toBe('kardiologija');
  });
});
