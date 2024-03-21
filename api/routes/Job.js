import express from "express";
import Controller from "../controllers/JobCtrl.js";
import middleware from "../middleware/Auth.js";
import demoUser from "../middleware/demoUser.js";

// Pakai Express Router
const jobRouter = express.Router();

// CREATE JOB (POST): /api/v1/job
jobRouter.post("/", middleware.protect, demoUser, Controller.createJob);

// UPDATE JOB: /api/v1/job/:id
jobRouter.patch("/:id", middleware.protect, demoUser, Controller.updateJob);

// UPDATE JOB: /api/v1/job/:id
jobRouter.get("/detail/:id", middleware.protect, Controller.getJob);

// DELETE JOB: /api/v1/job/:id
jobRouter.delete("/:id", middleware.protect, demoUser, Controller.deleteJob);

// VIEW ALL JOB (GET): /api/v1/job
jobRouter.get("/", middleware.protect, Controller.getAllJob);

// STATS JOB (GET): /api/v1/job/stats
jobRouter.get("/stats", middleware.protect, Controller.showStats);

export default jobRouter;
