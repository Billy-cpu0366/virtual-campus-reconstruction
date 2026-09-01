const MAX_DIAGNOSTIC_LINES = 50;

type DiagnosticConsole = (...args: unknown[]) => void;

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.stack ?? value.message;
  }
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? String(value) : serialized;
  } catch {
    return String(value);
  }
}

function formatArguments(args: readonly unknown[]): string {
  return args.map(formatValue).join(" ");
}

/**
 * Development-only diagnostics. Production builds deliberately do not attach
 * global error/console listeners or copy internal errors into the DOM.
 */
export function installRuntimeDiagnostics(): () => void {
  if (!import.meta.env.DEV) {
    return () => undefined;
  }

  const element = document.getElementById("diag");
  if (element === null) {
    return () => undefined;
  }

  const lines: string[] = [];
  const show = (message: string): void => {
    lines.push(message);
    if (lines.length > MAX_DIAGNOSTIC_LINES) {
      lines.splice(0, lines.length - MAX_DIAGNOSTIC_LINES);
    }
    element.textContent = lines.join("\n");
    element.hidden = false;
    element.style.display = "block";
  };

  const handleError = (event: ErrorEvent): void => {
    const stack = event.error instanceof Error ? event.error.stack ?? "" : "";
    show(
      `ERROR: ${event.message || String(event.error)}\n` +
        `  @${event.filename}:${event.lineno}:${event.colno}\n${stack}`,
    );
  };
  const handleRejection = (event: PromiseRejectionEvent): void => {
    show(`REJECTION: ${formatValue(event.reason)}`);
  };
  const originalError: DiagnosticConsole = console.error.bind(console);
  const originalWarn: DiagnosticConsole = console.warn.bind(console);
  const wrappedError: DiagnosticConsole = (...args): void => {
    show(`console.error: ${formatArguments(args)}`);
    originalError(...args);
  };
  const wrappedWarn: DiagnosticConsole = (...args): void => {
    show(`console.warn: ${formatArguments(args)}`);
    originalWarn(...args);
  };

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);
  console.error = wrappedError;
  console.warn = wrappedWarn;

  return (): void => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
    console.error = originalError;
    console.warn = originalWarn;
  };
}
