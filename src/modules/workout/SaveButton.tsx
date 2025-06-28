import Button from "@/components/Button";
import { useMemo } from "react";

export default function SaveButton({ tcx }: { tcx: string }) {
  const url = useMemo(() => {
    if (!tcx) {
      return null;
    }
    const blob = new Blob([tcx], {
      type: "application/xml",
    });

    return URL.createObjectURL(blob);
  }, [tcx]);

  if (!tcx) {
    return null;
  }

  return (
    <a href={url} download="workout.tcx">
      <Button type="button" variant="secondary">
        Save
      </Button>
    </a>
  );
}
