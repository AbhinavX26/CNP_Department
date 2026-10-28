import { Children, Fragment, isValidElement, useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import './select.css';

/**
 * The site's dropdowns.
 *
 * `Select` is a drop-in for `<select>`: same `value`, same `<option>` children, and an
 * `onChange` whose event carries `target.value` and `target.name`. It keeps a hidden native
 * `<select>` in the form, so `name`, `required` and form validation behave as before.
 * `ComboInput` replaces `<input list>` + `<datalist>`: free text with a styled suggestion list.
 *
 * Both float their list from <body>, so no dialog or scroll container can clip it.
 */

/* ── Shared ──────────────────────────────────────────────────────────────── */

interface Choice {
  value: string;
  label: string;
  disabled: boolean;
}

interface Placement {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  listMax: number;
}

const MIN_MENU_WIDTH = 200;
/** From this many options the list gets a filter box. */
const SEARCH_FROM = 8;

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

/** Reads `<option>` elements (also inside fragments and mapped arrays) into plain choices. */
function collectChoices(children: ReactNode, out: Choice[]): void {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as {
      value?: string | number;
      disabled?: boolean;
      label?: string;
      children?: ReactNode;
    };
    if (child.type === Fragment) {
      collectChoices(props.children, out);
      return;
    }
    if (child.type !== 'option') return;
    const label = (props.label ?? textOf(props.children)).replace(/\s+/g, ' ').trim();
    out.push({
      value: props.value !== undefined ? String(props.value) : label,
      label,
      disabled: Boolean(props.disabled),
    });
  });
}

function placeMenu(anchor: HTMLElement, searchable: boolean): Placement {
  const rect = anchor.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom;
  const above = rect.top;
  const flip = below < 220 && above > below;
  const room = Math.max(160, (flip ? above : below) - 12);
  const width = Math.max(rect.width, MIN_MENU_WIDTH);
  const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
  return {
    left,
    width,
    listMax: Math.max(120, Math.min(264, room - (searchable ? 72 : 24))),
    ...(flip ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
  };
}

/** The next enabled index from `from` in direction `dir`, wrapping; -1 when nothing is enabled. */
function stepEnabled(list: Choice[], from: number, dir: 1 | -1): number {
  const n = list.length;
  for (let i = 1; i <= n; i += 1) {
    const at = (((from + dir * i) % n) + n) % n;
    if (!list[at].disabled) return at;
  }
  return -1;
}

/** Outside press, page scroll or resize closes the floating list rather than letting it drift. */
function useDismiss(
  open: boolean,
  close: () => void,
  anchorRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;
    const within = (target: EventTarget | null) =>
      target instanceof Node && Boolean(anchorRef.current?.contains(target) || menuRef.current?.contains(target));
    const onDown = (event: MouseEvent) => {
      if (!within(event.target)) close();
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close, anchorRef, menuRef]);
}

