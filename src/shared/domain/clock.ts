export abstract class Clock {
  abstract now(): Date;
  abstract nowInMs(): number;
  abstract fromMs(ms: number): Date;
  abstract after(ms: number): Date;
}

export class DateClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowInMs(): number {
    return Date.now();
  }

  fromMs(ms: number): Date {
    return new Date(ms);
  }

  after(ms: number): Date {
    return new Date(Date.now() + ms);
  }
}
