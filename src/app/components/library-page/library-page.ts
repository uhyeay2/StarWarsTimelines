import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { LoginPrompt } from '../login-prompt/login-prompt';

@Component({
  selector: 'app-library-page',
  imports: [RouterLink, LoginPrompt],
  templateUrl: './library-page.html',
  styleUrl: './library-page.scss',
})
export class LibraryPage {
  private readonly auth = inject(AuthService);
  readonly user = this.auth.currentUser;
}
