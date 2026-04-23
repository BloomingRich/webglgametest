export class InteractionController {
  private interactionTimer: number | null = null;

  constructor(
    private readonly onInteractionStart: () => void,
    private readonly onInteractionEnd: () => void,
    private readonly idleDelayMs = 240
  ) {}

  attach(target: HTMLElement | Window): void {
    const start = () => this.notifyInteraction();
    ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart', 'touchmove'].forEach(
      (eventName) => target.addEventListener(eventName, start, { passive: true })
    );
  }

  private notifyInteraction(): void {
    this.onInteractionStart();

    if (this.interactionTimer !== null) {
      window.clearTimeout(this.interactionTimer);
    }

    this.interactionTimer = window.setTimeout(() => {
      this.onInteractionEnd();
      this.interactionTimer = null;
    }, this.idleDelayMs);
  }
}
