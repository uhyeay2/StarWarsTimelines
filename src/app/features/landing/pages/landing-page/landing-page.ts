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
      title: 'Canon & Legends Views',
      description:
        'Explore two separate continuities — switch between the Canon and Legends timelines of the same galaxy.',
    },
    {
      title: 'Advanced Filtering',
      description:
        'Filter timeline events by source material, planet, character, vehicle, and more to follow exactly the story you want.',
    },
    {
      title: 'Progress Tracking',
      description:
        'Track every book, comic, film, and show as Completed, In Progress, or Wish Listed.',
    },
    {
      title: 'Reorderable Wish List',
      description:
        'Line up the content you want to experience next and drag-and-drop it into your preferred viewing order.',
    },
    {
      title: 'Known Timeline',
      description:
        'See a personal timeline built only from events in material you have already experienced, so nothing gets spoiled.',
    },
    {
      title: 'Galaxy Catalog',
      description:
        'Search the database of known Source Materials, Characters, Vehicles, and more from across the saga.',
    },
  ];
}
