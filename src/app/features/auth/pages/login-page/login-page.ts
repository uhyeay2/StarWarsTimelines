import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthError } from '../../models/auth-error';
import { ROUTES } from '../../../../shared/constants/routes.constants';
import { AuthService } from '../../services/auth.service';
import { runOperation } from '../../../../shared/utils/async-operation';
import { passwordVisibility } from '../../../../shared/utils/password-visibility';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  readonly passwordVisibility = passwordVisibility(this.showPassword);
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
          void this.router.navigateByUrl(ROUTES.LIBRARY);
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
