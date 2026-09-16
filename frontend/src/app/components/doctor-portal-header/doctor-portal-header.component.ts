import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LucideChevronDown } from '@lucide/angular';
import { DoctorAuthService } from '../../services/doctor-auth.service';

@Component({
  selector: 'app-doctor-portal-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './doctor-portal-header.component.html',
  styleUrl: './doctor-portal-header.component.css'
})
export class DoctorPortalHeaderComponent {
  readonly chevronDownIcon = LucideChevronDown.icon.node;
  accountMenuOpen = false;

  private readonly doctorAuth = inject(DoctorAuthService);
  private readonly router = inject(Router);

  readonly displayName = this.doctorAuth.displayName;

  toggleAccountMenu(event: Event): void {
    event.stopPropagation();
    this.accountMenuOpen = !this.accountMenuOpen;
  }

  closeAccountMenu(): void {
    this.accountMenuOpen = false;
  }

  logout(): void {
    this.accountMenuOpen = false;
    this.doctorAuth.logout();
    void this.router.navigate(['/lekar/prijava']);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.accountMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.accountMenuOpen = false;
  }
}
