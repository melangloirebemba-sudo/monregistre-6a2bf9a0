import { Component, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name: string;
}

/**
 * Boundary tolérante : capture aussi les throws non-Error (`undefined`),
 * qui sinon remontent jusqu'à la racine React et blanchissent l'écran.
 */
export class SafeBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    const e = error instanceof Error ? error : new Error(`Throw non-Error dans ${this.props.name}: ${String(error)}`);
    console.error(e);
    reportLovableError(e, { boundary: this.props.name });
  }
  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
