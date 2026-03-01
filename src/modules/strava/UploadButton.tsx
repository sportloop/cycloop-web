import { Button } from "@/components/Button";
import { useAppActor } from "@/machines/context";
import {
  selectError,
  selectIsLoggedIn,
  selectIsLoading,
  selectIsUploaded,
} from "@/machines/strava";
import { useSelector } from "@xstate/react";
import Link from "next/link";
import { useCallback } from "react";

export default function UploadButton({ tcx }: { tcx: string }) {
  const appActor = useAppActor();
  const stravaActor = appActor.system.get("strava");

  const isLoggedIn = useSelector(stravaActor, selectIsLoggedIn);
  const uploaded = useSelector(stravaActor, selectIsUploaded);
  const error = useSelector(stravaActor, selectError);
  const loading = useSelector(stravaActor, selectIsLoading);

  const onUpload = useCallback(() => {
    stravaActor.send({ type: "UPLOAD", tcx });
  }, [stravaActor, tcx]);

  if (!tcx) {
    return null;
  }

  if (loading) {
    return <Button disabled>⌛ Loading...</Button>;
  }

  if (error) {
    return (
      <Button disabled variant="danger">
        ⚠️ {error}
      </Button>
    );
  }

  if (uploaded) {
    return (
      <Button disabled variant="success">
        ✅ Success
      </Button>
    );
  }

  if (!isLoggedIn) {
    return (
      <Link href="/auth/strava">
        <Button variant="warning">Login with Strava</Button>
      </Link>
    );
  }

  return (
    <Button variant="warning" onClick={onUpload}>
      Upload to Strava
    </Button>
  );
}
