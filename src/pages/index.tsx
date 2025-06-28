import Link from "next/link";

import { Button } from "@/components/Button";
import Logo, { TranslucentLogo } from "@/components/icons/Logo";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/Card";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/Drawer";

export default function Index() {
  return (
    <>
      <header
        className="sticky top-0 left-0 w-full h-20 flex items-center justify-between px-4"
        data-glow
        style={
          {
            "--border-top": 0,
            "--border-left": 0,
            "--border-right": 0,
            "--radius": 0,
          } as React.CSSProperties
        }
      >
        <Link href="/">
          <a className="flex items-center gap-2">
            <span className="text-2xl font-bold flex items-center">
              Cycl
              <Logo className="mx-1" />p
            </span>
          </a>
        </Link>
        <nav
          className="flex items-center gap-4"
          style={
            {
              "--radius": 14,
              "--border-top": 3,
              "--border-right": 3,
              "--border-bottom": 3,
              "--border-left": 3,
              "--border": 3,
            } as React.CSSProperties
          }
        >
          <Drawer>
            <DrawerTrigger asChild>
              <Button>Sign In</Button>
            </DrawerTrigger>
            <DrawerContent>
              <div className="flex flex-col gap-4 p-4">
                <p className="text-xl font-bold">Sign In with...</p>
                <Button>Strava</Button>
                <Button>Google</Button>
                <Button>Facebook</Button>
                <Button>Apple</Button>
              </div>
            </DrawerContent>
          </Drawer>
        </nav>
      </header>
      <div className="flex flex-col items-center justify-center p-2">
        <section className="flex flex-col md:flex-row gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Devices</CardTitle>
              <CardDescription>Manage your Bluetooth devices</CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/devices">
                <Button>Device Manager</Button>
              </Link>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Workout Editor</CardTitle>
              <CardDescription>
                Create, load, edit and save cycling workouts
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/workout/editor">
                <Button>Workout Editor</Button>
              </Link>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Workout</CardTitle>
              <CardDescription>
                Run your workouts, right from your browser
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/workout">
                <Button>Workout</Button>
              </Link>
            </CardFooter>
          </Card>
        </section>
      </div>
    </>
  );
}
