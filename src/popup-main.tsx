import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Popup from "@/pages/Popup";
import "./index.css";

// 界面文字的 Latin 部分，随扩展打包，不走 CDN
import '@fontsource-variable/inter/wght.css';

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ThemeProvider>
            <Popup />
        </ThemeProvider>
    </React.StrictMode>
); 