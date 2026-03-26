import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Set API base URL
setBaseUrl("http://localhost:4000");

createRoot(document.getElementById("root")!).render(<App />);
