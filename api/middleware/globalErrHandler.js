const globalErrHandler = (err, req, res, next) => {
  // Extract relevant error information
  const stack = err.stack;
  const success = err.success;
  const message = err.message;
  const status = err.status || "failed";
  const statusCode = err.statusCode || 500;

  // Log the error for debugging purposes
  console.error("Error:", err);

  // Send the response
  res.status(statusCode).json({
    errorType: err.name || "InternalServerError",
    message,
    stack,
    status,
    success,
  });
};

const notFoundErr = (req, res, next) => {
  const err = new Error(`Can't find ${req.originalUrl} on this server`);
  err.status = "failed";
  err.success = false;
  err.statusCode = 404;
  next(err);
};

export { globalErrHandler, notFoundErr };
