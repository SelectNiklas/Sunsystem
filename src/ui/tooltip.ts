/** Kleiner Namens-Tooltip am Mauszeiger. */
export class Tooltip {
  private readonly el = document.createElement('div');
  private text = '';

  constructor() {
    this.el.id = 'tooltip';
    document.body.appendChild(this.el);
  }

  show(text: string, clientX: number, clientY: number): void {
    if (text !== this.text) {
      this.text = text;
      this.el.textContent = text;
    }
    this.el.style.transform = `translate(${clientX + 14}px, ${clientY + 14}px)`;
    this.el.classList.add('visible');
  }

  hide(): void {
    this.el.classList.remove('visible');
  }
}
