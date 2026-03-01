import fs from "fs";
import path from "path";

import { woToWorkout } from "@/modules/workout/parser";
import { selectStats } from "@/machines/workoutEditor";
import WorkoutGallery from "./WorkoutGallery";

export default function WorkoutsPage() {
  const workoutsDir = path.join(process.cwd(), "workouts");
  const files = fs.readdirSync(workoutsDir).filter((f) => f.endsWith(".wo"));

  const workouts = files.map((file) => {
    const content = fs.readFileSync(path.join(workoutsDir, file), "utf-8");
    const workout = woToWorkout(content);
    const stats = selectStats(workout);

    // Extract description: first paragraph after the heading
    const lines = content.split("\n");
    let description = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || trimmed === "" || trimmed.startsWith("-"))
        continue;
      description = trimmed;
      break;
    }

    return { workout, stats, description };
  });

  // Sort by duration ascending
  workouts.sort((a, b) => a.stats.duration - b.stats.duration);

  return <WorkoutGallery workouts={workouts} />;
}
