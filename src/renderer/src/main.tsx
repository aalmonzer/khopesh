import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Without this, dropping a file outside the drop zone makes the window try to open it.
for (const type of ["dragover", "drop"]) window.addEventListener(type, (e) => e.preventDefault());

document.body.dataset.platform = window.khopesh.platform;
createRoot(document.getElementById("root")!).render(<App />);
