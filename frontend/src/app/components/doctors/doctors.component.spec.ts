import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DoctorsComponent } from './doctors.component';
import { Doctor } from '../../services/doctor.service';

describe('DoctorsComponent name search', () => {
  let component: DoctorsComponent;
  let fixture: ComponentFixture<DoctorsComponent>;

  const doctors: Doctor[] = [
    {
      id: 1,
      firstName: 'Ana',
      lastName: 'Ilić',
      biography: null,
      imageUrl: null,
      specialty: { id: 3, name: 'Endokrinologija' },
      averageRating: null,
      reviewCount: 0
    },
    {
      id: 2,
      firstName: 'Aleksandar',
      lastName: 'Petrović',
      biography: null,
      imageUrl: null,
      specialty: { id: 1, name: 'Kardiologija' },
      averageRating: null,
      reviewCount: 0
    },
    {
      id: 3,
      firstName: 'Jelena',
      lastName: 'Marković',
      biography: null,
      imageUrl: null,
      specialty: { id: 1, name: 'Kardiologija' },
      averageRating: null,
      reviewCount: 0
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoctorsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(DoctorsComponent);
    component = fixture.componentInstance;
    component.doctors = doctors;
    component.isLoading = false;
    fixture.detectChanges();
  });

  function names(): string[] {
    return component.filteredDoctors.map((doctor) => `${doctor.firstName} ${doctor.lastName}`);
  }

  function typeSearch(value: string): void {
    const input = fixture.nativeElement.querySelector('#doctor-search') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  it('matches first name Ana case-insensitively', () => {
    typeSearch('Ana');
    expect(names()).toEqual(['Ana Ilić']);

    typeSearch('ana');
    expect(names()).toEqual(['Ana Ilić']);
  });

  it('matches surname and partial surname', () => {
    typeSearch('Petrović');
    expect(names()).toEqual(['Aleksandar Petrović']);

    typeSearch('pet');
    expect(names()).toEqual(['Aleksandar Petrović']);
  });

  it('matches full name', () => {
    typeSearch('Aleksandar Petrović');
    expect(names()).toEqual(['Aleksandar Petrović']);
  });

  it('shows empty state for a nonexistent name and restores when cleared', () => {
    typeSearch('xyz');
    expect(names()).toEqual([]);

    typeSearch('');
    expect(names().length).toBe(3);
  });

  it('combines name search with specialty', () => {
    component.selectedSpecialtyId = '1';
    typeSearch('pet');
    expect(names()).toEqual(['Aleksandar Petrović']);

    typeSearch('Ana');
    expect(names()).toEqual([]);
  });

  it('trims whitespace in the query', () => {
    typeSearch('  Ana  ');
    expect(names()).toEqual(['Ana Ilić']);
  });

  it('selects a specialty from the custom dropdown and can reset it', () => {
    component.specialties = [
      { id: 1, name: 'Kardiologija' },
      { id: 3, name: 'Endokrinologija' }
    ];
    fixture.detectChanges();

    component.selectSpecialty('3');
    expect(component.selectedSpecialtyId).toBe('3');
    expect(component.specialtyMenuOpen).toBe(false);
    expect(names()).toEqual(['Ana Ilić']);

    component.selectSpecialty('');
    expect(names().length).toBe(3);
  });
});
