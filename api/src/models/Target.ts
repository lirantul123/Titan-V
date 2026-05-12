export type Target = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  createdAt: string;
};

export type CreateTargetInput = {
  name: string;
  lat: number;
  lon: number;
};
