import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly username = signal('');
  readonly password = signal('');
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  login(): void {
    if (this.submitting()) {
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.auth
      .login(this.username(), this.password())
      .pipe(
        catchError((err: Error) => {
          this.error.set(err.message);
          return of(null);
        }),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe((user) => {
        if (user) {
          this.router.navigateByUrl('/library');
        }
      });
  }
}
