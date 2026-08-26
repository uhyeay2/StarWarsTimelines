import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { runOperation } from '../../../../shared/utils/async-operation';
import { passwordVisibility } from '../../../../shared/utils/password-visibility';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-register-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './register-page.html',
  styleUrl: './register-page.scss',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);

  readonly username = signal('');
  readonly displayName = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly registeredEmail = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly passwordVisibility = passwordVisibility(this.showPassword);
  readonly confirmPasswordVisibility = passwordVisibility(this.showConfirmPassword);
  readonly passwordsMatch = computed(
    () => this.confirmPassword() === '' || this.confirmPassword() === this.password(),
  );

  submit(): void {
    if (this.submitting()) {
      return;
    }
    this.error.set(null);
    if (!this.passwordsMatch()) {
      return;
    }
    const validationError = this.validate();
    if (validationError) {
      this.error.set(validationError);
      return;
    }

    runOperation({
      busy: this.submitting,
      busyValue: true,
      idleValue: false,
      error: this.error,
      operation: this.auth.register({
        username: this.username().trim(),
        ...(this.displayName().trim() && { displayName: this.displayName().trim() }),
        email: this.email().trim(),
        password: this.password(),
      }),
      onSuccess: () => this.registeredEmail.set(this.email().trim()),
    });
  }

  private validate(): string | null {
    if (!this.username().trim()) {
      return 'A username is required.';
    }
    if (!this.email().trim()) {
      return 'An email address is required.';
    }
    if (!EMAIL_PATTERN.test(this.email().trim())) {
      return 'Enter a valid email address.';
    }
    if (!this.password()) {
      return 'A password is required.';
    }
    if (this.password().length < 6) {
      return 'The password must be at least six characters long.';
    }
    if (this.password() !== this.confirmPassword()) {
      return 'The passwords do not match.';
    }
    return null;
  }
}
