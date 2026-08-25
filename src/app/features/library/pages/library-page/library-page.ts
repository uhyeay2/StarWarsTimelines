import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { LoginPrompt } from '../../../../shared/components/login-prompt/login-prompt';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-library-page',
  imports: [RouterLink, LoginPrompt],
  templateUrl: './library-page.html',
  styleUrl: './library-page.scss',
})
export class LibraryPage {
  private readonly auth = inject(AuthService);
  readonly user = this.auth.currentUser;
}
