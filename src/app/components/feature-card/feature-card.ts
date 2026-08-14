import { Component, input } from '@angular/core';

@Component({
  selector: 'app-feature-card',
  imports: [],
  templateUrl: './feature-card.html',
  styleUrl: './feature-card.scss',
})
export class FeatureCard {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
