export const fromInstant = (instant: Temporal.Instant): Date => {
  return new Date(instant.epochMilliseconds);
};

export const fromDate = (date: Date): Temporal.Instant => {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime());
};

export const msToSeconds = (ms: number): number => {
  return Math.floor(ms / 1000);
};
