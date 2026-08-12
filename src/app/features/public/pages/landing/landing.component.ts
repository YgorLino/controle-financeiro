import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingPageComponent implements OnInit {
  private titleService = inject(Title);
  private metaService = inject(Meta);
  public auth = inject(AuthService);
  
  currentYear = new Date().getFullYear();
  isScrolled = false;
  isMobileMenuOpen = false;
  activeDemoTab: 'visao' | 'movimentacoes' | 'recorrencias' | 'categorias' = 'visao';

  ngOnInit() {
    this.titleService.setTitle('Controle Financeiro | Organize sua vida financeira');
    this.metaService.updateTag({ name: 'description', content: 'Controle entradas, despesas, contas e recorrências em um painel simples. Experimente gratuitamente por 3 dias, sem cartão.' });
    this.metaService.updateTag({ property: 'og:title', content: 'Controle Financeiro | Organize sua vida financeira' });
    this.metaService.updateTag({ property: 'og:description', content: 'Controle entradas, despesas, contas e recorrências em um painel simples. Experimente gratuitamente por 3 dias, sem cartão.' });

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', () => {
        this.isScrolled = window.scrollY > 20;
      });
    }
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  setDemoTab(tab: 'visao' | 'movimentacoes' | 'recorrencias' | 'categorias') {
    this.activeDemoTab = tab;
  }
}
