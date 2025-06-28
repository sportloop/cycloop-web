import { Button } from "@/components/Button";
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useModule } from "remodules";

import WorkoutLayout from "../layouts/workout";
import devicesModule from "../modules/devices/module";

export default function Devices() {
  useModule(devicesModule);
  const devices = useSelector(devicesModule.selectors.devices);
  const dispatch = useDispatch();

  const onSearchFtms = useCallback(() => {
    dispatch(devicesModule.actions.startSearchingFtms());
  }, [dispatch]);

  const onSearchHrm = useCallback(() => {
    dispatch(devicesModule.actions.startSearchingHrm());
  }, [dispatch]);

  const onAddDevice = useCallback(() => {
    dispatch(devicesModule.actions.startSearching());
  }, [dispatch]);

  return (
    <section>
      <header className="flex flex-row justify-between p-4">
        <h1 className="text-white text-3xl">Devices</h1>
        <Button onClick={onSearchFtms}>Search FTMS</Button>
        <Button onClick={onSearchHrm}>Search HRM</Button>
      </header>
      <ul>
        {devices.map((device) => {
          return (
            <li
              key={device.id}
              className="border border-gray-500 rounded-sm py-4 px-6"
            >
              <h3 className="text-white text-xl">{device.name}</h3>
              <ul>
                {Object.entries(device.values).map(([key, value]) => {
                  return (
                    <li key={key} className="text-white text-lg">
                      <strong className="font-bold">{key}:</strong> {value}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
        <li>
          <Button onClick={onAddDevice} modifier="outline">
            + Add Device
          </Button>
        </li>
      </ul>
    </section>
  );
}

Devices.Layout = WorkoutLayout;
