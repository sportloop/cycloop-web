import { Button } from "@/components/Button";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useModule } from "remodules";

import stravaModule from "../../modules/strava/module";

export default function StravaAuth() {
  const {
    query: { code },
  } = useRouter();
  useModule(stravaModule);

  const savedToken = useSelector(stravaModule.selectors.token);

  const dispatch = useDispatch();

  useEffect(() => {
    if (code) {
      dispatch(stravaModule.actions.loggedIn(code as string));
    }
  }, [code, dispatch]);

  return (
    <div className="text-white">
      <h1>Authenticate Strava</h1>
      {!savedToken ? (
        <a
          href={`https://www.strava.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${process.env.NEXT_PUBLIC_STRAVA_REDIRECT_URI}&scope=activity:write`}
        >
          <Button>Authenticate</Button>
        </a>
      ) : (
        <p>Strava is authenticated with Cycloop</p>
      )}
    </div>
  );
}
