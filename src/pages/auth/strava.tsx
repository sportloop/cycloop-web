import { Button } from "@/components/Button";
import { useAppActor } from "@/machines/context";
import { selectToken } from "@/machines/strava";
import { useSelector } from "@xstate/react";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function StravaAuth() {
  const {
    query: { code },
  } = useRouter();

  const appActor = useAppActor();
  const stravaActor = appActor.system.get("strava");
  const savedToken = useSelector(stravaActor, selectToken);

  useEffect(() => {
    if (code) {
      stravaActor.send({ type: "LOGGED_IN", token: code as string });
    }
  }, [code, stravaActor]);

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
