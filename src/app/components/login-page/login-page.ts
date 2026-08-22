import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthError } from '../../models/auth/auth-error';
import { AuthService } from '../../services/auth/auth.service';
import { runOperation } from '../../utils/async-operation';

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
    runOperation({
      busy: this.submitting,
      busyValue: true,
      idleValue: false,
      error: this.error,
      onError: (err) => {
        this.needsVerification.set(err instanceof AuthError && err.code === 'email-not-verified');
      },
      operation: this.auth.login(this.username(), this.password()),
      onSuccess: (user) => {
        if (user) {
          this.router.navigateByUrl('/library');
        }
      },
    });
  }

  resendVerification(): void {
    if (this.resending()) {
      return;
    }
    this.error.set(null);
    this.verificationSent.set(false);
    runOperation({
      busy: this.resending,
      busyValue: true,
      idleValue: false,
      error: this.error,
      operation: this.auth.resendVerificationEmail(this.username().trim()),
      onSuccess: () => this.verificationSent.set(true),
    });
  }
}
