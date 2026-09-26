'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronRightIcon, SearchIcon } from './icons';

/**
 * Search or jump to (Ctrl K): every screen this role can open, the actions it can take, and
 * a search of the leads or subscribers for the words typed.
 *
 * A native `<dialog>` opened modally, so the browser gives it the top layer, the backdrop,
 * the focus trap and Escape. The list is a combobox with a listbox: typing filters, the
 * arrows move, Enter goes, and the active option is announced.
 */
export interface PaletteCommand {
  label: string;
  href: string;
  /** Which heading the command sits under. */
  group: 'Go to' | 'Create';
  /** Other words someone might type for it. */
  keywords?: string;
}

interface Option {
  id: string;
  label: string;
  hint: string;
  href: string;
  group: string;
}

export function CommandPalette({
  open,
  onClose,
  commands,
  searchable,
}: {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
  searchable: { label: string; href: string }[];
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      input.current?.focus();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  const options = useMemo<Option[]>(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = commands.filter((command) => {
      const haystack = `${command.label} ${command.keywords ?? ''}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
    const found: Option[] = matches.map((command, index) => ({
      id: `${listId}-c${String(index)}`,
      label: command.label,
      hint: command.group === 'Create' ? 'Create' : 'Open',
      href: command.href,
      group: command.group,
    }));
    const typed = query.trim();
    if (typed) {
      searchable.forEach((target, index) => {
        found.push({
          id: `${listId}-s${String(index)}`,
          label: `Search ${target.label} for “${typed}”`,
          hint: 'Search',
          href: `${target.href}?search=${encodeURIComponent(typed)}`,
          group: 'Search',
        });
      });
    }
    return found;
  }, [commands, searchable, query, listId]);

  const current = options[Math.min(active, Math.max(0, options.length - 1))];

  const go = (option: Option | undefined): void => {
    if (!option) return;
    onClose();
    setQuery('');
    setActive(0);
    router.push(option.href);
  };

  return (
    <dialog
      ref={dialog}
      aria-label="Search or jump to"
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself, never on its content.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-x-0 top-[12vh] m-0 mx-auto w-[calc(100%-2rem)] max-w-[600px] overflow-hidden rounded-2xl border border-admin-line bg-admin-surface p-0 text-ink-invert shadow-plate backdrop:bg-scrim-strong"
    >
      <div className="flex items-center gap-3 border-b border-admin-line2 px-4">
        <SearchIcon className="size-[18px] shrink-0 text-admin-muted" />
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={current?.id}
          aria-autocomplete="list"
          aria-label="Search screens and actions"
          placeholder="Type a screen, an action, or a name to search for…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => (options.length === 0 ? 0 : (index + 1) % options.length));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => (options.length === 0 ? 0 : (index - 1 + options.length) % options.length));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              go(current);
            }
          }}
          className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink-invert outline-none placeholder:text-admin-muted"
        />
        <kbd className="hidden rounded-md border border-admin-line px-1.5 py-0.5 font-sans text-[11.5px] text-admin-muted sm:block">Esc</kbd>
      </div>

      <ul id={listId} role="listbox" aria-label="Results" className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
        {options.length === 0 ? (
          <li role="presentation" className="px-3 py-8 text-center text-[14px] text-ink-invert-muted">
            Nothing matches. Try the name of a screen, such as Leads or Settings.
          </li>
        ) : (
          options.map((option, index) => {
            const heading = index === 0 || options[index - 1]?.group !== option.group ? option.group : null;
            const selected = option.id === current?.id;
            return (
              <li key={option.id} role="presentation">
                {heading ? (
                  <p role="presentation" className="px-3 pt-3 pb-1.5 text-[11.5px] font-semibold tracking-[0.12em] text-admin-muted uppercase">
                    {heading}
                  </p>
                ) : null}
                <div
                  id={option.id}
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onPointerMove={() => {
                    setActive(index);
                  }}
                  onClick={() => {
                    go(option);
                  }}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-[14px] ${
                    selected ? 'bg-admin-nav text-ink-invert' : 'text-ink-invert-muted'
                  }`}
                >
                  <span className="flex-1 truncate font-semibold">{option.label}</span>
                  <span className="text-[12px] text-admin-muted">{option.hint}</span>
                  <ChevronRightIcon className={`size-3.5 shrink-0 ${selected ? 'text-ink-invert' : 'text-admin-muted'}`} />
                </div>
              </li>
            );
          })
        )}
      </ul>

      <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-admin-line2 px-4 py-2.5 text-[12px] text-admin-muted">
        <span>↑ ↓ to move</span>
        <span>Enter to open</span>
        <span>Esc to close</span>
      </p>
    </dialog>
  );
}
