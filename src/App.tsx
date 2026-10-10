import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";

const Atlas = lazy(() => import("./pages/Atlas"));
const Compare = lazy(() => import("./pages/Compare"));
const Methods = lazy(() => import("./pages/Methods"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Loading() {
  return (
    <div className="grid h-dvh place-items-center bg-void">
      <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-chrome uppercase">
        <span className="size-2 animate-ping rounded-full bg-earth" />
        Loading NASA layers
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/atlas" element={<Atlas />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/methods" element={<Methods />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </>
  );
}
