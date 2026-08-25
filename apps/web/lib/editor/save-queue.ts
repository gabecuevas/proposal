/**
 * Serializes overlapping save attempts so an older PATCH cannot finish after a
 * newer one and write stale editor state. Later callers replace the queued task
 * (coalesced) and the in-flight save still completes first.
 */
export class SaveQueue {
  private tail: Promise<void> = Promise.resolve();
  private queued: (() => Promise<void>) | null = null;

  run(task: () => Promise<void>): Promise<void> {
    this.queued = task;
    const next = this.tail.then(() => this.flush());
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async flush(): Promise<void> {
    while (this.queued) {
      const task = this.queued;
      this.queued = null;
      await task();
    }
  }
}

export class StaleDocumentWriteError extends Error {
  readonly code = "STALE_DOCUMENT_WRITE";
  constructor(message = "Document was updated elsewhere. Reload and retry.") {
    super(message);
    this.name = "StaleDocumentWriteError";
  }
}
