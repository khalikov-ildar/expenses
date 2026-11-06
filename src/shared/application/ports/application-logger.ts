export type ApplicationLogFields = Readonly<Record<string, unknown>>;

export abstract class ApplicationLogger {
  abstract info(event: string, fields?: ApplicationLogFields): void;
  abstract warn(event: string, fields?: ApplicationLogFields): void;
  abstract error(event: string, fields?: ApplicationLogFields, error?: unknown): void;
  abstract debug(event: string, fields?: ApplicationLogFields): void;
}
