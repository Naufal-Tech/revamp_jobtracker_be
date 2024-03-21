import express from "express";
import Controller from "../controllers/UserCtrl.js";
import middleware from "../middleware/Auth.js";
import demoUser from "../middleware/demoUser.js";
import { upload } from "../middleware/multerMiddleware.js";

const apiLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, //15 menit
  max: 10, // ten request max in 15 menit
  message:
    "Too many requests from this IP address, please try again after 15 minutes",
});

// Pakai Express Router
const userRouter = express.Router();

//POST: /api/v1/users/register
userRouter.post("/register", apiLimiter, Controller.register);

//POST: /api/v1/users/login
userRouter.post("/login", upload.none(), Controller.login);

//PATCH: /api/v1/users/update
userRouter.patch(
  "/update",
  middleware.protect,
  upload.single("img_profile"),
  Controller.update
);

//DELETE: /api/v1/users/delete
userRouter.delete("/delete", middleware.protect, demoUser, Controller.delete);

//GET: /api/v1/users/delete
userRouter.get("/detail/:id", middleware.protect, Controller.detail);

//GET: /api/v1/users/info
userRouter.get("/info", middleware.protect, Controller.infoUser);

//GET: /api/v1/users/
userRouter.get("/", middleware.protect, Controller.get);

//POST: /api/v1/users/forgot-password
userRouter.post(
  "/forgot-password",
  upload.none(),
  Controller.forgotPasswordLink
);

//POST: /api/v1/users/forgot-password
userRouter.post("/reset-password", upload.none(), Controller.resetPasswordLink);

//GET: /api/v1/users/verify
userRouter.get("/verify", Controller.emailVerification);

//POST: /api/v1/users/resend-verification
userRouter.post("/resend-verification", Controller.resendVerification);

//GET: /api/v1/users/username
userRouter.get("/username", middleware.protect, Controller.searchUsername);

//GET: /api/v1/users/email
userRouter.get("/email", Controller.searchByEmail);

//GET: /api/v1/users/update-password
userRouter.post(
  "/update-password",
  middleware.protect,
  Controller.updatePassword
);

//POST/api/v1/users/:id
userRouter.post(
  "/img-profile",
  upload.single("img_profile"),
  middleware.protect,
  Controller.imgProfile
);

//GET/api/v1/users/logout
userRouter.get("/logout", Controller.logout);

userRouter.get(
  "/app-stats",
  middleware.protect,
  middleware.adminAuthMiddleware,
  Controller.getApplicationStats
);

export default userRouter;
