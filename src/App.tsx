import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import { MiniLoader, Splash } from "./components/ui/Splash";
import { AskAstra } from "./components/ui/AskAstra";

const Atlas = lazy(() => import("./pages/Atlas"));
const Lab = lazy(() => import("./pages/Lab"));
const Methods = lazy(() => import("./pages/Methods"));
const About = lazy(() => import("./pages/About"));

// Warm the likely next routes while the visitor reads the landing page.
const prefetch = () => {
  void import("./pages/Atlas");
  void import("./pages/Lab");
};

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function CompareRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/lab${search}`} replace />;
}

function Loading() {
  return <MiniLoader label="Loading" />;
}

export default function App() {
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(prefetch) : window.setTimeout(prefetch, 2500);
    return () => clearTimeout(id);
  }, []);
  return (
    <>
      <Splash />
      <ScrollToTop />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/atlas" element={<Atlas />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/compare" element={<CompareRedirect />} />
          <Route path="/methods" element={<Methods />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
      <AskAstra />
    </>
  );
}
