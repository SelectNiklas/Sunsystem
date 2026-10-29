/** Ladebildschirm mit Fortschrittsbalken (Markup in index.html). */
export class LoadingScreen {
  private readonly root = document.getElementById('loading')!;
  private readonly fill = this.root.querySelector<HTMLElement>('.loading-bar-fill')!;
  private readonly label = this.root.querySelector<HTMLElement>('.loading-label')!;

  setProgress(fraction: number, text: string): void {
    this.fill.style.width = `${Math.round(fraction * 100)}%`;
    this.label.textContent = text;
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.root.addEventListener('transitionend', () => this.root.remove(), { once: true });
  }
}
