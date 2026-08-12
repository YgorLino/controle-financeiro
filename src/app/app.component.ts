// src/app/app.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { AutoLogoutService } from './core/services/auto-logout.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly autoLogoutService = inject(AutoLogoutService); // Initialize auto logout

  ngOnInit(): void {
    // ThemeService se auto-inicializa via effect() no construtor
    // Garante que o tema salvo seja aplicado imediatamente
  }
}
