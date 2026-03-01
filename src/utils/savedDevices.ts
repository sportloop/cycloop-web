const STORAGE_KEY = "cycloop:savedDevices";

export type SavedDevice = {
  id: string;
  name: string;
  type: string;
};

export function loadSavedDevices(): SavedDevice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDevice(device: SavedDevice): void {
  const devices = loadSavedDevices();
  const existing = devices.findIndex((d) => d.id === device.id);
  if (existing >= 0) {
    devices[existing] = device;
  } else {
    devices.push(device);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
}

export function removeSavedDevice(id: string): void {
  const devices = loadSavedDevices().filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
}
