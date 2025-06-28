import Button from "@/components/Button";
import Link from "next/link";
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useModule } from "remodules";
import stravaModule from "./module";

export default function UploadButton({ tcx }: { tcx: string }) {
  useModule(stravaModule);

  const dispatch = useDispatch();

  const isLoggedIn = useSelector(stravaModule.selectors.isLoggedIn);
  const uploaded = useSelector(stravaModule.selectors.isUploaded);
  const error = useSelector(stravaModule.selectors.error);
  const loading = useSelector(stravaModule.selectors.isLoading);

  const onUpload = useCallback(() => {
    dispatch(stravaModule.actions.upload(tcx));
  }, [dispatch, tcx]);

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
