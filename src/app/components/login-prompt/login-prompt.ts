import { Component, input, booleanAttribute } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Empty-state call-to-action shown when a personal-data page requires login.
 *
 * The projected content becomes the prompt message.
 */
@Component({
  selector: 'app-login-prompt',
  imports: [RouterLink],
  templateUrl: './login-prompt.html',
  styleUrl: './login-prompt.scss',
})
export class LoginPrompt {
  /** Narrow layout for pages with constrained content columns. */
  readonly compact = input(false, { transform: booleanAttribute });
}
