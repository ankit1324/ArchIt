import type { Poi } from "./types";

export const POIS: Poi[] = [
  { id: "p1", label: "Rose Garden", icon: "park", coords: [76.7712, 30.7446] },
  {
    id: "p2",
    label: "Sukhna View Residences",
    icon: "building",
    coords: [76.7845, 30.7418],
  },
  {
    id: "p3",
    label: "The Plaza Residences",
    icon: "building",
    coords: [76.7802, 30.7432],
  },
  { id: "p4", icon: "coffee", coords: [76.7762, 30.7396] },
  { id: "p5", icon: "bank", coords: [76.7822, 30.7448] },
  { id: "p6", icon: "scissors", coords: [76.7772, 30.7372] },
  { id: "p7", icon: "compare", coords: [76.7882, 30.7412] },
];

export const PRICE_DOMAIN: [number, number] = [5_000, 1_500_000];
