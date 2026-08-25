import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoginPrompt } from './login-prompt';

@Component({
  imports: [LoginPrompt],
  template: '<app-login-prompt>Log in to continue.</app-login-prompt>',
})
class Host {}

@Component({
  imports: [LoginPrompt],
  template: '<app-login-prompt compact>Sign in required.</app-login-prompt>',
})
class CompactHost {}

describe('LoginPrompt', () => {
  async function render(host: typeof Host | typeof CompactHost): Promise<ComponentFixture<Host>> {
    const fixture = TestBed.createComponent(host as typeof Host);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host, CompactHost],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('projects the message content and links to /login', async () => {
    const fixture = await render(Host);

    expect(fixture.nativeElement.querySelector('.login-prompt--compact')).toBeNull();
    const link = fixture.nativeElement.querySelector('.login-prompt a') as HTMLAnchorElement;

    expect(fixture.nativeElement.textContent).toContain('Log in to continue.');
    expect(link.getAttribute('href')).toBe('/login');
    expect(link.textContent?.trim()).toBe('Log in');
  });

  it('renders the compact variant when the input is set', async () => {
    const fixture = await render(CompactHost);

    expect(fixture.nativeElement.querySelector('.login-prompt--compact')).toBeTruthy();
    expect(
      (
        fixture.nativeElement.querySelector('.login-prompt a') as HTMLAnchorElement
      ).textContent?.trim(),
    ).toBe('Log in');
  });
});
