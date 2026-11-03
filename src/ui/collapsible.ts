/**
 * Einklappbares Panel: Ein Knopf schaltet die Klasse `collapsed` am Panel um;
 * was dabei verschwindet, regelt style.css.
 */
export class Collapsible {
  private readonly listeners: ((collapsed: boolean) => void)[] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly button: HTMLButtonElement,
    collapsed: boolean,
  ) {
    button.addEventListener('click', () => this.setCollapsed(!this.collapsed));
    this.apply(collapsed);
  }

  get collapsed(): boolean {
    return this.root.classList.contains('collapsed');
  }

  setCollapsed(collapsed: boolean): void {
    if (collapsed === this.collapsed) return;
    this.apply(collapsed);
    for (const fn of this.listeners) fn(collapsed);
  }

  onToggle(fn: (collapsed: boolean) => void): void {
    this.listeners.push(fn);
  }

  private apply(collapsed: boolean): void {
    this.root.classList.toggle('collapsed', collapsed);
    this.button.setAttribute('aria-expanded', String(!collapsed));
  }
}
