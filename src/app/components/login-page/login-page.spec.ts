import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the username and password fields', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[name="username"]')).toBeTruthy();
    expect(compiled.querySelector('input[name="password"]')).toBeTruthy();
  });

  it('shows an error for invalid credentials', async () => {
    component.username.set('padme');
    component.password.set('wrong');
    fixture.detectChanges();
    component.login();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBe('Invalid username or password');
    expect(fixture.nativeElement.textContent).toContain('Invalid username or password');
  });

  it('navigates to the library after a successful login', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    component.username.set('luke');
    component.password.set('tatooine');
    fixture.detectChanges();
    component.login();
    await new Promise((resolve) => setTimeout(resolve, 300));
    fixture.detectChanges();

    expect(component.error()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith('/library');
  });
});
