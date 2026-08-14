import { __decorate } from "tslib";
import { Component, computed, ElementRef, HostListener, inject, input, model, signal, } from '@angular/core';
let FilterGroup = class FilterGroup {
    label = input.required();
    options = input.required();
    selected = model([]);
    elementRef = inject(ElementRef);
    open = signal(false);
    query = signal('');
    selectedCount = computed(() => this.selected().length);
    filteredOptions = computed(() => {
        const term = this.query().trim().toLowerCase();
        if (!term) {
            return this.options();
        }
        return this.options().filter((option) => option.toLowerCase().includes(term));
    });
    toggle(option) {
        this.selected.update((current) => current.includes(option) ? current.filter((value) => value !== option) : [...current, option]);
    }
    togglePanel() {
        this.open.update((isOpen) => {
            const next = !isOpen;
            if (next) {
                this.query.set('');
            }
            return next;
        });
    }
    clearSelection() {
        this.selected.set([]);
    }
    onDocumentClick(event) {
        if (this.open() && !this.elementRef.nativeElement.contains(event.target)) {
            this.open.set(false);
        }
    }
    onDocumentKeydown(event) {
        if (event.key === 'Escape') {
            this.open.set(false);
        }
    }
};
__decorate([
    HostListener('document:click', ['$event'])
], FilterGroup.prototype, "onDocumentClick", null);
__decorate([
    HostListener('document:keydown', ['$event'])
], FilterGroup.prototype, "onDocumentKeydown", null);
FilterGroup = __decorate([
    Component({
        selector: 'app-filter-group',
        imports: [],
        templateUrl: './filter-group.html',
        styleUrl: './filter-group.scss',
    })
], FilterGroup);
export { FilterGroup };