/** Keeps the highlighted row inside the list as the keyboard moves. */
function useKeepInView(open: boolean, highlight: number, listRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-highlighted="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight, listRef]);
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="sel__check" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 3.6 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/* ── Select ──────────────────────────────────────────────────────────────── */

export interface SelectChangeEvent {
  target: { value: string; name?: string; id?: string };
  currentTarget: { value: string; name?: string; id?: string };
}

export interface SelectProps {
  value: string;
  onChange: (event: SelectChangeEvent) => void;
  /** `<option>` elements, exactly as for a native select. */
  children: ReactNode;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  /** Shown when nothing is chosen and there is no disabled empty `<option>` to borrow it from. */
  placeholder?: string;
  /** Layout hook for the wrapper (width, flex). The look itself is fixed. */
  className?: string;
  title?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}

export function Select({
  value,
  onChange,
  children,
  id,
  name,
  disabled = false,
  required,
  placeholder = 'Select…',
  className,
  title,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-invalid': ariaInvalid,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const listId = useId();

  const choices: Choice[] = [];
  collectChoices(children, choices);
  // A disabled empty option is the native "Choose…" row: it is the placeholder, not a choice.
  const hint = choices.find((c) => c.value === '' && c.disabled);
  const listable = choices.filter((c) => c !== hint);
  const searchable = listable.length >= SEARCH_FROM;
  const needle = query.trim().toLowerCase();
  const visible = needle ? listable.filter((c) => c.label.toLowerCase().includes(needle)) : listable;
  const selected = listable.find((c) => c.value === value);
  const shown = selected ? selected.label : hint?.label || placeholder;

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  useDismiss(open, close, wrapRef, menuRef);
  useKeepInView(open, highlight, listRef);

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  const openMenu = () => {
    const trigger = triggerRef.current;
    if (!trigger || disabled) return;
    setPlacement(placeMenu(trigger, searchable));
    const current = listable.findIndex((c) => c.value === value && !c.disabled);
    setHighlight(current >= 0 ? current : stepEnabled(listable, -1, 1));
    setOpen(true);
  };

  const pick = (choice: Choice) => {
    if (choice.disabled) return;
    const target = { value: choice.value, name, id };
    onChange({ target, currentTarget: target });
    close();
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const onTrigger = event.currentTarget === triggerRef.current;
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlight((h) => stepEnabled(visible, h, 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlight((h) => stepEnabled(visible, h < 0 ? 0 : h, -1));
        break;
      case 'Home':
        if (onTrigger) {
          event.preventDefault();
          setHighlight(stepEnabled(visible, -1, 1));
        }
        break;
      case 'End':
        if (onTrigger) {
          event.preventDefault();
          setHighlight(stepEnabled(visible, 0, -1));
        }
        break;
      case 'Enter':
        event.preventDefault();
        if (highlight >= 0 && visible[highlight]) pick(visible[highlight]);
        break;
      case ' ':
        if (onTrigger) {
          event.preventDefault();
          if (highlight >= 0 && visible[highlight]) pick(visible[highlight]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close();
        triggerRef.current?.focus();
        break;
      case 'Tab':
        close();
        break;
      default:
        if (onTrigger && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const now = Date.now();
          const state = typed.current;
          state.text = now - state.at > 700 ? event.key.toLowerCase() : state.text + event.key.toLowerCase();
          state.at = now;
          const hit = visible.findIndex((c) => !c.disabled && c.label.toLowerCase().startsWith(state.text));
          if (hit >= 0) setHighlight(hit);
        }
    }
  };

  const activeId = open && highlight >= 0 ? `${listId}-o${highlight}` : undefined;

  return (
    <div ref={wrapRef} className={`sel${className ? ` ${className}` : ''}`}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        role="combobox"
        className="sel__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={searchable ? undefined : activeId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={ariaInvalid}
        aria-required={required || undefined}
        title={title}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className={`sel__value${selected ? '' : ' is-placeholder'}`}>{shown}</span>
      </button>
      <ChevronIcon className="sel__chevron" />

      <select
        className="sel__native"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        onChange={() => undefined}
      >
        {children}
      </select>

      {open &&
        !disabled &&
        placement &&
        createPortal(
          <div
            ref={menuRef}
            className="ui-menu sel__menu"
            style={{ left: placement.left, top: placement.top, bottom: placement.bottom, width: placement.width }}
          >
            {searchable && (
              <div className="sel__search">
                <SearchIcon />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  placeholder="Filter options"
                  aria-label="Filter options"
                  aria-controls={listId}
                  aria-activedescendant={activeId}
                  autoComplete="off"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setHighlight(0);
                  }}
                  onKeyDown={onKeyDown}
                />
              </div>
            )}
            <div
              ref={listRef}
              id={listId}
              className="sel__list"
              role="listbox"
              aria-label={ariaLabel}
              style={{ maxHeight: placement.listMax }}
            >
              {visible.length === 0 ? (
                <div className="sel__empty" aria-live="polite">
                  {needle ? `Nothing matches “${query.trim()}”` : 'No options'}
                </div>
              ) : (
                visible.map((choice, index) => {
                  const isSelected = choice.value === value;
                  return (
                    <div
                      key={`${choice.value}-${index}`}
                      id={`${listId}-o${index}`}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={choice.disabled || undefined}
                      data-selected={isSelected || undefined}
                      data-disabled={choice.disabled || undefined}
                      data-highlighted={index === highlight || undefined}
                      className="sel__option"
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => !choice.disabled && setHighlight(index)}
                      onClick={() => pick(choice)}
                    >
                      <span className="sel__label">{choice.label}</span>
                      {isSelected && <CheckIcon />}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/* ── ComboInput ──────────────────────────────────────────────────────────── */

export interface ComboInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Suggestions offered while typing. Any text is still accepted. */
  suggestions: string[];
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  className?: string;
}

export function ComboInput({
  value,
  onChange,
  suggestions,
  id,
  name,
  placeholder,
  disabled = false,
  required,
  maxLength,
  className,
}: ComboInputProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const needle = value.trim().toLowerCase();
  const matches = needle ? suggestions.filter((s) => s.toLowerCase().includes(needle)) : suggestions;
  const visible = open && matches.length > 0 && placement !== null;

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
  }, []);

  useDismiss(open, close, wrapRef, menuRef);
  useKeepInView(open, highlight, listRef);

  const openMenu = (keepHighlight = false) => {
    if (disabled || !wrapRef.current) return;
    setPlacement(placeMenu(wrapRef.current, false));
    if (!keepHighlight) setHighlight(-1);
    setOpen(true);
  };

  const pick = (text: string) => {
    onChange(text);
    close();
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (matches.length === 0) return;
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      const dir = event.key === 'ArrowDown' ? 1 : -1;
      setHighlight((h) => (h < 0 ? (dir === 1 ? 0 : matches.length - 1) : (h + dir + matches.length) % matches.length));
    } else if (event.key === 'Enter' && visible && highlight >= 0 && matches[highlight] !== undefined) {
      event.preventDefault();
      pick(matches[highlight]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close();
    }
  };

  const activeId = visible && highlight >= 0 ? `${listId}-o${highlight}` : undefined;

  return (
    <div ref={wrapRef} className={`sel sel--combo${className ? ` ${className}` : ''}`}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        role="combobox"
        className="sel__trigger sel__input"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={visible ? listId : undefined}
        aria-activedescendant={activeId}
        name={name}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value);
          openMenu();
        }}
        onClick={() => !open && openMenu()}
        onKeyDown={onKeyDown}
        onBlur={close}
      />
      <button
        type="button"
        className="sel__toggle"
        tabIndex={-1}
        aria-label="Show suggestions"
        disabled={disabled || suggestions.length === 0}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) close();
          else {
            inputRef.current?.focus();
            openMenu();
          }
        }}
      >
        <ChevronIcon />
      </button>

      {visible &&
        placement &&
        createPortal(
          <div
            ref={menuRef}
            className="ui-menu sel__menu"
            style={{ left: placement.left, top: placement.top, bottom: placement.bottom, width: placement.width }}
          >
            <div ref={listRef} id={listId} className="sel__list" role="listbox" style={{ maxHeight: placement.listMax }}>
              {matches.map((text, index) => {
                const isSelected = text === value;
                return (
                  <div
                    key={`${text}-${index}`}
                    id={`${listId}-o${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected || undefined}
                    data-highlighted={index === highlight || undefined}
                    className="sel__option"
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => pick(text)}
                  >
                    <span className="sel__label">{text}</span>
                    {isSelected && <CheckIcon />}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default Select;
