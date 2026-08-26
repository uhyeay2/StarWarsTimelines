import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  Signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { User } from '../../../../shared/models/user';
import { AccountService } from '../../../auth/services/account.service';
import { AuthService } from '../../../auth/services/auth.service';
import { runOperation } from '../../../../shared/utils/async-operation';
import { LoginPrompt } from '../../../../shared/components/login-prompt/login-prompt';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PasswordVisibility {
  readonly inputType: Signal<'text' | 'password'>;
  readonly toggleAriaLabel: Signal<string>;
  readonly toggleText: Signal<string>;
}

function passwordVisibility(show: Signal<boolean>): PasswordVisibility {
  return {
    inputType: computed(() => (show() ? 'text' : 'password')),
    toggleAriaLabel: computed(() => (show() ? 'Hide password' : 'Show password')),
    toggleText: computed(() => (show() ? 'Hide' : 'Show')),
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-account-settings-page',
  imports: [FormsModule, LoginPrompt],
  templateUrl: './account-settings-page.html',
  styleUrl: './account-settings-page.scss',
})
export class AccountSettingsPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly accountService = inject(AccountService);

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

  readonly currentPasswordVisibility = passwordVisibility(this.showCurrentPassword);
  readonly newPasswordVisibility = passwordVisibility(this.showNewPassword);
  readonly confirmPasswordVisibility = passwordVisibility(this.showConfirmPassword);

  readonly displayNameButtonLabel = computed(() =>
    this.displayNameSaving() ? 'Saving…' : 'Save display name',
  );
  readonly emailVerified = computed(() => this.account()?.emailVerified ?? false);
  readonly emailBadgeClass = computed(() =>
    this.emailVerified()
      ? 'settings-badge settings-badge--verified'
      : 'settings-badge settings-badge--unverified',
  );
  readonly emailBadgeLabel = computed(() => (this.emailVerified() ? 'Verified' : 'Unverified'));
  readonly emailNote = computed(() =>
    this.emailVerified()
      ? 'Changing your email requires verifying the new address before you can log in again.'
      : 'Check your inbox for a verification link before logging in again.',
  );
  readonly emailButtonLabel = computed(() => (this.emailSaving() ? 'Saving…' : 'Save email'));
  readonly passwordButtonLabel = computed(() =>
    this.passwordSaving() ? 'Saving…' : 'Change password',
  );

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
      operation: this.accountService.getAccount(currentUser.id),
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
      operation: this.accountService.updateDisplayName(account.id, name),
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
      operation: this.accountService.updateEmail(account.id, email),
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
      operation: this.accountService.updatePassword(
        account.id,
        this.currentPassword(),
        this.newPassword(),
      ),
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
