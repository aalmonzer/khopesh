import type { KhopeshApi } from "../../shared/types";

declare global {
  interface Window {
    khopesh: KhopeshApi;
  }
}

export {};
