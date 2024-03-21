import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import "express-async-errors";
import moment from "moment";
import mongoose from "mongoose";
import morgan from "morgan";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import "./globalModules.js";
import errorHandlerMiddleware from "./middleware/error-handler.js";
import {
  globalErrHandler,
  notFoundErr,
} from "./middleware/globalErrHandler.js";
// import userRouter from "./routes/User.js";
import routes from "./routes.js";

// Security
import mongoSanitize from "express-mongo-sanitize";
import helmet from "helmet";
import xss from "xss-clean";

/*** Invoke Express***/
const app = express();

/*** Invoke DOT-ENV***/
dotenv.config();

//middlewares
app.use(express.json()); //pass incoming payload

// Setting up bodyParser:
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());

// SETTING CORS:
app.use(cors());
app.options("*", cors());

// Cookie:
app.use(cookieParser());

// SECURITY
app.use(helmet());
app.use(xss());

// Sanitize attack/prevent MongoDB injection
app.use(mongoSanitize());

// morgan untuk tracing http request dari client
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "DELETE, PUT, GET, POST, PATCH");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// Routes:
// app.use("/api/v1/users", userRouter);
routes(app);

// Setting Path:
const __dirname = dirname(fileURLToPath(import.meta.url));

// Sesuaikan Nama Folder FE
app.use(express.static(path.resolve(__dirname, "images")));

// Database Connection:
try {
  mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true }); //tidak deprecated
  const db = mongoose.connection;
  db.on("error", console.error.bind(console, "connection error")); //tanya
  db.once("open", function (callback) {
    console.log("\n\n\n\n");
    console.log(
      `Server successfully compiled on ${moment().format(
        `YYYY-MM-DD HH:mm:ss`
      )} \nDatabase connection Success with port ${
        process.env.PORT
      }!\nConnect to MongDB Atlas\n\n\n\n\n`
    );
  });
} catch (error) {
  console.error("Error connecting to the database:", error);
  atlas();
}

// Define a simple route handler to indicate that the server is running
app.use("/test", (req, res) => {
  res.send("Server is running");
});

app.use("/api/v1/test", (req, res) => {
  res.json({ message: "Server is running" });
});

//Error Handlers Middleware
app.use(globalErrHandler);

// Not Found Error
app.use(notFoundErr);

//Error Handlers Middleware
app.use(errorHandlerMiddleware);

//404 error
app.use("*", (req, res) => {
  console.log(req.originalUrl);
  res.status(404).json({
    message: `${req.originalUrl} - Route Not Found`,
  });
});

//Listen to server
const PORT = process.env.PORT || 5000;

app.listen(PORT, console.log(`Server is up and running on ${PORT}`));
