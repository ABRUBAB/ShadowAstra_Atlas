import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, RotateCcw } from "lucide-react";

/* ------------------------------------------------------------------ error boundary */

interface BoundaryProps {
  fallback: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
  /** Called once per caught error (for logging). */
  onError?: (error: Error, info: ErrorInfo) => void;
}

/** Catches render errors below it so one broken part never blanks the whole page. */
export class ErrorBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }
  reset = () => this.setState({ error: null });
  render() {
    return this.state.error ? this.props.fallback(this.state.error, this.reset) : this.props.children;
  }
}

/* ------------------------------------------------------------------ WebGL */

let webgl: boolean | null = null;

/** Whether this browser can create a WebGL context (checked once). */
export function hasWebGL(): boolean {
  if (webgl === null) {
    try {
      const c = document.createElement("canvas");
      const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
      webgl = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

const TEXTURE = { earth: "/textures/earth_day_1k.webp", moon: "/textures/moon_lroc_1k.webp", mars: "/textures/mars_viking_1k.webp" } as const;

/** A still globe from the same NASA mosaic, for browsers without WebGL. */
export function StaticGlobe({ body = "earth", note = true, className = "" }: { body?: keyof typeof TEXTURE; note?: boolean; className?: string }) {
  return (
    <div className={`grid h-full w-full place-items-center ${className}`}>
      <div className="relative aspect-square w-[min(80%,80vh)]">
        <div
          role="img"
          aria-label={`${body === "earth" ? "Earth" : body === "moon" ? "The Moon" : "Mars"}, still image`}
          className="h-full w-full rounded-full"
          style={{
            backgroundImage: `url(${TEXTURE[body]})`,
            backgroundSize: "200% 100%",
            backgroundPosition: "30% 50%",
            boxShadow: "inset -40px -12px 60px rgba(0,0,0,0.85), inset 8px 4px 16px rgba(255,255,255,0.10), 0 0 80px -20px rgba(143,180,234,0.25)",
          }}
        />
        {note && <p className="absolute inset-x-0 -bottom-8 text-center font-mono text-[10.5px] tracking-wider text-dim uppercase">3D is off in this browser · still image</p>}
      </div>
    </div>
  );
}

/**
 * Wrap every 3D canvas: without WebGL, or if the scene throws (for example a lost GPU
 * context), show `fallback` instead and keep the rest of the page working.
 */
export function Scene({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  if (!hasWebGL()) return <>{fallback}</>;
  return <ErrorBoundary fallback={() => fallback} onError={(e) => console.warn("3D view stopped:", e.message)}>{children}</ErrorBoundary>;
}

/* ------------------------------------------------------------------ pages */

const CHUNK = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i;

/** After a new deploy, an open tab may ask for page files that no longer exist: reload once to get the new ones. */
function reloadOnceForChunk(error: Error) {
  if (!CHUNK.test(error.message)) return false;
  try {
    const key = "sa-chunk-reload";
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 30000) return false; // already tried: show the message instead of looping
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function PageBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      onError={(e) => {
        if (!reloadOnceForChunk(e)) console.error("Page error:", e);
      }}
      fallback={(error, reset) => <PageError chunk={CHUNK.test(error.message)} onRetry={reset} />}
    >
      {children}
    </ErrorBoundary>
  );
}

function PageError({ chunk, onRetry }: { chunk: boolean; onRetry: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-void px-6 text-center text-platinum">
      <div className="max-w-md">
        <div className="font-mono text-[11px] tracking-[0.24em] text-flare uppercase">{chunk ? "Connection hiccup" : "Something went wrong"}</div>
        <h1 className="mt-4 text-[32px] leading-tight font-medium tracking-[-0.03em]">{chunk ? "This page could not be downloaded." : "This page hit an error."}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-chrome">
          {chunk ? "The site may have just been updated, or the connection dropped. Reloading usually fixes it." : "The rest of the Atlas still works. Try again, or go back to the start."}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => (chunk ? window.location.reload() : onRetry())}
            className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-medium"
          >
            <RotateCcw size={15} /> {chunk ? "Reload" : "Try again"}
          </button>
          <a href="/" className="inline-flex items-center gap-2 rounded-full border border-line-2 px-5 py-3 text-[14px] text-platinum hover:border-chrome">
            Home <ArrowRight size={15} />
          </a>
        </div>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-void px-6 text-center text-platinum">
      <div className="max-w-md">
        <div className="font-mono text-[11px] tracking-[0.24em] text-flare uppercase">404 · off the map</div>
        <h1 className="mt-4 text-[36px] leading-tight font-medium tracking-[-0.03em]">No place like this one.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-chrome">We measured 80,206 places on Earth, but not this address. Try one of these instead.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/discover" className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-medium">
            Find new sites <ArrowRight size={15} />
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-line-2 px-5 py-3 text-[14px] text-platinum hover:border-chrome">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
