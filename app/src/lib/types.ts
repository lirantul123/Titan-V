export type Protocol = { cmd: string; info: string };

export type Target = {
  id: string;
  name: string;
  lat: number;
  lon: number;
};

export type LogStatus = "default" | "cmd" | "error";

export type LogLine = {
  id: string;
  time: string;
  text: string;
  status: LogStatus;
};

export type CurrentWeather = {
  temperature: number;
  windspeed: number;
};
