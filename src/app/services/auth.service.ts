import { Injectable } from '@angular/core';
import { BehaviorSubject, delay, Observable, of, throwError } from 'rxjs';
import { User } from '../models/user';
import { DEMO_USERS } from './auth.data';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserSubject = new BehaviorSubject<User | null>(null);
  readonly currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  login(username: string, password: string): Observable<User> {
    const normalized = username.trim().toLowerCase();
    const match = DEMO_USERS.find(
      (user) => user.username === normalized && user.password === password,
    );
    if (!match) {
      return throwError(() => new Error('Invalid username or password'));
    }
    const user: User = { id: match.id, username: match.username, displayName: match.displayName };
    this.currentUserSubject.next(user);
    return of(user).pipe(delay(250));
  }

  logout(): Observable<void> {
    this.currentUserSubject.next(null);
    return of(undefined).pipe(delay(150));
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }
}
