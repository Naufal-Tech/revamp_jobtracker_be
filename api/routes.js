import jobRouter from "./routes/Job.js";
import userRouter from "./routes/User.js";

const routes = (app) => {
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/jobs", jobRouter);
};

export default routes;
