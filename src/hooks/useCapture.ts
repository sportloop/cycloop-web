import { useCallback, UIEvent } from "react";

type CaptureConfig = {
  targetCheck?: boolean;
};

const useCapture = <E extends UIEvent>(
  callback: (event: E) => void,
  { targetCheck = false }: CaptureConfig = { targetCheck: false }
) => {
  return useCallback(
    (event: E) => {
      event.preventDefault();
      event.stopPropagation();
      if (targetCheck) {
        return event.target === event.currentTarget
          ? callback(event)
          : undefined;
      }
      return callback(event);
    },
    [callback, targetCheck]
  );
};

export default useCapture;
