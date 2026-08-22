/**
 * @fileoverview Reusable navbar dropdown with hover reveal.
 *
 * Visibility is driven purely by CSS: the menu opens on `:hover` of the
 * wrapper and stays available for keyboard users via `:focus-visible`
 * (plain mouse clicks do not match it, so the menu never gets stuck open
 * after selecting an option). The gap between toggle and panel lives inside
 * the menu element itself, giving a continuous hover surface while open —
 * and, because the hidden menu is not hit-testable, nothing re-triggers the
 * hover after an option is chosen.
 */

import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** A single selectable entry in a nav dropdown menu. */
export interface NavDropdownOption {
  /** Display text for the option. */
  label: string;
  /** Target route (single path or link array). */
  routerLink: string | readonly string[];
  /** Optional query params merged into the navigation. */
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'app-nav-dropdown',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav-dropdown.html',
  styleUrl: './nav-dropdown.scss',
})
export class NavDropdown {
  /** Text shown on the top-level toggle link. */
  readonly label = input.required<string>();

  /** Route the toggle navigates to (supports last-viewed deep links). */
  readonly toggleLink = input.required<string | readonly string[]>();

  /** Query params applied to the toggle navigation. */
  readonly toggleQueryParams = input<Record<string, string> | undefined>(undefined);

  /** Options rendered inside the dropdown menu. */
  readonly options = input.required<readonly NavDropdownOption[]>();

  /**
   * Whether menu items highlight via `routerLinkActive`. Enable for menus
   * whose options target distinct paths (e.g. Library); disable when all
   * options share one path and differ only by query params (e.g. Catalog).
   */
  readonly highlightItems = input(false);
}
