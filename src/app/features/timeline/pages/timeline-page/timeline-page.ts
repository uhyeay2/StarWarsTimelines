/**
 * @fileoverview Route-level page component for the Galactic Timeline.
 *
 * Thin wrapper around the {@link Timeline} component, following the project
 * convention of routing through `pages/` directories.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Timeline } from '../../components/timeline/timeline';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-timeline-page',
  imports: [Timeline],
  template: `<app-timeline />`,
})
export class TimelinePage {}
