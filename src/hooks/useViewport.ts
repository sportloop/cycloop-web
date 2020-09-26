import { useState, useCallback, useEffect } from "react";

const useViewport = () => {
  const [dimensions, apply] = useState({ width: 0, height: 0 });

  const setDimensions = useCallback(() => {
    apply({ width: window.innerWidth, height: window.innerHeight });
  }, []);
  const restoreScroll = useCallback(() => {
    window.scrollTo({ top: 0 });
  }, []);
  // eslint-disable-next-line consistent-return
  useEffect(() => {
    if (typeof window !== "undefined") {
      setDimensions();
      window.addEventListener("scroll", setDimensions, { passive: true });
      window.addEventListener("resize", setDimensions, { passive: true });
      document.addEventListener("focus", restoreScroll);

      return () => {
        window.removeEventListener("scroll", setDimensions);
        window.removeEventListener("resize", setDimensions);
        document.removeEventListener("focus", restoreScroll);
      };
    }
  }, [setDimensions, restoreScroll]);

  return dimensions;
};

export default useViewport;
