import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-verify-email-page',
  imports: [RouterLink],
  templateUrl: './verify-email-page.html',
  styleUrl: './verify-email-page.scss',
})
export class VerifyEmailPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly verifying = signal(true);
  readonly success = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.verifying.set(false);
      this.error.set('The verification link is missing. Check the link in your email and try again.');
      return;
    }

    this.auth
      .verifyEmail(token)
      .pipe(
        catchError((err: Error) => {
          this.error.set(err.message);
          return of(undefined);
        }),
      )
      .subscribe(() => {
        this.verifying.set(false);
        if (this.error() === null) {
          this.success.set(true);
        }
      });
  }
}
