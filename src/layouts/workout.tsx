import Link from "next/link";
import { PropsWithChildren } from "react";
import { useModule } from "remodules";

import devicesModule from "../modules/devices/module";
import workoutModule from "../modules/workout/module";
import workoutEditor from "../modules/workout/editor/module";
import workoutLoader from "../modules/workout/loader/module";

export default function WorkoutLayout({
  children,
}: PropsWithChildren<Record<string, never>>) {
  useModule(workoutModule);
  useModule(devicesModule);
  useModule(workoutLoader);
  useModule(workoutEditor);

  return (
    <div>
      <ul className="text-white fixed">
        <li>
          <Link href="/devices">
            <a>Devices</a>
          </Link>
        </li>
        <li>
          <Link href="/workout">
            <a>Workout</a>
          </Link>
        </li>
      </ul>
      {children}
    </div>
  );
}
