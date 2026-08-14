import { __decorate } from "tslib";
import { Component, input } from '@angular/core';
let FeatureCard = class FeatureCard {
    title = input.required();
    description = input.required();
};
FeatureCard = __decorate([
    Component({
        selector: 'app-feature-card',
        imports: [],
        templateUrl: './feature-card.html',
        styleUrl: './feature-card.scss',
    })
], FeatureCard);
export { FeatureCard };
