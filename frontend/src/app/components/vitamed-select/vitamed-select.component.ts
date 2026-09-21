import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  forwardRef
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideCheck, LucideChevronDown } from '@lucide/angular';

export type VitamedSelectValue = string | number | boolean | null;

export interface VitamedSelectOption<T extends VitamedSelectValue = VitamedSelectValue> {
  value: T;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-vitamed-select',
  standalone: true,
  templateUrl: './vitamed-select.component.html',
  styleUrl: './vitamed-select.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VitamedSelectComponent),
      multi: true
    }
  ]
})
export class VitamedSelectComponent implements ControlValueAccessor, OnDestroy {
  private static nextId = 0;
  private static openInstance: VitamedSelectComponent | null = null;

  readonly chevronIcon = LucideChevronDown.icon.node;
  readonly checkIcon = LucideCheck.icon.node;
  readonly listId = `vitamed-select-${++VitamedSelectComponent.nextId}`;

  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;

  @Input() options: VitamedSelectOption<VitamedSelectValue>[] = [];
  @Input() placeholder = 'Izaberite';
  @Input() ariaLabel = '';
  @Input() inputId = '';
  @Input() required = false;
  @Input() size: 'default' | 'compact' = 'default';

  @Input()
  set invalid(value: boolean) {
    this.isInvalid = !!value;
  }

  @Input()
  set disabled(value: boolean) {
    this.setDisabledState(!!value);
  }

  @Input()
  set value(value: VitamedSelectValue) {
    this.innerValue = value ?? null;
  }

  get value(): VitamedSelectValue {
    return this.innerValue;
  }

  @Output() valueChange = new EventEmitter<VitamedSelectValue>();

  @HostBinding('class.is-open') isOpen = false;
  @HostBinding('class.is-invalid') isInvalid = false;
  @HostBinding('class.is-compact')
  get compactClass(): boolean {
    return this.size === 'compact';
  }

  @HostBinding('class.is-disabled')
  get disabledClass(): boolean {
    return this.isDisabled;
  }

  activeIndex = -1;
  panelStyle: Record<string, string> = {};
  isDisabled = false;

  private innerValue: VitamedSelectValue = null;
  private onChange: (value: VitamedSelectValue) => void = () => undefined;
  private touched: () => void = () => undefined;

  constructor(private readonly host: ElementRef<HTMLElement>) {
    this.onDocumentPointer = this.onDocumentPointer.bind(this);
    this.onDocumentKey = this.onDocumentKey.bind(this);
    this.onViewportChange = this.onViewportChange.bind(this);
  }

  get selectedOption(): VitamedSelectOption | undefined {
    return this.options.find((option) => this.valuesEqual(option.value, this.innerValue));
  }

  get displayLabel(): string {
    return this.selectedOption?.label ?? '';
  }

  get showPlaceholder(): boolean {
    return !this.selectedOption;
  }

  writeValue(value: VitamedSelectValue): void {
    this.innerValue = value ?? null;
  }

  registerOnChange(fn: (value: VitamedSelectValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.touched = fn;
  }

  markTouched(): void {
    this.touched();
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    if (isDisabled) {
      this.close();
    }
  }

  ngOnDestroy(): void {
    this.detachListeners();
    if (VitamedSelectComponent.openInstance === this) {
      VitamedSelectComponent.openInstance = null;
    }
  }

  toggle(): void {
    if (this.isDisabled) {
      return;
    }
    if (this.isOpen) {
      this.close();
      return;
    }
    this.open();
  }

  open(): void {
    if (this.isDisabled || this.options.length === 0) {
      return;
    }

    if (VitamedSelectComponent.openInstance && VitamedSelectComponent.openInstance !== this) {
      VitamedSelectComponent.openInstance.close();
    }

    this.isOpen = true;
    VitamedSelectComponent.openInstance = this;
    this.activeIndex = Math.max(0, this.options.findIndex((option) => this.valuesEqual(option.value, this.innerValue)));
    this.updatePanelPosition();
    this.attachListeners();
  }

  close(): void {
    if (!this.isOpen) {
      return;
    }
    this.isOpen = false;
    this.activeIndex = -1;
    if (VitamedSelectComponent.openInstance === this) {
      VitamedSelectComponent.openInstance = null;
    }
    this.detachListeners();
  }

  selectOption(option: VitamedSelectOption, index: number): void {
    if (option.disabled || this.isDisabled) {
      return;
    }
    this.activeIndex = index;
    this.commit(option.value);
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.isDisabled) {
      return;
    }

    if (event.key === 'Tab') {
      this.close();
      return;
    }

    if (event.key === 'Escape') {
      if (this.isOpen) {
        event.preventDefault();
        this.close();
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.isOpen) {
        this.open();
        return;
      }
      this.moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!this.isOpen) {
        this.open();
        return;
      }
      const option = this.options[this.activeIndex];
      if (option) {
        this.selectOption(option, this.activeIndex);
      }
      return;
    }

