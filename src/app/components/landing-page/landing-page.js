import { __decorate } from "tslib";
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeatureCard } from '../feature-card/feature-card';
let LandingPage = class LandingPage {
    features = [
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
};
LandingPage = __decorate([
    Component({
        selector: 'app-landing-page',
        imports: [FeatureCard, RouterLink],
        templateUrl: './landing-page.html',
        styleUrl: './landing-page.scss',
    })
], LandingPage);
export { LandingPage };
