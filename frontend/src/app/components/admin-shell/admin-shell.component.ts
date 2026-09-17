import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideUserRound } from '@lucide/angular';
import { AdminAuthService } from '../../services/admin-auth.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.css'
})
export class AdminShellComponent {
  readonly userIcon = LucideUserRound.icon.node;
  accountMenuOpen = false;

  private readonly adminAuth = inject(AdminAuthService);
  private readonly router = inject(Router);

  readonly admin = this.adminAuth.admin;

  toggleAccountMenu(event: Event): void {
    event.stopPropagation();
    this.accountMenuOpen = !this.accountMenuOpen;
  }

  closeAccountMenu(): void {
    this.accountMenuOpen = false;
  }

  logout(): void {
    this.accountMenuOpen = false;
    this.adminAuth.logout();
    void this.router.navigate(['/admin/prijava']);
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
