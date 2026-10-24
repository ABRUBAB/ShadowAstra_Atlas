import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import Home from "./pages/Home";
import { MiniLoader, Splash } from "./components/ui/Splash";
import { AskAstra } from "./components/ui/AskAstra";
import { BackToTop, Toaster, useScrollingFlag, useSpotlight } from "./components/ui/kit";
import { CommandPalette } from "./components/ui/CommandPalette";
import { BadgeToast } from "./components/ui/BadgeToast";
import { NotFound, PageBoundary } from "./components/ui/Safe";
import { Nav } from "./components/ui/Chrome";

const Atlas = lazy(() => import("./pages/Atlas"));
const Lab = lazy(() => import("./pages/Lab"));
const Find = lazy(() => import("./pages/Find"));
const Report = lazy(() => import("./pages/Report"));
const Methods = lazy(() => import("./pages/Methods"));
const About = lazy(() => import("./pages/About"));
const Learn = lazy(() => import("./pages/Learn"));

// Warm the likely next routes while the visitor reads the landing page.
const prefetch = () => {
  void import("./pages/Find");
  void import("./pages/Lab");
};

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** A beam of light sweeps across the top on every page change. */
function RouteBeam() {
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <motion.div
      key={pathname}
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[2000] h-[2px] origin-left bg-[linear-gradient(90deg,transparent,#f2c879_40%,#fff3d6_70%,transparent)]"
      initial={{ scaleX: 0, opacity: 1 }}
      animate={{ scaleX: 1, opacity: 0 }}
      transition={{
        scaleX: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.45, delay: 0.6 },
      }}
    />
  );
}

/** Reading progress for long pages, a hairline under the beam. */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 40,
    restDelta: 0.001,
  });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX: x }}
      className="pointer-events-none fixed inset-x-0 top-0 z-[1900] h-[2px] origin-left bg-flare/60"
    />
  );
}

/** Each page fades in (opacity only, so fixed and sticky children keep their place). */
function PageFade({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function CompareRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/lab${search}`} replace />;
}

function Loading() {
  return <MiniLoader label="Loading" />;
}

export default function App() {
  const { pathname } = useLocation();
  useSpotlight();
  useScrollingFlag();
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
    };
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(prefetch)
      : window.setTimeout(prefetch, 2500);
    return () => clearTimeout(id);
  }, []);
  return (
    <>
      <Splash />
      <ScrollToTop />
      <RouteBeam />
      <ScrollProgress />
      <PageBoundary key={pathname}>
      <Suspense fallback={<Loading />}>
        <PageFade>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/discover" element={<Find />} />
            <Route path="/find" element={<Navigate to="/discover" replace />} />
            <Route path="/report" element={<Report />} />
            <Route path="/atlas" element={<Atlas />} />
            <Route path="/lab" element={<Lab />} />
            <Route path="/compare" element={<CompareRedirect />} />
            <Route path="/methods" element={<Methods />} />
            <Route path="/about" element={<About />} />
            <Route path="/learn" element={<Learn />} />
            <Route
              path="*"
              element={
                <>
                  <Nav />
                  <NotFound />
                </>
              }
            />
          </Routes>
        </PageFade>
      </Suspense>
      </PageBoundary>
      <AskAstra />
      <CommandPalette />
      <BackToTop />
      <Toaster />
      <BadgeToast />
    </>
  );
}