    if (event.key === 'Home' && this.isOpen) {
      event.preventDefault();
      this.setActive(0, 1);
      return;
    }

    if (event.key === 'End' && this.isOpen) {
      event.preventDefault();
      this.setActive(this.options.length - 1, -1);
    }
  }

  optionId(index: number): string {
    return `${this.listId}-option-${index}`;
  }

  isSelected(option: VitamedSelectOption): boolean {
    return this.valuesEqual(option.value, this.innerValue);
  }

  private commit(value: VitamedSelectValue): void {
    this.innerValue = value;
    this.onChange(value);
    this.valueChange.emit(value);
    this.touched();
    this.close();
    this.trigger?.nativeElement.focus();
  }

  private moveActive(step: number): void {
    if (this.options.length === 0) {
      return;
    }
    const start = this.activeIndex < 0
      ? (step > 0 ? -1 : this.options.length)
      : this.activeIndex;
    this.setActive(start + step, step);
  }

  private setActive(index: number, step: number): void {
    if (this.options.length === 0) {
      return;
    }

    let next = index;
    for (let i = 0; i < this.options.length; i += 1) {
      if (next < 0) {
        next = this.options.length - 1;
      } else if (next >= this.options.length) {
        next = 0;
      }
      if (!this.options[next].disabled) {
        this.activeIndex = next;
        queueMicrotask(() => {
          document.getElementById(this.optionId(next))?.scrollIntoView({ block: 'nearest' });
        });
        return;
      }
      next += step;
    }
  }

  private updatePanelPosition(): void {
    const trigger = this.trigger?.nativeElement;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const viewportPad = 8;
    const preferredMax = this.size === 'compact' ? 220 : 256;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPad;
    const spaceAbove = rect.top - viewportPad;
    const openUp = spaceBelow < 140 && spaceAbove > spaceBelow;
    const available = Math.max(96, openUp ? spaceAbove - gap : spaceBelow - gap);
    const maxHeight = Math.min(preferredMax, available);
    const minWidth = this.size === 'compact' ? Math.max(rect.width, 84) : rect.width;
    let left = rect.left;
    if (left + minWidth > window.innerWidth - viewportPad) {
      left = Math.max(viewportPad, window.innerWidth - viewportPad - minWidth);
    }

    this.panelStyle = {
      left: `${left}px`,
      width: `${minWidth}px`,
      maxHeight: `${maxHeight}px`,
      top: openUp ? 'auto' : `${rect.bottom + gap}px`,
      bottom: openUp ? `${window.innerHeight - rect.top + gap}px` : 'auto'
    };
  }

  private attachListeners(): void {
    document.addEventListener('pointerdown', this.onDocumentPointer, true);
    document.addEventListener('keydown', this.onDocumentKey, true);
    window.addEventListener('resize', this.onViewportChange);
    window.addEventListener('scroll', this.onViewportChange, true);
  }

  private detachListeners(): void {
    document.removeEventListener('pointerdown', this.onDocumentPointer, true);
    document.removeEventListener('keydown', this.onDocumentKey, true);
    window.removeEventListener('resize', this.onViewportChange);
    window.removeEventListener('scroll', this.onViewportChange, true);
  }

  private onDocumentPointer(event: PointerEvent): void {
    const target = event.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) {
      return;
    }
    this.close();
  }

  private onDocumentKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen) {
      event.preventDefault();
      this.close();
      this.trigger?.nativeElement.focus();
    }
  }

  private onViewportChange(): void {
    if (this.isOpen) {
      this.updatePanelPosition();
    }
  }

  private valuesEqual(left: VitamedSelectValue, right: VitamedSelectValue): boolean {
    if (left === right) {
      return true;
    }
    if (left == null || right == null) {
      return left == null && right == null;
    }
    return String(left) === String(right);
  }
}
