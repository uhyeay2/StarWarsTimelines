import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { User } from '../../models/user';
import { AuthService } from '../../services/auth/auth.service';
import { runOperation } from '../../utils/async-operation';
import { LoginPrompt } from '../login-prompt/login-prompt';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-account-settings-page',
  imports: [FormsModule, LoginPrompt],
  templateUrl: './account-settings-page.html',
  styleUrl: './account-settings-page.scss',
})
export class AccountSettingsPage implements OnInit {
  private readonly auth = inject(AuthService);

  readonly account = signal<User | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly displayName = signal('');
  readonly displayNameSaving = signal(false);
  readonly displayNameSaved = signal(false);
  readonly displayNameError = signal<string | null>(null);

  readonly email = signal('');
  readonly emailSaving = signal(false);
  readonly emailSaved = signal(false);
  readonly emailError = signal<string | null>(null);

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly passwordSaving = signal(false);
  readonly passwordSaved = signal(false);
  readonly passwordError = signal<string | null>(null);
  readonly showCurrentPassword = signal(false);
  readonly showNewPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  ngOnInit(): void {
    const currentUser = this.auth.getCurrentUser();
    if (!currentUser) {
      this.loading.set(false);
      this.loadError.set('Log in to manage your account settings.');
      return;
    }

    runOperation({
      busy: this.loading,
      busyValue: true,
      idleValue: false,
      error: this.loadError,
      operation: this.auth.getAccount(currentUser.id),
      onSuccess: (account) => {
        if (account) {
          this.applyAccount(account);
        }
      },
    });
  }

  updateDisplayName(): void {
    const account = this.account();
    if (!account || this.displayNameSaving()) {
      return;
    }
    const name = this.displayName().trim();
    if (!name) {
      this.displayNameError.set('A display name is required.');
      return;
    }

    this.displayNameError.set(null);
    this.displayNameSaved.set(false);
    runOperation({
      busy: this.displayNameSaving,
      busyValue: true,
      idleValue: false,
      error: this.displayNameError,
      operation: this.auth.updateDisplayName(account.id, name),
      onSuccess: (updated) => {
        if (updated) {
          this.applyAccount(updated);
          this.displayNameSaved.set(true);
        }
      },
    });
  }

  updateEmail(): void {
    const account = this.account();
    if (!account || this.emailSaving()) {
      return;
    }
    const email = this.email().trim();
    if (!email) {
      this.emailError.set('An email address is required.');
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      this.emailError.set('Enter a valid email address.');
      return;
    }

    this.emailError.set(null);
    this.emailSaved.set(false);
    runOperation({
      busy: this.emailSaving,
      busyValue: true,
      idleValue: false,
      error: this.emailError,
      operation: this.auth.updateEmail(account.id, email),
      onSuccess: (updated) => {
        if (updated) {
          this.applyAccount(updated);
          this.emailSaved.set(true);
        }
      },
    });
  }

  updatePassword(): void {
    const account = this.account();
    if (!account || this.passwordSaving()) {
      return;
    }
    if (!this.currentPassword()) {
      this.passwordError.set('Enter your current password.');
      return;
    }
    if (!this.newPassword()) {
      this.passwordError.set('Enter a new password.');
      return;
    }
    if (this.newPassword().length < 6) {
      this.passwordError.set('The new password must be at least six characters long.');
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.passwordError.set('The passwords do not match.');
      return;
    }

    this.passwordError.set(null);
    this.passwordSaved.set(false);
    runOperation({
      busy: this.passwordSaving,
      busyValue: true,
      idleValue: false,
      error: this.passwordError,
      operation: this.auth.updatePassword(account.id, this.currentPassword(), this.newPassword()),
      onSuccess: () => {
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.passwordSaved.set(true);
      },
    });
  }

  private applyAccount(account: User): void {
    this.account.set(account);
    this.displayName.set(account.displayName);
    this.email.set(account.email ?? '');
  }
}
