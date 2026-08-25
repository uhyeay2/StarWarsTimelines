import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeatureCard } from '../../../../shared/components/feature-card/feature-card';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-landing-page',
  imports: [FeatureCard, RouterLink],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.scss',
})
export class LandingPage {
  protected readonly features = [
    {
      title: 'Galactic Eras',
      description: 'Navigate the major periods of Star Wars history with clear, visual markers.',
    },
    {
      title: 'Key Events',
      description: 'Discover the battles, treaties, and turning points that shaped the galaxy.',
    },
    {
      title: 'Characters',
      description: 'Follow your favorite heroes and villains across the timeline of the saga.',
    },
  ];
}
