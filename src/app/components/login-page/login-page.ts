import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { AuthError } from '../../models/auth/auth-error';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink],
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
  readonly showPassword = signal(false);
  readonly needsVerification = signal(false);
  readonly verificationSent = signal(false);
  readonly resending = signal(false);

  login(): void {
    if (this.submitting()) {
      return;
    }
    this.error.set(null);
    this.needsVerification.set(false);
    this.verificationSent.set(false);
    this.submitting.set(true);
    this.auth
      .login(this.username(), this.password())
      .pipe(
        catchError((err: Error) => {
          this.error.set(err.message);
          this.needsVerification.set(err instanceof AuthError && err.code === 'email-not-verified');
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

  resendVerification(): void {
    if (this.resending()) {
      return;
    }
    this.resending.set(true);
    this.error.set(null);
    this.verificationSent.set(false);
    this.auth
      .resendVerificationEmail(this.username().trim())
      .pipe(
        catchError((err: Error) => {
          this.error.set(err.message);
          return of(undefined);
        }),
        finalize(() => this.resending.set(false)),
      )
      .subscribe(() => {
        if (this.error() === null) {
          this.verificationSent.set(true);
        }
      });
  }
}
