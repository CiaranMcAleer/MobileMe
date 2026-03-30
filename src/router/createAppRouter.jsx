import React from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";

const routeModules = import.meta.glob("../routes/**/*.route.jsx", { eager: true });

function filePathToRoutePath(filePath) {
  const routePath = filePath
    .replace("../routes", "")
    .replace(/\.route\.jsx$/, "")
    .replace(/\/index$/, "/");

  return routePath === "" ? "/" : routePath;
}

function buildRoutes() {
  return Object.entries(routeModules)
    .map(([filePath, module]) => {
      const Component = module.default;

      if (typeof Component !== "function") {
        throw new Error(`Route module ${filePath} does not export a component.`);
      }

      return {
        path: module.path ?? filePathToRoutePath(filePath),
        element: <Component />,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

const router = createBrowserRouter(buildRoutes());

export function AppRouterProvider() {
  return <RouterProvider router={router} />;
}
